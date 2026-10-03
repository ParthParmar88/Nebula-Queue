import { useRef, useState } from 'react'
import { CircleAlert, CloudUpload, FileSearch, FileText, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { getErrorMessage } from '../api/errors'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import Tooltip from '../components/ui/Tooltip'
import { useShell } from '../context/shellContext.js'
import { useToast } from '../context/toastContext.js'
import { useDeleteDocument, useDocumentsQuery, useUploadDocument } from '../hooks/useDocuments'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useNow } from '../hooks/useNow'
import { cn } from '../lib/cn'
import { formatDateTime, formatRelative } from '../lib/format'

const ACCEPT = '.pdf,.txt,.md'
const MAX_BYTES = 10 * 1024 * 1024 // matches DocumentService on the API

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const KIND = { 'application/pdf': 'PDF', 'text/plain': 'Text', 'text/markdown': 'Markdown' }

export default function DocumentsPage() {
  useDocumentTitle('Documents')
  const { openNewJob } = useShell()
  const { data: documents, isPending, isError, error, refetch, isFetching } = useDocumentsQuery()
  const [deleting, setDeleting] = useState(null)
  const readyCount = documents?.filter((d) => d.status === 'READY').length ?? 0

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload files, then ask questions. Answers come only from your documents and cite the passages they used."
        actions={
          <Button variant="primary" onClick={() => openNewJob({ type: 'AI_ASK' })} disabled={readyCount === 0}>
            <FileSearch aria-hidden="true" />
            Ask a question
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <UploadZone compact={Boolean(documents?.length)} />

        {isPending ? (
          <Card aria-busy="true" aria-label="Loading documents">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-b-0">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            ))}
          </Card>
        ) : isError ? (
          <Alert
            tone="danger"
            title="Couldn’t load your documents"
            action={
              <Button size="sm" onClick={() => refetch()} loading={isFetching}>
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            }
          >
            {getErrorMessage(error)}
          </Alert>
        ) : (
          documents.length > 0 && (
            <Card>
              <ul className="divide-y divide-border">
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onAsk={() => openNewJob({ type: 'AI_ASK', documentIds: [doc.id] })}
                    onDelete={() => setDeleting(doc)}
                  />
                ))}
              </ul>
            </Card>
          )
        )}
      </div>

      <DeleteDocumentDialog doc={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function DocumentRow({ doc, onAsk, onDelete }) {
  const now = useNow()
  const facts = [
    KIND[doc.contentType] ?? 'File',
    formatBytes(doc.sizeBytes),
    doc.pageCount != null && doc.contentType === 'application/pdf' && `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}`,
    doc.chunkCount != null && `${doc.chunkCount} chunk${doc.chunkCount === 1 ? '' : 's'}`,
  ].filter(Boolean)

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-fg-muted">
          <FileText className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-fg" title={doc.filename}>
              {doc.filename}
            </p>
            <DocumentStatus doc={doc} />
          </div>
          <p className="mt-0.5 text-13 text-fg-muted">
            {facts.join(' · ')} ·{' '}
            <time dateTime={doc.createdAt} title={formatDateTime(doc.createdAt)}>
              {formatRelative(doc.createdAt, now)}
            </time>
          </p>
          {doc.status === 'FAILED' && doc.error && (
            <p className="mt-1.5 flex items-start gap-1.5 text-13 text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {doc.error.replace(/^Error:\s*/, '')}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 pl-12 sm:pl-0">
        {doc.ingestJobId && (
          <a href={`#/jobs/${doc.ingestJobId}`} className="rounded px-2 text-13 text-fg-muted hover:text-fg">
            Indexing job
          </a>
        )}
        <Button size="sm" onClick={onAsk} disabled={doc.status !== 'READY'}>
          <FileSearch aria-hidden="true" />
          Ask
        </Button>
        <Tooltip content={doc.status === 'PROCESSING' ? 'Wait for indexing to finish' : 'Delete'} align="end">
          <Button
            variant="danger-ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={doc.status === 'PROCESSING'}
            aria-label={`Delete ${doc.filename}`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>
    </li>
  )
}

function DocumentStatus({ doc }) {
  if (doc.status === 'READY') return <Badge tone="success">Ready</Badge>
  if (doc.status === 'FAILED') return <Badge tone="danger">Failed</Badge>
  return (
    <Badge tone="info">
      <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
      Indexing
    </Badge>
  )
}

/** Drag-and-drop (or click) upload. Large when the list is empty; a slim bar otherwise. */
function UploadZone({ compact }) {
  const inputRef = useRef(null)
  const { toast } = useToast()
  const upload = useUploadDocument()
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(null) // { name, percent }
  const [error, setError] = useState(null)

  async function send(file) {
    setError(null)
    if (!file) return
    if (!/\.(pdf|txt|md)$/i.test(file.name)) {
      setError('Only PDF, .txt and .md files are supported.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)}; the limit is 10 MB.`)
      return
    }
    setProgress({ name: file.name, percent: 0 })
    try {
      await upload.mutateAsync({ file, onProgress: (percent) => setProgress({ name: file.name, percent }) })
      toast({ title: 'Uploaded', description: `${file.name} is being indexed. It’ll be ready to search in a moment.` })
    } catch (err) {
      setError(getErrorMessage(err, 'The upload failed.'))
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const busy = progress !== null

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!busy) send(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex rounded-lg border border-dashed transition-colors',
          compact ? 'flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5' : 'flex-col items-center px-6 py-14 text-center',
          dragging ? 'border-accent bg-accent-soft/40' : 'border-border-strong bg-surface'
        )}
      >
        {!compact && (
          <span className="mb-4 flex size-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-muted">
            <CloudUpload className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className={compact ? 'flex items-center gap-3' : undefined}>
          {compact && <CloudUpload className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />}
          <div>
            <p className="text-sm font-medium text-fg">
              {busy ? `Uploading ${progress.name}…` : compact ? 'Drop a file here to upload' : 'Upload your first document'}
            </p>
            <p className="mt-0.5 text-13 text-fg-muted">
              {busy ? `${progress.percent}%` : 'PDF, .txt or .md · up to 10 MB · indexed in the background'}
            </p>
          </div>
        </div>
        <div className={compact ? undefined : 'mt-5'}>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => send(e.target.files?.[0])}
          />
          <Button variant={compact ? 'secondary' : 'primary'} onClick={() => inputRef.current?.click()} loading={busy}>
            {!busy && <CloudUpload aria-hidden="true" />}
            Choose file
          </Button>
        </div>
      </div>
      {busy && (
        <div className="h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress.percent}%` }} />
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  )
}

function DeleteDocumentDialog({ doc, onClose }) {
  const { toast } = useToast()
  const remove = useDeleteDocument()
  if (!doc) return null

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Delete this document?"
      description={`${doc.filename} and its search index will be removed. Past answers keep their citations. This can’t be undone.`}
      footer={
        <>
          <Button onClick={onClose} data-autofocus>
            Keep document
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(doc.id, {
                onSuccess: () => {
                  toast({ title: 'Document deleted', description: doc.filename })
                  onClose()
                },
                onError: (err) => {
                  toast({ tone: 'danger', title: 'Couldn’t delete the document', description: getErrorMessage(err) })
                  onClose()
                },
              })
            }
          >
            Delete
          </Button>
        </>
      }
    />
  )
}
