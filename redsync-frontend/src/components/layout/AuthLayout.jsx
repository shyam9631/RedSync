import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased flex items-center justify-center">
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  )
}