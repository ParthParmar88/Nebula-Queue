import { Compass } from 'lucide-react'
import { Card } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { buttonVariants } from '../components/ui/variants'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <Card className="mt-2">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn’t exist. Check the address, or head back to the overview."
        action={
          <a href="#/" className={buttonVariants({ variant: 'secondary' })}>
            Go to overview
          </a>
        }
      />
    </Card>
  )
}
