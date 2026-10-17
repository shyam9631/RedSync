import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const features = [
  'Update blood stock for each blood group',
  'Post urgent blood requests',
  'See registered donors in your area',
]

export default function HospitalLogin() {
  const [facilityCode, setFacilityCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!facilityCode.trim() || !email.trim() || !password) {
      setError('Enter your facility code, staff email and password.')
      return
    }
    // Demo login: replaced by the real backend call later
    login({
      role: 'hospital',
      name: 'Hospital',
      email,
      facilityCode: facilityCode.trim(),
    })
    navigate('/hospital/dashboard')
  }

  const fieldBox =
    'w-full h-12 pl-11 pr-4 bg-surface-container-low rounded-lg text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary'

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md group"
        >
          <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          Back to Portal Selection
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: form */}
        <div className="lg:col-span-7 flex flex-col bg-surface-container-lowest rounded-xl shadow-md p-6 sm:p-8 lg:p-10 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>

          <div className="flex flex-col gap-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span className="font-label-sm text-label-sm tracking-wider uppercase">
                Institutional & Clinical Access
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
              Hospital & Blood Bank Login
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
              Sign in to manage your blood stock, post urgent requests and view registered donors.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5 relative z-10">
            {/* Facility code */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="facility-id">
                Facility / Hospital Code
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                  local_hospital
                </span>
                <input
                  id="facility-id"
                  type="text"
                  value={facilityCode}
                  onChange={(e) => setFacilityCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HSP-XXXX"
                  className={fieldBox}
                />
              </div>
            </div>

            {/* Staff email */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="staff-id">
                Staff ID or Institutional Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                  badge
                </span>
                <input
                  id="staff-id"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. dr.sharma@cityhospital.org"
                  className={fieldBox}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="password">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="font-label-sm text-label-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                  key
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className={`${fieldBox} pr-24`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>

            {error && <p className="font-body-md text-body-md text-error">{error}</p>}

            <button
              type="submit"
              className="mt-2 w-full h-12 bg-primary hover:bg-surface-tint text-on-primary font-headline-sm text-body-lg rounded-full flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                lock
              </span>
              <span>Access Dashboard</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login/donor"
                className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:text-surface-tint transition-colors"
              >
                <span>Looking to donate blood? Switch to Donor Login</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </form>
        </div>

        {/* Right: dark panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="w-full bg-inverse-surface text-inverse-on-surface rounded-xl shadow-xl p-6 sm:p-8 relative overflow-hidden flex flex-col gap-6">
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-primary-container/20 blur-3xl pointer-events-none"></div>

            <div className="flex flex-col gap-3 relative z-10">
              <h2 className="font-headline-md text-headline-md text-inverse-on-surface tracking-tight">
                Manage blood availability in real time
              </h2>
              <p className="font-body-md text-body-md text-surface-dim">
                Keep your blood stock up to date and send urgent requests to nearby donors.
              </p>
            </div>

            <div className="flex flex-col gap-4 relative z-10 pt-2">
              {features.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-3 p-3.5 rounded-lg bg-white/5 backdrop-blur-md"
                >
                  <span className="material-symbols-outlined text-tertiary-fixed text-[20px]">
                    check_circle
                  </span>
                  <span className="font-body-md text-body-md text-inverse-on-surface">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-5 rounded-xl bg-surface-container-low">
            <div className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              New to RedSync?
            </div>
            <Link
              to="/register/hospital"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">add_business</span>
              <span>Register Facility</span>
            </Link>
          </div>

          <div className="flex items-center justify-between text-secondary px-2">
            <span className="font-label-sm text-label-sm">© 2026 RedSync. All rights reserved.</span>
          </div>
        </div>
      </div>
    </div>
  )
}