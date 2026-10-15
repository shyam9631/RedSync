import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem('redsync_user'))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  const login = (userData) => {
    setUser(userData)
    try {
      localStorage.setItem('redsync_user', JSON.stringify(userData))
    } catch {
      /* ignore storage errors */
    }
  }

  const logout = () => {
    setUser(null)
    try {
      localStorage.removeItem('redsync_user')
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}