import Alert from '../ui/Alert'
import Button from '../ui/Button'

/** Checklist of ready documents. Nothing ticked means "all ready documents". */
export function DocumentPicker({ documents, selectedIds, onChange }) {
  function toggle(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-center justify-between text-13 font-medium text-fg">
        Documents
        <span className="font-normal text-fg-muted">
          {selectedIds.length ? `${selectedIds.length} selected` : `All ${documents.length} ready`}
        </span>
      </legend>
      <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {documents.map((doc) => (
          <li key={doc.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-13 transition-colors hover:bg-surface-2/60">
              <input
                type="checkbox"
                checked={selectedIds.includes(doc.id)}
                onChange={() => toggle(doc.id)}
                className="size-4 rounded border-border-strong accent-[rgb(var(--accent))]"
              />
              <span className="min-w-0 flex-1 truncate text-fg">{doc.filename}</span>
              {doc.pageCount != null && <span className="shrink-0 text-xs text-fg-muted">{doc.pageCount} pages</span>}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-13 text-fg-muted">Leave all unticked to use every ready document.</p>
    </fieldset>
  )
}

/** Shown instead of a form that needs documents when none are ready yet. */
export function NoReadyDocuments({ indexing, onGoToDocuments }) {
  return (
    <Alert
      tone="info"
      title={indexing ? 'Your documents are still being indexed' : 'No documents to search yet'}
      action={
        <Button size="sm" onClick={onGoToDocuments}>
          {indexing ? 'View documents' : 'Upload a document'}
        </Button>
      }
    >
      {indexing
        ? 'You can continue as soon as indexing finishes — usually a few seconds.'
        : 'Upload a PDF, .txt or .md file first; answers are grounded in what you upload.'}
    </Alert>
  )
}
