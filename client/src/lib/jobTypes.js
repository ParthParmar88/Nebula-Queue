import { FileSearch, FileStack, FileText, Image, Layers, Mail, Sparkles } from 'lucide-react'

/**
 * UI metadata for each job type the API accepts (see JobType.java).
 * `implemented: false` means the worker has no real handler yet and only simulates the
 * job — the UI says so instead of pretending. `ai: true` jobs report token usage;
 * `streams: true` jobs also stream text live. `internal: true` jobs are created by the
 * system (e.g. on upload) and aren't offered in the New job dialog.
 */
export const JOB_TYPES = {
  AI_GENERATE: {
    label: 'Generate text',
    description: 'Prompt an LLM on the AI worker. The response streams in live, with token usage and cost.',
    icon: Sparkles,
    implemented: true,
    ai: true,
    streams: true,
  },
  AI_ASK: {
    label: 'Ask documents',
    description: 'Answer a question from your uploaded documents, citing the passages it used.',
    icon: FileSearch,
    implemented: true,
    ai: true,
    streams: true,
  },
  INGEST_DOCUMENT: {
    label: 'Index document',
    description: 'Extract, chunk and embed an uploaded document so it can be searched.',
    icon: FileStack,
    implemented: true,
    ai: true,
    internal: true,
  },
  EMAIL_SEND: {
    label: 'Send email',
    description: 'Deliver an email through the worker’s SMTP account.',
    icon: Mail,
    implemented: true,
  },
  IMAGE_RESIZE: {
    label: 'Resize image',
    description: 'Resize an image to target dimensions.',
    icon: Image,
    implemented: false,
  },
  PDF_GENERATE: {
    label: 'Generate PDF',
    description: 'Render a document to a PDF file.',
    icon: FileText,
    implemented: false,
  },
  BATCH: {
    label: 'Batch task',
    description: 'Generic background task with an optional JSON payload.',
    icon: Layers,
    implemented: false,
  },
}

/** Types offered in the New job dialog, in display order (internal types excluded). */
export const JOB_TYPE_ORDER = ['AI_GENERATE', 'AI_ASK', 'EMAIL_SEND', 'IMAGE_RESIZE', 'PDF_GENERATE', 'BATCH']

/** Every type, for breakdowns and filters. */
export const ALL_JOB_TYPES = ['AI_GENERATE', 'AI_ASK', 'INGEST_DOCUMENT', 'EMAIL_SEND', 'IMAGE_RESIZE', 'PDF_GENERATE', 'BATCH']

/** Must match JobPayloadValidator on the API. */
export const AI_LIMITS = { promptChars: 8000, systemChars: 4000, questionChars: 2000, askDocuments: 20 }

export const isAiJob = (job) => Boolean(JOB_TYPES[job?.type]?.ai)

export const isStreamingJob = (job) => Boolean(JOB_TYPES[job?.type]?.streams)

/** The passages an AI_ASK answer cites (`job.sources` JSON); [] when absent or malformed. */
export function parseSources(json) {
  try {
    const value = JSON.parse(json ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

/** One-line result for lists: AI output, or the worker's result/error text. */
export const resultSummary = (job) => (job.output || job.resultUrl || '').replace(/\s+/g, ' ').trim()

export const isFinished = (status) => status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'

export function jobTypeMeta(type) {
  return JOB_TYPES[type] ?? { label: type, description: '', icon: Layers, implemented: false }
}

/** Display order and labels for job statuses (see JobStatus.java). */
export const STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']

export const STATUS_LABELS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}
