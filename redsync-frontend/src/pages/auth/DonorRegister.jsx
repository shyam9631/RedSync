import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Field, ErrorText, inputClass } from '../../components/forms/FormBits'

const stepTitles = [
  '1. Account Information',
  '2. Personal Details',
  '3. Location Details',
  '4. Preferences & Health Check',
]
const stepLabels = ['Account', 'Personal', 'Location', 'Preferences']
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const genders = ['Male', 'Female', 'Other']
const radii = [5, 10, 15, 25]

// Sample names only. Real hospitals will come from the backend.
const sampleHospitals = [
  'City General Hospital (sample)',
  'Lifeline Blood Bank (sample)',
  'Community Care Hospital (sample)',
]

const healthQuestions = [
  { key: 'wellToday', label: 'Feeling well today?' },
  { key: 'recentIllness', label: 'Any illness, fever or surgery in the last 3 months?' },
  { key: 'antibiotics', label: 'Currently taking antibiotics?' },
]

const initialForm = {
  fullName: '',
  phone: '',
  email: '',
  agree: false,
  dob: '',
  gender: '',
  weight: '',
  bloodGroup: '',
  city: '',
  area: '',
  pin: '',
  radius: 10,
  lastDonation: '',
  neverDonated: false,
  wellToday: null,
  recentIllness: null,
  antibiotics: null,
  hospital: '',
  sms: true,
  whatsapp: true,
}

function getAge(dob) {
  const b = new Date(dob)
  const t = new Date()
  let age = t.getFullYear() - b.getFullYear()
  const m = t.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--
  return age
}

function nextEligibleText(lastDonation, neverDonated, gender) {
  if (neverDonated || !lastDonation) return 'Eligible now'
  const gap = gender === 'Female' ? 120 : 90
  const d = new Date(lastDonation)
  d.setDate(d.getDate() + gap)
  if (d <= new Date()) return 'Eligible now'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function YesNo({ value, onChange }) {
  const base = 'px-4 py-1 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer'
  return (
    <div className="flex gap-1 bg-surface-container p-1 rounded-full shrink-0">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`${base} ${value === true ? 'bg-tertiary text-on-tertiary' : 'text-secondary'}`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`${base} ${
          value === false ? 'bg-secondary-container text-on-secondary-container' : 'text-secondary'
        }`}
      >
        No
      </button>
    </div>
  )
}

