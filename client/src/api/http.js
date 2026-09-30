import axios from 'axios'

const TOKEN_KEY = 'nq_token'
const EMAIL_KEY = 'nq_email'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredEmail() {
  return localStorage.getItem(EMAIL_KEY)
}

export function setSession(token, email) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  if (email) localStorage.setItem(EMAIL_KEY, email)
  else localStorage.removeItem(EMAIL_KEY)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
}

// In dev, use Vite proxy (baseURL '/'). For preview/production builds, set
// VITE_API_URL=http://localhost:9090 at build time if not using the dev proxy.
const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/'

const http = axios.create({
  baseURL: apiBase,
  timeout: 30_000,
})

http.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearSession()
      // Defer logout so the calling form can show an error first.
      queueMicrotask(() => window.dispatchEvent(new Event('nq:unauthorized')))
    }
    return Promise.reject(err)
  }
)

export default http
