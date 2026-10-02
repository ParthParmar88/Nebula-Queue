import { useState } from 'react'
import { Activity, Eye, EyeOff, Layers, ShieldCheck } from 'lucide-react'
import { getErrorMessage } from '../api/errors'
import Logo from '../components/layout/Logo'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import StatusBadge from '../components/ui/StatusBadge'
import { useAuth } from '../context/authContext.js'
import { useToast } from '../context/toastContext.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const COPY = {
  signin: {
    title: 'Sign in',
    description: 'Welcome back. Sign in to submit and track your jobs.',
    submit: 'Sign in',
    switchPrompt: 'Don’t have an account?',
    switchAction: 'Create one',
  },
  register: {
    title: 'Create your account',
    description: 'Start queueing background jobs in under a minute.',
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
  },
}

const FEATURES = [
  { icon: Layers, title: 'Durable queue', text: 'Jobs are persisted, then delivered to workers through RabbitMQ.' },
  { icon: Activity, title: 'Live status', text: 'Every state change streams to your browser over WebSocket.' },
  { icon: ShieldCheck, title: 'Scoped access', text: 'Members see their own jobs; admins see the whole queue.' },
]

export default function AuthPage() {
  const { login, register } = useAuth()
  const { toast } = useToast()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const copy = COPY[mode]
  useDocumentTitle(copy.title)

  function switchMode() {
    setMode((m) => (m === 'signin' ? 'register' : 'signin'))
    setError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'register') {
        await register(email, password)
        try {
          await login(email, password)
          toast({ title: 'Account created', description: 'You’re signed in and ready to submit jobs.' })
        } catch {
          // Registered but auto sign-in failed — let them sign in manually
          setMode('signin')
          setError('Your account was created, but signing in failed. Please sign in.')
        }
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(getErrorMessage(err, mode === 'signin' ? 'Sign in failed.' : 'Couldn’t create the account.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Form */}
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{copy.title}</h1>
            <p className="mt-1.5 text-sm text-fg-muted">{copy.description}</p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              {error && <Alert tone="danger">{error}</Alert>}

              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </Field>

              <Field label="Password" hint={mode === 'register' ? 'At least 6 characters.' : undefined}>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
                {copy.submit}
              </Button>
            </form>

            <p className="mt-6 text-center text-13 text-fg-muted">
              {copy.switchPrompt}{' '}
              <button type="button" onClick={switchMode} className="rounded font-medium text-fg hover:underline">
                {copy.switchAction}
              </button>
            </p>
          </div>
        </main>
      </div>

      {/* Product panel (desktop only) */}
      <aside className="relative hidden overflow-hidden border-l border-border bg-surface-2 lg:flex lg:items-center lg:justify-center">
        <div
          className="bg-dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          aria-hidden="true"
        />
        <div className="relative w-full max-w-md px-10">
          <p className="text-13 font-medium text-accent-soft-fg">Nebula Queue</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
            Background jobs you can actually watch.
          </h2>

          {/* Illustration of the job list — static, decorative */}
          <div className="mt-8 rounded-lg border border-border bg-surface shadow-overlay" aria-hidden="true">
            {[
              { label: 'Send email', id: '7f3a91c2', status: 'COMPLETED' },
              { label: 'Generate PDF', id: 'b21e04d8', status: 'PROCESSING' },
              { label: 'Resize image', id: '0c9d5f17', status: 'PENDING' },
            ].map((row) => (
              <div key={row.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-13 font-medium text-fg">{row.label}</p>
                  <p className="font-mono text-xs text-fg-muted">{row.id}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
          </div>

          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <li key={feature.title} className="flex gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  <p className="text-13 text-fg-muted">
                    <span className="font-medium text-fg">{feature.title}.</span> {feature.text}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}

function PasswordInput({ visible, onToggle, ...props }) {
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} required minLength={6} className="pr-10" {...props} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:text-fg"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
