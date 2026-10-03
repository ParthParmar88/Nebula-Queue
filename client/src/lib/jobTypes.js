import { FileText, Image, Layers, Mail, Sparkles } from 'lucide-react'

/**
 * UI metadata for each job type the API accepts (see JobType.java).
 * `implemented: false` means the worker has no real handler yet and only simulates the
 * job — the UI says so instead of pretending. `ai: true` jobs stream output and report usage.
 */
export const JOB_TYPES = {
  AI_GENERATE: {
    label: 'Generate text',
    description: 'Prompt an LLM on the AI worker. The response streams in live, with token usage and cost.',
    icon: Sparkles,
    implemented: true,
    ai: true,
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

export const JOB_TYPE_ORDER = ['AI_GENERATE', 'EMAIL_SEND', 'IMAGE_RESIZE', 'PDF_GENERATE', 'BATCH']

/** Must match JobPayloadValidator on the API. */
export const AI_LIMITS = { promptChars: 8000, systemChars: 4000 }

export const isAiJob = (job) => Boolean(JOB_TYPES[job?.type]?.ai)

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
