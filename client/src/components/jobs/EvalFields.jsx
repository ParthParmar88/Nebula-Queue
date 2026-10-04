import { Plus, Trash2 } from 'lucide-react'
import { useDocumentsQuery } from '../../hooks/useDocuments'
import { AI_LIMITS, emptyEvalCase } from '../../lib/jobTypes'
import Button from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Field'
import { DocumentPicker, NoReadyDocuments } from './DocumentPicker'

/**
 * Editor for an evaluation: name, top-k, documents, and test cases (question + expected
 * answer, optionally the document/page that should be retrieved).
 * `errors.cases[i]` holds per-case messages.
 */
export default function EvalFields({ value, errors, onChange, onGoToDocuments }) {
  const { data: documents, isPending } = useDocumentsQuery()
  const ready = (documents ?? []).filter((d) => d.status === 'READY')
  const indexing = (documents ?? []).some((d) => d.status === 'PROCESSING')

  if (!isPending && ready.length === 0) {
    return <NoReadyDocuments indexing={indexing} onGoToDocuments={onGoToDocuments} />
  }

  // The expected source must be one of the documents being evaluated
  const evaluated = value.documentIds.length ? ready.filter((d) => value.documentIds.includes(d.id)) : ready
  const set = (patch) => onChange({ ...value, ...patch })
  const setCase = (i, patch) => set({ cases: value.cases.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <Field label="Name" optional>
          <Input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Baseline" maxLength={100} />
        </Field>
        <Field label="Top-k" hint="Passages retrieved">
          <Select value={value.topK} onChange={(e) => set({ topK: Number(e.target.value) })}>
            {Array.from({ length: AI_LIMITS.maxTopK }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <DocumentPicker documents={ready} selectedIds={value.documentIds} onChange={(documentIds) => set({ documentIds })} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-13 font-medium text-fg">Test cases</p>
          <span className="text-13 tabular-nums text-fg-muted">
            {value.cases.length} / {AI_LIMITS.evalCases}
          </span>
        </div>
        <ol className="flex flex-col gap-3">
          {value.cases.map((c, i) => {
            const caseErrors = errors.cases?.[i] ?? {}
            return (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Case {i + 1}</span>
                  {value.cases.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => set({ cases: value.cases.filter((_, j) => j !== i) })}
                      aria-label={`Remove case ${i + 1}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Field label="Question" error={caseErrors.question}>
                    <Textarea
                      rows={2}
                      className="min-h-0"
                      value={c.question}
                      onChange={(e) => setCase(i, { question: e.target.value })}
                      placeholder="How many days do new hires have to finish security training?"
                    />
                  </Field>
                  <Field label="Expected answer" error={caseErrors.expected}>
                    <Textarea
                      rows={2}
                      className="min-h-0"
                      value={c.expected}
                      onChange={(e) => setCase(i, { expected: e.target.value })}
                      placeholder="14 days from the start date."
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                    <Field label="Expected source" optional>
                      <Select value={c.expectedDocumentId} onChange={(e) => setCase(i, { expectedDocumentId: e.target.value })}>
                        <option value="">Don’t check retrieval</option>
                        {evaluated.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.filename}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Page" optional>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={c.expectedPage}
                        onChange={(e) => setCase(i, { expectedPage: e.target.value })}
                        disabled={!c.expectedDocumentId}
                      />
                    </Field>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        {value.cases.length < AI_LIMITS.evalCases && (
          <Button className="mt-3" onClick={() => set({ cases: [...value.cases, emptyEvalCase()] })}>
            <Plus aria-hidden="true" />
            Add case
          </Button>
        )}
        <p className="mt-3 text-13 text-fg-muted">
          Each case makes two model calls: one to answer, one to judge the answer. Runs at temperature 0 so results are
          comparable between runs.
        </p>
      </div>
    </div>
  )
}
