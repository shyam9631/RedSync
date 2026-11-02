import axios from 'axios'

const PUBLIC_ROUTE_PREFIXES = ['/public/', '/auth/', '/health', '/']

const isPublicEndpoint = (url = '') => {
  if (!url) return false
  const normalized = url.startsWith('http') ? new URL(url).pathname : url
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix))
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
    if (status === 401 || status === 403) {
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
