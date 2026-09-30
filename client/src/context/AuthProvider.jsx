import { useCallback, useEffect, useMemo, useState } from 'react'
import { getStoredEmail, getStoredToken } from '../api/http'
import * as authApi from '../api/authApi'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken())
  const [email, setEmail] = useState(() => getStoredEmail())

  const isAuthenticated = Boolean(token)
  const isAdmin = useMemo(
    () => (token ? rolesFromToken(token).includes('ROLE_ADMIN') : false),
    [token]
  )

  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null)
      setEmail(null)
    }
    window.addEventListener('nq:unauthorized', onUnauthorized)
    return () => window.removeEventListener('nq:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (e, p) => {
    const data = await authApi.login(e, p)
    setToken(data.token)
    setEmail(data.email)
  }, [])

  const register = useCallback(async (e, p) => {
    await authApi.register(e, p)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setToken(null)
    setEmail(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      email,
      isAuthenticated,
      isAdmin,
      login,
      register,
      logout,
    }),
    [token, email, isAuthenticated, isAdmin, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function parseJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function rolesFromToken(token) {
  const p = parseJwtPayload(token)
  return Array.isArray(p.roles) ? p.roles : []
}
