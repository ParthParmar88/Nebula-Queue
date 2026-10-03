import { useId, useState } from 'react'
import { getErrorMessage } from '../../api/errors'
import { useToast } from '../../context/toastContext.js'
import { useSubmitJob } from '../../hooks/useJobs'
import { cn } from '../../lib/cn'
import { formatNumber, shortId } from '../../lib/format'
import { AI_LIMITS, JOB_TYPE_ORDER, JOB_TYPES } from '../../lib/jobTypes'
import { navigate } from '../../lib/router'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input, Textarea } from '../ui/Field'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NewJobDialog({ open, onClose }) {
  // Mount the form only while open, so every opening starts from a clean slate
  return open ? <NewJobForm onClose={onClose} /> : null
}

function NewJobForm({ onClose }) {
  const formId = useId()
  const { toast } = useToast()
  const submit = useSubmitJob()

  const [type, setType] = useState('AI_GENERATE')
  const [ai, setAi] = useState({ prompt: '', system: '' })
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
          if (meta.ai) {
            // The interesting part of an AI job is watching it write — go straight there
            navigate(`/jobs/${job.id}`)
            toast({ title: 'Generating…', description: 'The response streams in as the model writes it.' })
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
            {meta.ai ? 'Generate' : 'Submit job'}
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

function CharCount({ value, max }) {
  const over = value.length > max
  return (
    <span className={cn('text-xs tabular-nums', over ? 'font-medium text-danger' : 'text-fg-subtle')}>
      {formatNumber(value.length)} / {formatNumber(max)}
    </span>
  )
}
