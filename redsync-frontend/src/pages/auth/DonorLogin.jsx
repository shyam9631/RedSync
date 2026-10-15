import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function DonorLogin() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const sendOtp = () => {
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit mobile number.')
      return
    }
    setError('')
    setOtpSent(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!otpSent) return sendOtp()
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.')
      return
    }
    // Demo login: replaced by the real backend call later
    login({ role: 'donor', name: 'Donor', phone })
    navigate('/donor/dashboard')
  }

  return (
    <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-md p-space-xl">
      <div className="flex items-center gap-2 mb-space-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary">
          Donor Login
        </span>
      </div>
      <h1 className="font-headline-md text-headline-md text-on-surface">Welcome back</h1>
      <p className="font-body-md text-body-md text-secondary mt-1 mb-space-lg">
        Sign in to see urgent requests near you and your donation history.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
        <div className="flex flex-col gap-1.5">
          <label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="phone">
            Mobile Number
          </label>
          <div className="flex items-center rounded-lg bg-surface-container-low focus-within:bg-surface-container-lowest focus-within:shadow-[0_0_0_2px_#c62828] transition-all">
            <div className="flex items-center pl-3 pr-2 py-3 bg-surface-container-high rounded-l-lg font-label-md text-label-md text-on-surface">
              <span className="mr-1">🇮🇳</span>+91
            </div>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="98765 43210"
              className="flex-1 bg-transparent px-3 py-3 text-on-surface placeholder:text-secondary/60 focus:outline-none font-body-md text-body-md"
            />
          </div>
        </div>

        {otpSent && (
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="otp">
              Enter 6-digit OTP
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="rounded-lg bg-surface-container-low px-3 py-3 text-center tracking-[0.5em] font-headline-sm text-headline-sm text-on-surface focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#c62828] focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-secondary">
                Demo mode: any 6-digit code works.
              </span>
              <button
                type="button"
                onClick={sendOtp}
                className="font-label-sm text-label-sm text-primary hover:underline"
              >
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="submit"
          className="w-full py-3.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {otpSent ? 'Verify & Sign In' : 'Send OTP'}
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </button>
      </form>

      <div className="mt-space-lg pt-space-md border-t border-surface-container-high text-center font-body-md text-body-md text-secondary space-y-1">
        <p>
          New donor?{' '}
          <Link to="/register/donor" className="text-primary font-bold hover:underline">
            Register here
          </Link>
        </p>
        <p>
          Hospital staff?{' '}
          <Link to="/login/hospital" className="text-primary font-bold hover:underline">
            Hospital login
          </Link>
        </p>
      </div>
    </div>
  )
}