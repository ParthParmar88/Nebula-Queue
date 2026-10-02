import { FileText, Image, Layers, Mail } from 'lucide-react'

/**
 * UI metadata for each job type the API accepts (see JobType.java).
 * `implemented: false` means the worker has no real handler yet and only simulates the
 * job — the UI says so instead of pretending.
 */
export const JOB_TYPES = {
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

export const JOB_TYPE_ORDER = ['EMAIL_SEND', 'IMAGE_RESIZE', 'PDF_GENERATE', 'BATCH']

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
