import { createContext, useContext, useState } from 'react'
import { clearSession, getStoredSession, storeSession } from '../lib/api'

const AuthContext = createContext(null)

function loadUser() {
  const session = getStoredSession()
  return session?.user || null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  const login = (sessionOrUser) => {
    const session = sessionOrUser?.user ? sessionOrUser : { token: sessionOrUser?.token || null, user: sessionOrUser }
    const nextUser = session.user || null

    setUser(nextUser)

    try {
      localStorage.setItem('redsync_user', JSON.stringify(nextUser))
    } catch {
      /* ignore storage errors */
    }

    storeSession(session)
  }

  const logout = () => {
    setUser(null)
    clearSession()
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return { user: null, login: () => {}, logout: () => {} }
  }
  return context
}