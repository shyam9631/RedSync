import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function HospitalLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Enter your staff email and password.')
      return
    }
    // Demo login: replaced by the real backend call later
    login({ role: 'hospital', name: 'Hospital', email })
    navigate('/hospital/dashboard')
  }

  return (
    <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-md p-space-xl">
      <div className="flex items-center gap-2 mb-space-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-tertiary">
          Hospital / Blood Bank Login
        </span>
      </div>
      <h1 className="font-headline-md text-headline-md text-on-surface">Staff sign in</h1>
      <p className="font-body-md text-body-md text-secondary mt-1 mb-space-lg">
        Manage blood stock, post urgent needs and view registered donors.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
        <div className="flex flex-col gap-1.5">
          <label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="email">
            Staff Email
          </label>
          <div className="flex items-center rounded-lg bg-surface-container-low px-3 py-3 focus-within:bg-surface-container-lowest focus-within:shadow-[0_0_0_2px_#c62828] transition-all">
            <span className="material-symbols-outlined text-secondary mr-2">mail</span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@yourhospital.org"
              className="w-full bg-transparent text-on-surface placeholder:text-secondary/60 focus:outline-none font-body-md text-body-md"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="password">
              Password
            </label>
            <Link to="/forgot-password" className="font-label-sm text-label-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="flex items-center rounded-lg bg-surface-container-low px-3 py-3 focus-within:bg-surface-container-lowest focus-within:shadow-[0_0_0_2px_#c62828] transition-all">
            <span className="material-symbols-outlined text-secondary mr-2">key</span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-transparent text-on-surface placeholder:text-secondary/60 focus:outline-none font-body-md text-body-md"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-secondary hover:text-on-surface p-1"
              aria-label="Toggle password visibility"
            >
              <span className="material-symbols-outlined text-lg">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="submit"
          className="w-full py-3.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Sign In
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </button>
      </form>

      <div className="mt-space-lg pt-space-md border-t border-surface-container-high text-center font-body-md text-body-md text-secondary space-y-1">
        <p>
          Hospital not registered?{' '}
          <Link to="/register/hospital" className="text-primary font-bold hover:underline">
            Register your hospital
          </Link>
        </p>
        <p>
          Are you a donor?{' '}
          <Link to="/login/donor" className="text-primary font-bold hover:underline">
            Donor login
          </Link>
        </p>
      </div>
    </div>
  )
}