import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const eligibility = [
  'Age 18–65',
  'Weight above 50 kg',
  'At least 3 months since last donation',
]

export default function DonorLogin() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpSent, setOtpSent] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const inputsRef = useRef([])
  const { login } = useAuth()
  const navigate = useNavigate()

  // Resend countdown
  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const sendOtp = () => {
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit mobile number.')
      return
    }
    setError('')
    setOtp(['', '', '', '', '', ''])
    setOtpSent(true)
    setSeconds(45)
    setTimeout(() => inputsRef.current[0]?.focus(), 0)
  }

  const handleOtpChange = (i, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = digit
    setOtp(next)
    if (digit && i < 5) inputsRef.current[i + 1]?.focus()
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputsRef.current[i - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    digits.split('').forEach((d, idx) => (next[idx] = d))
    setOtp(next)
    inputsRef.current[Math.min(digits.length, 5)]?.focus()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!otpSent) return sendOtp()
    if (otp.join('').length !== 6) {
      setError('Enter the 6-digit code.')
      return
    }
    // Demo login: replaced by the real backend call later
    login({ role: 'donor', name: 'Donor', phone })
    navigate('/donor/dashboard')
  }

  const timerText = `00:${String(seconds).padStart(2, '0')}`

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md group"
        >
          <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">
            arrow_back
          </span>
          <span>Back to Portal Selection</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left: form */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-surface-container-lowest rounded-xl p-6 sm:p-10 lg:p-12 shadow-xl shadow-surface-dim/40 overflow-hidden">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-error-container text-primary font-label-sm text-label-sm tracking-wider uppercase">
                Volunteer & Donor Access
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight mb-2">
              Sign in to save lives
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
              Enter your registered mobile number to receive a 6-digit OTP
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Phone */}
              <div className="space-y-2">
                <label
                  htmlFor="phone-input"
                  className="block font-label-md text-label-md text-on-surface font-semibold"
                >
                  Mobile Number
                </label>
                <div className="flex rounded-lg shadow-sm bg-surface-container-low overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:bg-surface-container-lowest transition-all">
                  <div className="flex items-center gap-2 px-3.5 py-3 bg-surface-container text-on-surface select-none">
                    <span className="text-base leading-none">🇮🇳</span>
                    <span className="font-title-md text-title-md text-on-surface font-semibold">+91</span>
                  </div>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit mobile number"
                    className="flex-1 min-w-0 px-4 py-3 bg-transparent text-on-surface font-body-lg text-body-lg placeholder:text-secondary focus:outline-none tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={sendOtp}
                    className="px-4 font-label-md text-label-md text-primary hover:bg-primary-fixed/50 transition-colors cursor-pointer"
                  >
                    {otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                </div>
              </div>

              {/* OTP */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">
                    6-Digit Verification Code
                  </label>
                  <span className="font-label-sm text-label-sm text-primary flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-sm">sms</span>
                    {otpSent ? 'OTP sent to your mobile' : 'OTP will be sent to your mobile'}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputsRef.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={!otpSent}
                      placeholder="•"
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-full aspect-square text-center font-headline-md text-headline-md rounded-lg bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary transition-all font-bold disabled:opacity-60"
                    />
                  ))}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-on-surface-variant font-label-md text-label-md">
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-symbols-outlined text-base">timer</span>
                    {!otpSent ? (
                      <span>Enter your number and tap Send OTP</span>
                    ) : seconds > 0 ? (
                      <span>
                        Resend code in{' '}
                        <strong className="text-on-surface font-semibold">{timerText}</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={sendOtp}
                        className="text-primary font-semibold hover:underline"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={sendOtp}
                    className="inline-flex items-center gap-1.5 text-tertiary hover:text-tertiary-container font-semibold transition-colors self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>

              {otpSent && (
                <p className="font-body-sm text-body-sm text-secondary">
                  Demo mode: any 6-digit code works until the backend is connected.
                </p>
              )}
              {error && <p className="font-body-md text-body-md text-error">{error}</p>}

              <button
                type="submit"
                className="w-full py-4 px-6 rounded-full bg-primary-container hover:bg-primary text-on-primary font-title-md text-title-md font-semibold tracking-wide shadow-lg shadow-primary-container/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>{otpSent ? 'Verify & Sign In as Donor' : 'Send OTP'}</span>
                <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left font-label-md text-label-md">
                <Link to="/contact" className="text-on-surface-variant hover:text-primary transition-colors">
                  Trouble receiving OTP?
                </Link>
                <Link
                  to="/register/donor"
                  className="text-primary hover:text-on-primary-fixed-variant font-bold transition-colors inline-flex items-center gap-1"
                >
                  <span>New donor? Register as a Lifesaver in 2 minutes</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </Link>
              </div>
            </form>
          </div>

          {/* Switch to hospital */}
          <div className="mt-10 pt-6 bg-surface-container-low -mx-6 sm:-mx-10 lg:-mx-12 -mb-6 sm:-mb-10 lg:-mb-12 px-6 sm:px-10 lg:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">local_hospital</span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Are you hospital staff?
              </span>
            </div>
            <Link
              to="/login/hospital"
              className="font-label-md text-label-md text-primary font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>Switch to Hospital Login</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Right: crimson panel */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl bg-gradient-to-br from-primary-container via-primary to-on-primary-fixed p-6 sm:p-8 lg:p-10 text-on-primary shadow-xl shadow-primary-container/20 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-on-primary/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-10 left-0 w-44 h-44 rounded-full bg-tertiary-fixed/15 blur-2xl pointer-events-none"></div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-on-primary/15 backdrop-blur-md text-on-primary font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-sm text-tertiary-fixed">
                  volunteer_activism
                </span>
                <span>RedSync Community Network</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-on-primary/20 backdrop-blur-md flex items-center justify-center text-on-primary">
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  water_drop
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg leading-tight font-bold tracking-tight">
                Your blood drop creates a heartbeat.
              </h2>
              <p className="font-body-lg text-body-lg text-on-primary-container/95">
                Your blood donation can save up to three lives.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-on-primary/10 backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2 text-on-primary font-title-md text-title-md font-semibold">
                <span className="material-symbols-outlined text-xl text-tertiary-fixed">fact_check</span>
                <span>Quick Donor Eligibility</span>
              </div>
              <div className="space-y-3 font-body-md text-body-md text-on-primary">
                {eligibility.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-base text-tertiary-fixed">
                      check_circle
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}