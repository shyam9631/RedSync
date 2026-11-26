import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import { Field, inputClass } from '../../components/forms/FormBits'

const RESEND_SECONDS = 30

export default function HospitalForgotPassword() {
  const [step, setStep] = useState('details') // details | reset | done
  const [facilityCode, setFacilityCode] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [devOtp, setDevOtp] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }))

  const sendOtp = async () => {
    const er = {}
    if (!facilityCode.trim()) er.facilityCode = 'Enter your facility code.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) er.email = 'Enter your staff email.'
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    setFormError('')
    try {
      const { data } = await api.post('/auth/hospital/forgot-password', {
        facility_code: facilityCode.trim(),
        email: email.trim(),
      })
      setInfo(data.message)
      setDevOtp(data.dev_otp || '')
      setStep('reset')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setFormError('')
    setBusy(true)
    try {
      const { data } = await api.post('/auth/hospital/forgot-password', {
        facility_code: facilityCode.trim(),
        email: email.trim(),
      })
      setDevOtp(data.dev_otp || '')
      setInfo('A new OTP has been sent.')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = async (e) => {
    e.preventDefault()
    const er = {}
    if (!/^\d{6}$/.test(otp)) er.otp = 'Enter the 6-digit OTP.'
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      er.password = 'Use at least 8 characters with letters and numbers.'
    if (confirm !== password) er.confirm = 'Passwords do not match.'
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    setFormError('')
    try {
      await api.post('/auth/hospital/reset-password', {
        facility_code: facilityCode.trim(),
        email: email.trim(),
        otp,
        new_password: password,
      })
      setStep('done')
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const primary =
    'w-full h-12 disabled:opacity-60 disabled:cursor-not-allowed bg-primary hover:bg-surface-tint text-on-primary font-label-md text-label-md rounded-full flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer'

  return (
    <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-8 lg:py-14">
      <Link
        to="/login/hospital"
        className="inline-flex items-center gap-2 mb-6 text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md group"
      >
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
          arrow_back
        </span>
        Back to hospital login
      </Link>

      <div className="bg-surface-container-lowest rounded-xl shadow-md p-6 sm:p-8">
        {step === 'done' ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-tertiary-fixed text-tertiary flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Password changed</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">
              You can now sign in with your new password.
            </p>
            <Link to="/login/hospital" className={`${primary} mt-6`}>
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[24px]">lock_reset</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Reset your password</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {step === 'details'
                ? 'Enter your facility code and staff email. We will text an OTP to the contact mobile number your hospital registered with.'
                : info}
            </p>

            {step === 'details' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendOtp()
                }}
                noValidate
                className="mt-6 space-y-5"
              >
                <Field label="Facility / Hospital code" htmlFor="fp-code" required error={errors.facilityCode}>
                  <input
                    id="fp-code"
                    type="text"
                    value={facilityCode}
                    onChange={(e) => {
                      setFacilityCode(e.target.value.toUpperCase())
                      clear('facilityCode')
                    }}
                    placeholder="e.g. HSP-0001"
                    className={inputClass(errors.facilityCode)}
                  />
                </Field>
                <Field label="Staff email" htmlFor="fp-email" required error={errors.email}>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      clear('email')
                    }}
                    placeholder="e.g. dr.sharma@cityhospital.org"
                    className={inputClass(errors.email)}
                  />
                </Field>
                {formError && <p role="alert" className="font-body-md text-body-md text-error">{formError}</p>}
                <button type="submit" disabled={busy} className={primary}>
                  {busy ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={reset} noValidate className="mt-6 space-y-5">
                {devOtp && (
                  <p className="rounded-lg bg-amber-100 text-amber-900 px-3 py-2 font-body-sm text-body-sm">
                    Development mode: your OTP is <strong>{devOtp}</strong>
                  </p>
                )}
                <Field label="6-digit OTP" htmlFor="fp-otp" required error={errors.otp}>
                  <input
                    id="fp-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ''))
                      clear('otp')
                    }}
                    className={inputClass(errors.otp)}
                  />
                </Field>
                <Field label="New password" htmlFor="fp-pass" required error={errors.password}>
                  <div className="relative">
                    <input
                      id="fp-pass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        clear('password')
                      }}
                      className={`${inputClass(errors.password)} pr-20`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm new password" htmlFor="fp-confirm" required error={errors.confirm}>
                  <input
                    id="fp-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value)
                      clear('confirm')
                    }}
                    className={inputClass(errors.confirm)}
                  />
                </Field>
                {formError && <p role="alert" className="font-body-md text-body-md text-error">{formError}</p>}
                <button type="submit" disabled={busy} className={primary}>
                  {busy ? 'Saving…' : 'Change password'}
                </button>
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('details')
                      setOtp('')
                      setFormError('')
                    }}
                    className="text-secondary hover:text-primary cursor-pointer"
                  >
                    Change details
                  </button>
                  <button
                    type="button"
                    disabled={wait > 0 || busy}
                    onClick={resend}
                    className="text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    {wait > 0 ? `Resend OTP in ${wait}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}