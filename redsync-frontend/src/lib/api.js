import axios from 'axios'

// Endpoints that never need a login token. (The old list also contained '/', which matched
// EVERY url, so the token was never attached to any request.)
const PUBLIC_ROUTE_PREFIXES = ['/public/', '/auth/', '/health']

const isPublicEndpoint = (url = '') => {
  if (!url) return false
  const normalized = url.startsWith('http') ? new URL(url).pathname : url
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (isPublicEndpoint(config.url)) return config

  try {
    const session = JSON.parse(localStorage.getItem('redsync_session') || 'null')
    const token = session?.token
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }
  } catch {
    // ignore storage errors
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    // Only 401 means "your login is no longer valid". A 403 (for example "hospital not
    // approved yet") must NOT log the user out.
    const url = error?.config?.url || ''
    if (status === 401 && !isPublicEndpoint(url)) {
      clearSession()
      if (typeof window !== 'undefined') {
        const path = window.location.pathname
        if (!path.startsWith('/login') && !path.startsWith('/register')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// Turns an API error into text that is safe to show. FastAPI sends `detail` as a plain string
// for our own errors but as a LIST of objects for validation errors (422); putting that list
// into React state and rendering it crashes the page.
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : ''
    const msg = String(first?.msg || '').replace(/^Value error, /, '')
    return field ? `${field}: ${msg}` : msg || fallback
  }
  if (!err?.response) return 'Cannot reach the server. Check that the backend is running.'
  return fallback
}

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem('redsync_session') || 'null')
  } catch {
    return null
  }
}

export function storeSession(session) {
  try {
    localStorage.setItem('redsync_session', JSON.stringify(session))
  } catch {
    // ignore storage errors
  }
}

export function clearSession() {
  try {
    localStorage.removeItem('redsync_session')
    localStorage.removeItem('redsync_user')
  } catch {
    // ignore storage errors
  }
}

export default api
