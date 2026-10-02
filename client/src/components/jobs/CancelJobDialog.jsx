import { getErrorMessage } from '../../api/errors'
import { useToast } from '../../context/toastContext.js'
import { useCancelJob } from '../../hooks/useJobs'
import { shortId } from '../../lib/format'
import { jobTypeMeta } from '../../lib/jobTypes'
import Button from '../ui/Button'
import { Dialog } from '../ui/Dialog'

/** Confirmation before cancelling a pending job. Pass `job = null` to keep it closed. */
export default function CancelJobDialog({ job, onClose }) {
  const { toast } = useToast()
  const cancel = useCancelJob()

  if (!job) return null

  function confirm() {
    cancel.mutate(job.id, {
      onSuccess: () => {
        toast({ title: 'Job cancelled', description: `${shortId(job.id)} won’t be processed.` })
        onClose()
      },
      onError: (err) => {
        // e.g. 409 when a worker picked it up a moment ago
        toast({ tone: 'danger', title: 'Couldn’t cancel the job', description: getErrorMessage(err) })
        onClose()
      },
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Cancel this job?"
      description={`${jobTypeMeta(job.type).label} · ${shortId(job.id)} will be removed from the queue and won’t run. This can’t be undone.`}
      footer={
        <>
          <Button onClick={onClose} data-autofocus>
            Keep job
          </Button>
          <Button variant="danger" onClick={confirm} loading={cancel.isPending}>
            Cancel job
          </Button>
        </>
      }
    />
  )
}