export default function DonorRegister() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpSent, setOtpSent] = useState(false)
  const [locMsg, setLocMsg] = useState('')
  const [done, setDone] = useState(false)
  const inputsRef = useRef([])
  const { login } = useAuth()
  const navigate = useNavigate()

  const today = new Date().toISOString().split('T')[0]

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => {
      if (!e[name]) return e
      const next = { ...e }
      delete next[name]
      return next
    })
  }

  // ---------- OTP ----------
  const sendOtp = () => {
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setErrors((e) => ({ ...e, phone: 'Enter a valid 10-digit mobile number.' }))
      return
    }
    setErrors((e) => {
      const next = { ...e }
      delete next.phone
      delete next.otp
      return next
    })
    setOtp(['', '', '', '', '', ''])
    setOtpSent(true)
    setTimeout(() => inputsRef.current[0]?.focus(), 0)
  }

  const handleOtpChange = (i, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = digit
    setOtp(next)
    setErrors((e) => ({ ...e, otp: undefined }))
    if (digit && i < 5) inputsRef.current[i + 1]?.focus()
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus()
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

  // ---------- Location ----------
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocMsg('Location is not available in this browser.')
      return
    }
    setLocMsg('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      () => setLocMsg('Location captured. You will get requests near you.'),
      () =>
        setLocMsg(
          'Could not get your location. You can still continue by entering your area and PIN code.'
        ),
      { timeout: 10000 }
    )
  }

  // ---------- Validation ----------
  const validate = (s) => {
    const e = {}
    if (s === 1) {
      if (form.fullName.trim().length < 2) e.fullName = 'Enter your full name.'
      if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number.'
      if (!otpSent) e.otp = 'Tap Send OTP to receive your code.'
      else if (otp.join('').length !== 6) e.otp = 'Enter the 6-digit code.'
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address.'
      if (!form.agree) e.agree = 'Please accept the terms to continue.'
    }
    if (s === 2) {
      if (!form.dob) e.dob = 'Enter your date of birth.'
      else if (new Date(form.dob) > new Date()) e.dob = 'Date of birth cannot be in the future.'
      else {
        const age = getAge(form.dob)
        if (age < 18 || age > 65) e.dob = 'You must be between 18 and 65 years old to donate.'
      }
      if (!form.gender) e.gender = 'Select your gender.'
      const w = Number(form.weight)
      if (!form.weight) e.weight = 'Enter your weight in kg.'
      else if (w > 200 || w <= 0) e.weight = 'Enter a valid weight.'
      else if (w <= 50) e.weight = 'Weight must be above 50 kg to donate.'
      if (!form.bloodGroup) e.bloodGroup = 'Select your blood group.'
    }
    if (s === 3) {
      if (!form.city.trim()) e.city = 'Enter your city.'
      if (!form.area.trim()) e.area = 'Enter your area or locality.'
      if (!/^\d{6}$/.test(form.pin)) e.pin = 'Enter a valid 6-digit PIN code.'
    }
    if (s === 4) {
      if (!form.neverDonated) {
        if (!form.lastDonation)
          e.lastDonation = 'Enter your last donation date, or tick "I have never donated".'
        else if (new Date(form.lastDonation) > new Date())
          e.lastDonation = 'The date cannot be in the future.'
      }
      if (healthQuestions.some((q) => form[q.key] === null))
        e.health = 'Please answer all three health questions.'
      if (!form.sms && !form.whatsapp) e.alerts = 'Choose at least one alert channel.'
    }
    return e
  }

  const goTo = (n) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = () => {
    const e = validate(step)
    setErrors(e)
    if (Object.keys(e).length) return
    if (step < 4) return goTo(step + 1)

    // Demo registration: nothing is saved yet. The backend call goes here later.
    login({
      role: 'donor',
      name: form.fullName.trim().split(' ')[0],
      phone: form.phone,
    })
    setDone(true)
  }

  const back = () => {
    setErrors({})
    if (step > 1) goTo(step - 1)
  }

  const healthFlag =
    form.wellToday === false || form.recentIllness === true || form.antibiotics === true

  return (
    <div className="w-full max-w-[1440px] mx-auto px-margin py-space-lg flex flex-col">
      <header className="w-full flex items-center justify-between mb-space-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors group"
        >
          <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-0.5">
            arrow_back
          </span>
          <span>Back to Portal Selection</span>
        </Link>
        <Link to="/" className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary-container text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            water_drop
          </span>
          <span className="font-headline-sm text-headline-sm text-primary tracking-tight">
            RedSync
          </span>
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start w-full">
        {/* LEFT: form */}
        <div className="lg:col-span-7 w-full bg-surface-container-lowest rounded-xl shadow-sm p-6 sm:p-8 md:p-10 flex flex-col justify-between">
          <div>
            {/* Stepper */}
            <div className="mb-space-lg">
              <div className="flex items-center justify-between mb-space-sm">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {stepTitles[step - 1]}
                </span>
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Step {step} of 4
                </span>
              </div>
              <div className="grid grid-cols-4 gap-space-xs mb-space-sm">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 rounded-full transition-colors duration-300 ${
                      n <= step ? 'bg-primary-container' : 'bg-surface-container-high'
                    }`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 text-center">
                {stepLabels.map((l, i) => (
                  <span
                    key={l}
                    className={`font-label-sm text-label-sm ${
                      i + 1 === step ? 'text-primary font-semibold' : 'text-secondary'
                    }`}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                next()
              }}
              noValidate
            >
              {/* STEP 1 */}
              {step === 1 && (
                <div className="flex flex-col gap-space-md">
                  <Field label="Full Name" htmlFor="full-name" required error={errors.fullName}>
                    <input
                      id="full-name"
                      type="text"
                      value={form.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      placeholder="E.g. Siddharth Sharma"
                      className={inputClass(errors.fullName)}
                    />
                  </Field>

                  <div>
                    <label
                      htmlFor="mobile-phone"
                      className="block font-label-md text-label-md text-on-surface mb-1"
                    >
                      Mobile Number <span className="text-error">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3.5 bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md select-none">
                        +91
                      </div>
                      <input
                        id="mobile-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))}
                        placeholder="98765 43210"
                        className={`flex-1 min-w-0 ${inputClass(errors.phone)}`}
                      />
                      <button
                        type="button"
                        onClick={sendOtp}
                        className="px-5 h-12 rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-secondary-container transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    </div>
                    <ErrorText>{errors.phone}</ErrorText>
                  </div>

                  <div>
                    <span className="block font-label-sm text-label-sm text-secondary mb-2">
                      {otpSent
                        ? 'Enter the 6-digit OTP code sent to your phone'
                        : 'Your 6-digit OTP code will appear here after you tap Send OTP'}
                    </span>
                    <div
                      className="grid grid-cols-6 gap-2 sm:gap-3 max-w-sm"
                      onPaste={handleOtpPaste}
                    >
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
                          className={`h-12 text-center rounded-lg bg-surface-container-low text-on-surface font-title-md text-title-md font-bold focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-60 ${
                            errors.otp ? 'ring-2 ring-error' : ''
                          }`}
                        />
                      ))}
                    </div>
                    {otpSent && (
                      <p className="font-body-sm text-body-sm text-secondary mt-2">
                        Demo mode: any 6-digit code works until the backend is connected.
                      </p>
                    )}
                    <ErrorText>{errors.otp}</ErrorText>
                  </div>

                  <Field label="Email Address" htmlFor="email-field" optional error={errors.email}>
                    <input
                      id="email-field"
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="siddharth@example.com"
                      className={inputClass(errors.email)}
                    />
                  </Field>

                  <div>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.agree}
                        onChange={(e) => set('agree', e.target.checked)}
                        className="mt-1 w-4 h-4 rounded accent-primary-container"
                      />
                      <span className="font-body-md text-body-md text-on-surface-variant">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" className="text-primary hover:underline">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                          Privacy Policy
                        </Link>
                      </span>
                    </label>
                    <ErrorText>{errors.agree}</ErrorText>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="flex flex-col gap-space-md">
                  <Field label="Date of Birth" htmlFor="dob-input" required error={errors.dob}>
                    <input
                      id="dob-input"
                      type="date"
                      max={today}
                      value={form.dob}
                      onChange={(e) => set('dob', e.target.value)}
                      className={inputClass(errors.dob)}
                    />
                  </Field>

                  <div>
                    <span className="block font-label-md text-label-md text-on-surface mb-2">
                      Gender <span className="text-error">*</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {genders.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => set('gender', g)}
                          className={`h-11 rounded-lg font-label-md text-label-md text-center transition-colors cursor-pointer ${
                            form.gender === g
                              ? 'bg-primary-container text-on-primary font-semibold'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <ErrorText>{errors.gender}</ErrorText>
                  </div>

                  <Field label="Weight" htmlFor="weight-input" required error={errors.weight}>
                    <div className="relative flex items-center">
                      <input
                        id="weight-input"
                        type="number"
                        inputMode="decimal"
                        value={form.weight}
                        onChange={(e) => set('weight', e.target.value)}
                        placeholder="68"
                        className={`${inputClass(errors.weight)} pr-12`}
                      />
                      <span className="absolute right-4 font-body-md text-body-md text-secondary select-none">
                        kg
                      </span>
                    </div>
                  </Field>

                  <div>
                    <span className="block font-label-md text-label-md text-on-surface mb-2">
                      Select Blood Group <span className="text-error">*</span>
                    </span>
                    <div className="grid grid-cols-4 gap-3">
                      {bloodGroups.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => set('bloodGroup', g)}
                          className={`h-12 rounded-full font-badge-blood-group text-badge-blood-group flex items-center justify-center transition-colors cursor-pointer ${
                            form.bloodGroup === g
                              ? 'bg-primary-container text-on-primary shadow-sm ring-2 ring-primary-container ring-offset-2'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <ErrorText>{errors.bloodGroup}</ErrorText>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="flex flex-col gap-space-md">
                  <Field label="City" htmlFor="city-input" required error={errors.city}>
                    <input
                      id="city-input"
                      type="text"
                      value={form.city}
                      onChange={(e) => set('city', e.target.value)}
                      placeholder="Bengaluru"
                      className={inputClass(errors.city)}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                    <Field label="Area / Locality" htmlFor="area-input" required error={errors.area}>
                      <input
                        id="area-input"
                        type="text"
                        value={form.area}
                        onChange={(e) => set('area', e.target.value)}
                        placeholder="Indiranagar"
                        className={inputClass(errors.area)}
                      />
                    </Field>
                    <Field label="PIN Code" htmlFor="pin-input" required error={errors.pin}>
                      <input
                        id="pin-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={form.pin}
                        onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))}
                        placeholder="560038"
                        className={inputClass(errors.pin)}
                      />
                    </Field>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={captureLocation}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container text-primary font-label-md text-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">my_location</span>
                      <span>Use my current location</span>
                    </button>
                    {locMsg && (
                      <p className="font-body-sm text-body-sm text-secondary mt-2">{locMsg}</p>
                    )}
                  </div>

                  <div>
                    <span className="block font-label-md text-label-md text-on-surface mb-2">
                      Maximum Notification Radius
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {radii.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => set('radius', r)}
                          className={`py-2.5 rounded-full font-label-md text-label-md text-center transition-colors cursor-pointer ${
                            form.radius === r
                              ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <div className="flex flex-col gap-space-md">
                  <div>
                    <label
                      htmlFor="last-donation"
                      className="block font-label-md text-label-md text-on-surface mb-1"
                    >
                      Last Blood Donation Date
                    </label>
                    <input
                      id="last-donation"
                      type="date"
                      max={today}
                      disabled={form.neverDonated}
                      value={form.lastDonation}
                      onChange={(e) => set('lastDonation', e.target.value)}
                      className={`${inputClass(errors.lastDonation)} disabled:opacity-50`}
                    />
                    <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.neverDonated}
                        onChange={(e) => {
                          set('neverDonated', e.target.checked)
                          if (e.target.checked) set('lastDonation', '')
                        }}
                        className="w-4 h-4 rounded accent-primary-container"
                      />
                      <span className="font-body-sm text-body-sm text-secondary">
                        I have never donated before
                      </span>
                    </label>
                    <ErrorText>{errors.lastDonation}</ErrorText>
                  </div>

                  <div className="space-y-3 p-4 rounded-lg bg-surface-container-low">
                    <span className="block font-label-md text-label-md text-on-surface">
                      Health Quick-Check
                    </span>
                    {healthQuestions.map((q) => (
                      <div key={q.key} className="flex items-center justify-between gap-3">
                        <span className="font-body-md text-body-md text-on-surface-variant">
                          {q.label}
                        </span>
                        <YesNo value={form[q.key]} onChange={(v) => set(q.key, v)} />
                      </div>
                    ))}
                    <ErrorText>{errors.health}</ErrorText>
                  </div>

                  <div>
                    <label
                      htmlFor="preferred-hospital"
                      className="block font-label-md text-label-md text-on-surface mb-1"
                    >
                      Preferred Hospital / Blood Bank{' '}
                      <span className="font-body-sm text-body-sm text-secondary font-normal">
                        (optional)
                      </span>
                    </label>
                    <select
                      id="preferred-hospital"
                      value={form.hospital}
                      onChange={(e) => set('hospital', e.target.value)}
                      className={inputClass(false)}
                    >
                      <option value="">Select preferred hospital or blood bank</option>
                      {sampleHospitals.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block font-label-md text-label-md text-on-surface mb-2">
                      Emergency Notification Channel <span className="text-error">*</span>
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'sms', label: 'SMS Alert' },
                        { key: 'whatsapp', label: 'WhatsApp' },
                      ].map((c) => (
                        <label
                          key={c.key}
                          className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low cursor-pointer"
                        >
                          <span className="font-label-md text-label-md text-on-surface">
                            {c.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={form[c.key]}
                            onChange={(e) => set(c.key, e.target.checked)}
                            className="w-4 h-4 rounded accent-primary-container"
                          />
                        </label>
                      ))}
                    </div>
                    <ErrorText>{errors.alerts}</ErrorText>
                  </div>

                  <div className="p-3.5 rounded-lg bg-surface-container flex items-start gap-2.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">
                      lock
                    </span>
                    <p className="font-body-sm text-body-sm leading-relaxed">
                      Your phone number is shared with a requester only after you accept their
                      request.
                    </p>
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div className="pt-space-lg mt-space-lg flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={back}
                    className="px-6 py-3 rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="px-8 py-3 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:bg-primary transition-all shadow-sm cursor-pointer"
                >
                  {step === 4 ? 'Complete Registration' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT: info panel */}
        <div className="lg:col-span-5 w-full rounded-xl bg-gradient-to-br from-[#C62828] via-[#B71C1C] to-[#8E0000] text-on-primary p-8 sm:p-10 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[580px]">
          <div className="absolute -right-16 -top-16 opacity-10 pointer-events-none">
            <svg fill="currentColor" height="340" viewBox="0 0 24 24" width="340">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <div className="absolute bottom-6 right-6 opacity-10 pointer-events-none">
            <svg fill="none" height="100" stroke="currentColor" strokeWidth="3" viewBox="0 0 100 40" width="220">
              <path d="M0 20 L30 20 L38 5 L46 35 L54 10 L62 25 L68 20 L100 20" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm font-label-sm text-label-sm uppercase tracking-wide mb-space-md">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              <span>Donor Eligibility</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg font-bold leading-tight mb-space-sm">
              Your blood drop creates a heartbeat.
            </h2>
            <p className="font-body-lg text-body-lg text-white/90 mb-space-xl">
              Your blood donation can save up to three lives.
            </p>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h3 className="font-title-md text-title-md font-semibold text-white mb-space-md flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                <span>Who can donate</span>
              </h3>
              <ul className="space-y-4">
                {[
                  ['Age 18–65', 'Donors must be adults within this range.'],
                  ['Weight above 50 kg', 'Helps keep the donation safe for you.'],
                  ['At least 3 months since last donation', 'Gives your body time to recover.'],
                ].map(([title, text], i) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-white font-label-sm text-label-sm mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-label-md text-label-md text-white">{title}</p>
                      <p className="font-body-sm text-body-sm text-white/80">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative z-10 pt-6">
            <div className="flex items-center gap-3 text-white/80 font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span>Your phone number stays private until you accept a request.</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full pt-space-lg text-on-surface-variant font-body-sm text-body-sm">
        © 2026 RedSync. All rights reserved.
      </footer>

      {/* SUCCESS */}
      {done && (
        <div className="fixed inset-0 z-50 bg-on-surface/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-xl max-w-md w-full p-8 text-center flex flex-col items-center max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-tertiary-fixed flex items-center justify-center mb-space-md text-on-tertiary-fixed-variant">
              <span
                className="material-symbols-outlined text-[36px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-xs">
              You're registered
            </h3>
            <p className="font-body-md text-body-md text-secondary mb-space-lg">
              Thank you for joining as a donor. You will be alerted when a request near you matches
              your blood group.
            </p>

            <div className="w-full bg-surface-container-low rounded-xl p-5 mb-space-md flex items-center justify-between">
              <div className="text-left">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-1">
                  Status
                </span>
                <span className="font-title-md text-title-md font-semibold text-on-surface block">
                  Next eligible date
                </span>
                <span className="font-body-md text-body-md text-primary font-medium">
                  {nextEligibleText(form.lastDonation, form.neverDonated, form.gender)}
                </span>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary font-badge-blood-group text-badge-blood-group flex items-center justify-center shadow-sm">
                {form.bloodGroup}
              </div>
            </div>

            {healthFlag && (
              <p className="w-full font-body-sm text-body-sm text-on-surface-variant bg-amber-100 rounded-lg p-3 mb-space-md text-left">
                Based on your health answers, please wait until you feel well before donating. The
                hospital will confirm your eligibility.
              </p>
            )}

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/donor/dashboard')}
                className="w-full py-3 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:bg-primary transition-colors cursor-pointer"
              >
                Go to Home
              </button>
              <button
                type="button"
                onClick={() => navigate('/donor/profile')}
                className="w-full py-3 rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-secondary-container transition-colors cursor-pointer"
              >
                Update my profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}