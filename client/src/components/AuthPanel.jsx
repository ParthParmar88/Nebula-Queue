import { useState } from 'react'
import { useAuth } from '../context/authContext.js'

export default function AuthPanel() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'register') {
        await register(email, password)
        setMessage('Account created. You can sign in now.')
        setMode('login')
        setPassword('')
      } else {
        await login(email, password)
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'Request failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Nebula Queue</h2>
      <p className="text-sm text-gray-500 mb-6">Sign in to submit and track jobs.</p>

      <div className="flex rounded-lg border border-gray-200 p-0.5 mb-6 bg-gray-50">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
          onClick={() => { setMode('login'); setError(null); setMessage(null) }}
        >
          Login
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'register' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
          onClick={() => { setMode('register'); setError(null); setMessage(null) }}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Password</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {message && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
