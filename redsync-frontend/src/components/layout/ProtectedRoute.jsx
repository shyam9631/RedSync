import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ role }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to={role === 'hospital' ? '/login/hospital' : '/login/donor'} replace />
  }
  if (role && user.role !== role) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}