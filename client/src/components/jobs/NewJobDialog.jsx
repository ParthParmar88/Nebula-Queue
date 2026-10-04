import { useId, useState } from 'react'
import { getErrorMessage } from '../../api/errors'
import { useToast } from '../../context/toastContext.js'
import { useDocumentsQuery } from '../../hooks/useDocuments'
import { useSubmitJob } from '../../hooks/useJobs'
import { cn } from '../../lib/cn'
import { formatNumber, shortId } from '../../lib/format'
import { AI_LIMITS, emptyEvalCase, JOB_TYPE_ORDER, JOB_TYPES } from '../../lib/jobTypes'
import { navigate } from '../../lib/router'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input, Textarea } from '../ui/Field'
import { DocumentPicker, NoReadyDocuments } from './DocumentPicker'
import EvalFields from './EvalFields'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NewJobDialog({ open, preset, onClose }) {
  // Mount the form only while open, so every opening starts from a clean slate
  return open ? <NewJobForm preset={preset ?? {}} onClose={onClose} /> : null
}

function NewJobForm({ preset, onClose }) {
  const formId = useId()
  const { toast } = useToast()
  const submit = useSubmitJob()

  const [type, setType] = useState(preset.type ?? 'AI_GENERATE')
  const [ai, setAi] = useState({ prompt: '', system: '' })
  const [ask, setAsk] = useState({ question: '', documentIds: preset.documentIds ?? [] })
  const [evaluation, setEvaluation] = useState(
    () =>
      preset.evalConfig ?? {
        name: '',
        topK: AI_LIMITS.defaultTopK,
        documentIds: preset.documentIds ?? [],
        cases: [emptyEvalCase(), emptyEvalCase()],
      }
  )
  const [email, setEmail] = useState({ to: '', subject: '', body: '' })
  const [payload, setPayload] = useState('')
  const [errors, setErrors] = useState({})

  const meta = JOB_TYPES[type]

  function validate() {
    const next = {}
    if (type === 'AI_GENERATE') {
      if (!ai.prompt.trim()) next.prompt = 'Write a prompt.'
      else if (ai.prompt.length > AI_LIMITS.promptChars) next.prompt = `Keep the prompt under ${formatNumber(AI_LIMITS.promptChars)} characters.`
      if (ai.system.length > AI_LIMITS.systemChars) next.system = `Keep instructions under ${formatNumber(AI_LIMITS.systemChars)} characters.`
    } else if (type === 'AI_ASK') {
      if (!ask.question.trim()) next.question = 'Write a question.'
      else if (ask.question.length > AI_LIMITS.questionChars) next.question = `Keep the question under ${formatNumber(AI_LIMITS.questionChars)} characters.`
    } else if (type === 'EVAL_RUN') {
      const caseErrors = {}
      evaluation.cases.forEach((c, i) => {
        const e = {}
        if (!c.question.trim()) e.question = 'Write a question.'
        else if (c.question.length > AI_LIMITS.questionChars) e.question = 'Keep the question under 2,000 characters.'
        if (!c.expected.trim()) e.expected = 'Write the expected answer.'
        else if (c.expected.length > AI_LIMITS.expectedChars) e.expected = 'Keep the expected answer under 2,000 characters.'
        if (Object.keys(e).length) caseErrors[i] = e
      })
      if (Object.keys(caseErrors).length) next.cases = caseErrors
    } else if (type === 'EMAIL_SEND') {
      if (!EMAIL_PATTERN.test(email.to.trim())) next.to = 'Enter a valid email address.'
      if (!email.subject.trim()) next.subject = 'Add a subject.'
      if (!email.body.trim()) next.body = 'Write a message.'
    } else if (payload.trim()) {
      try {
        JSON.parse(payload)
      } catch {
        next.payload = 'This isn’t valid JSON. Check for missing quotes or commas.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function buildPayload() {
    if (type === 'AI_GENERATE') {
      return JSON.stringify({ prompt: ai.prompt, ...(ai.system.trim() ? { system: ai.system.trim() } : {}) })
    }
    if (type === 'AI_ASK') {
      // No selection = the API searches all of the user's ready documents
      return JSON.stringify({ question: ask.question, ...(ask.documentIds.length ? { documentIds: ask.documentIds } : {}) })
    }
    if (type === 'EVAL_RUN') {
      return JSON.stringify({
        ...(evaluation.name.trim() ? { name: evaluation.name.trim() } : {}),
        topK: evaluation.topK,
        ...(evaluation.documentIds.length ? { documentIds: evaluation.documentIds } : {}),
        cases: evaluation.cases.map((c) => ({
          question: c.question,
          expected: c.expected,
          ...(c.expectedDocumentId ? { expectedDocumentId: c.expectedDocumentId } : {}),
          ...(c.expectedDocumentId && Number(c.expectedPage) >= 1 ? { expectedPage: Number(c.expectedPage) } : {}),
        })),
      })
    }
    if (type === 'EMAIL_SEND') {
      return JSON.stringify({ to: email.to.trim(), subject: email.subject.trim(), body: email.body })
    }
    return payload.trim() || null
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (submit.isPending) return
    if (!validate()) {
      // Move keyboard/screen-reader users to the first problem once errors render
      const form = document.getElementById(formId)
      requestAnimationFrame(() => form?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    submit.mutate(
      { type, payload: buildPayload() },
      {
        onSuccess: (job) => {
          onClose()
          if (meta.streams) {
            // The interesting part of an AI job is watching it write — go straight there
            navigate(`/jobs/${job.id}`)
            toast(
              {
                AI_ASK: { title: 'Searching your documents…', description: 'The answer streams in with citations.' },
                EVAL_RUN: { title: 'Evaluation started', description: 'Each case’s scores appear as it finishes.' },
              }[type] ?? { title: 'Generating…', description: 'The response streams in as the model writes it.' }
            )
          } else {
            toast({
              title: 'Job submitted',
              description: `${meta.label} · ${shortId(job.id)} is in the queue.`,
              action: { label: 'View job', onClick: () => navigate(`/jobs/${job.id}`) },
            })
          }
        },
      }
    )
  }

  function formatPayload() {
    try {
      setPayload(JSON.stringify(JSON.parse(payload), null, 2))
      setErrors((e) => ({ ...e, payload: undefined }))
    } catch {
      setErrors((e) => ({ ...e, payload: 'This isn’t valid JSON, so it can’t be formatted.' }))
    }
  }

  function updateField(setter, field, value) {
    setter((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="New job"
      description="Jobs are queued immediately and picked up by the next available worker."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={submit.isPending}>
            {{ AI_ASK: 'Ask', EVAL_RUN: 'Run evaluation', AI_GENERATE: 'Generate' }[type] ?? 'Submit job'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
        }}
        noValidate
        className="flex flex-col gap-6"
      >
        {submit.isError && (
          <Alert tone="danger" title="Couldn’t submit the job">
            {getErrorMessage(submit.error)}
          </Alert>
        )}

        <fieldset>
          <legend className="mb-2 text-13 font-medium text-fg">Job type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {JOB_TYPE_ORDER.map((value) => {
              const t = JOB_TYPES[value]
              const Icon = t.icon
              const selected = value === type
              return (
                <label
                  key={value}
                  className={cn(
                    'relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-[border-color,box-shadow,background-color]',
                    'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-accent/25',
                    t.ai && 'sm:col-span-2',
                    selected
                      ? 'border-accent bg-accent-soft/40 ring-1 ring-accent'
                      : 'border-border hover:border-border-strong hover:bg-surface-2/60'
                  )}
                >
                  <input
                    type="radio"
                    name="job-type"
                    value={value}
                    checked={selected}
                    onChange={() => {
                      setType(value)
                      setErrors({})
                    }}
                    className="sr-only"
                    {...(selected ? { 'data-autofocus': true } : {})}
                  />
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md border',
                      selected ? 'border-accent/30 bg-surface text-accent-soft-fg' : 'border-border bg-surface-2 text-fg-muted'
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-13 font-medium text-fg">
                      {t.label}
                      {t.ai && <Badge tone="accent" className="px-1 py-0 text-2xs">AI</Badge>}
                      {!t.implemented && <Badge className="px-1 py-0 text-2xs">Simulated</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{t.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {type === 'AI_GENERATE' && (
          <div className="flex flex-col gap-4">
            <Field
              label="Prompt"
              error={errors.prompt}
              hint="Runs on the AI worker with the model set in OPENAI_MODEL."
              action={<CharCount value={ai.prompt} max={AI_LIMITS.promptChars} />}
            >
              <Textarea
                rows={6}
                value={ai.prompt}
                onChange={(e) => updateField(setAi, 'prompt', e.target.value)}
                placeholder="Write a three-sentence product description for a noise-cancelling headphone aimed at commuters."
              />
            </Field>
            <Field
              label="System instructions"
              optional
              error={errors.system}
              hint="Sets tone, format or role — for example “Answer in bullet points”."
            >
              <Textarea
                rows={2}
                value={ai.system}
                onChange={(e) => updateField(setAi, 'system', e.target.value)}
                className="min-h-0"
              />
            </Field>
          </div>
        )}

        {type === 'EVAL_RUN' && (
          <EvalFields
            value={evaluation}
            errors={errors}
            onChange={(next) => {
              setEvaluation(next)
              if (errors.cases) setErrors((e) => ({ ...e, cases: undefined }))
            }}
            onGoToDocuments={() => {
              onClose()
              navigate('/documents')
            }}
          />
        )}

        {type === 'AI_ASK' && (
          <AskFields
            ask={ask}
            errors={errors}
            onQuestion={(value) => updateField(setAsk, 'question', value)}
            onDocuments={(documentIds) => setAsk((a) => ({ ...a, documentIds }))}
            onGoToDocuments={() => {
              onClose()
              navigate('/documents')
            }}
          />
        )}

        {type === 'EMAIL_SEND' && (
          <div className="flex flex-col gap-4">
            <Field label="To" error={errors.to}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="recipient@example.com"
                value={email.to}
                onChange={(e) => updateField(setEmail, 'to', e.target.value)}
              />
            </Field>
            <Field label="Subject" error={errors.subject}>
              <Input value={email.subject} onChange={(e) => updateField(setEmail, 'subject', e.target.value)} maxLength={200} />
            </Field>
            <Field
              label="Message"
              error={errors.body}
              hint="Sent as plain text. The worker needs EMAIL_USER and EMAIL_PASS (a Gmail app password) configured."
            >
              <Textarea rows={5} value={email.body} onChange={(e) => updateField(setEmail, 'body', e.target.value)} />
            </Field>
          </div>
        )}

        {!meta.implemented && (
          <div className="flex flex-col gap-4">
            <Alert tone="info">
              The worker doesn’t implement <span className="font-medium text-fg">{meta.label}</span> yet — it
              completes the job after a short delay so you can follow the full lifecycle.
            </Alert>
            <Field
              label="Payload"
              optional
              error={errors.payload}
              hint="JSON passed to the worker as-is."
              action={
                payload.trim() && (
                  <Button variant="ghost" size="sm" className="-my-1 h-7" onClick={formatPayload}>
                    Format JSON
                  </Button>
                )
              }
            >
              <Textarea
                rows={7}
                spellCheck={false}
                value={payload}
                onChange={(e) => {
                  setPayload(e.target.value)
                  if (errors.payload) setErrors((er) => ({ ...er, payload: undefined }))
                }}
                placeholder={'{\n  "key": "value"\n}'}
                className="font-mono text-13"
              />
            </Field>
          </div>
        )}
      </form>
    </Dialog>
  )
}

/** Question + which documents to search (none ticked = all ready documents). */
function AskFields({ ask, errors, onQuestion, onDocuments, onGoToDocuments }) {
  const { data: documents, isPending } = useDocumentsQuery()
  const ready = (documents ?? []).filter((d) => d.status === 'READY')
  const indexing = (documents ?? []).some((d) => d.status === 'PROCESSING')

  if (!isPending && ready.length === 0) {
    return <NoReadyDocuments indexing={indexing} onGoToDocuments={onGoToDocuments} />
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Question"
        error={errors.question}
        hint="Answered only from your documents, with citations to the passages used."
        action={<CharCount value={ask.question} max={AI_LIMITS.questionChars} />}
      >
        <Textarea
          rows={3}
          value={ask.question}
          onChange={(e) => onQuestion(e.target.value)}
          placeholder="What does the onboarding guide say about security training?"
        />
      </Field>
      <DocumentPicker documents={ready} selectedIds={ask.documentIds} onChange={onDocuments} />
    </div>
  )
}

function CharCount({ value, max }) {
  const over = value.length > max
  return (
    <span className={cn('text-xs tabular-nums', over ? 'font-medium text-danger' : 'text-fg-subtle')}>
      {formatNumber(value.length)} / {formatNumber(max)}
    </span>
  )
}
