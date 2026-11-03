import { createContext, useContext, useState } from 'react'
import { clearSession, getStoredSession, storeSession } from '../lib/api'

const AuthContext = createContext(null)

// The API returns { donor: {blood_group, ...} } or { hospital: {facility_code, ...} }.
// The dashboards read flat camelCase fields (bloodGroup, city, facilityCode ...), so we
// flatten them once here. Without this a real donor always saw the sample "O+ / Bengaluru" profile.
function normalizeUser(user) {
  if (!user) return null
  const d = user.donor
  const h = user.hospital
  return {
    ...user,
    ...(d
      ? {
          bloodGroup: d.blood_group,
          gender: d.gender,
          lastDonation: d.last_donation,
          neverDonated: d.never_donated || !d.last_donation,
          city: d.city,
          area: d.area,
          radius: d.radius_km,
          available: d.available,
        }
      : {}),
    ...(h ? { facilityCode: h.facility_code, hospitalName: h.name } : {}),
  }
}

function loadUser() {
  const session = getStoredSession()
  return normalizeUser(session?.user)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  const login = (sessionOrUser) => {
    const session = sessionOrUser?.user ? sessionOrUser : { token: sessionOrUser?.token || null, user: sessionOrUser }
    const nextUser = normalizeUser(session.user)
    session.user = nextUser

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