import http, { clearSession, setSession } from './http'

export async function register(email, password) {
  await http.post('/auth/register', { email, password })
}

export async function login(email, password) {
  const { data } = await http.post('/auth/login', { email, password })
  setSession(data.token, data.email)
  return data
}

export function logout() {
  clearSession()
}
