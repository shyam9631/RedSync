import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field, ErrorText, PhoneInput, inputClass } from '../../components/forms/FormBits'

const steps = ['Facility', 'Location & Contact', 'Blood Services', 'Staff Account']

const facilityTypes = [
  { val: 'hospital', label: 'Hospital', icon: 'apartment' },
  { val: 'blood_bank', label: 'Blood Bank', icon: 'water_drop' },
  { val: 'both', label: 'Both', icon: 'domain_add' },
]

const componentOptions = ['Whole Blood', 'Packed Red Cells', 'Platelets', 'Plasma']

const features = [
  {
    icon: 'inventory_2',
    title: 'Update blood stock for each blood group',
    text: 'Keep availability current across red cell, plasma and platelet reserves.',
  },
  {
    icon: 'campaign',
    title: 'Post urgent blood requests',
    text: 'Send urgent needs to eligible donors near your facility.',
  },
  {
    icon: 'group',
    title: 'See registered donors in your area',
    text: 'View donors by location and blood group compatibility.',
  },
]

const initialForm = {
  name: '',
  type: 'hospital',
  regNumber: '',
  year: '',
  address: '',
  city: '',
  state: '',
  pin: '',
  phone: '',
  emergencyPhone: '',
  email: '',
  website: '',
  components: [],
  open24: true,
  openTime: '08:00',
  closeTime: '20:00',
  contactName: '',
  staffMobile: '',
  staffEmail: '',
  password: '',
  confirm: '',
  authorized: false,
}

const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v)
const phoneOk = (v) => v.length >= 10 && v.length <= 11

function passwordStrength(p) {
  if (!p) return { score: 0, label: '' }
  let score = 0
  if (p.length >= 8) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}

export default function HospitalRegister() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [showPwd, setShowPwd] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef(null)

  const currentYear = new Date().getFullYear()
  const strength = passwordStrength(form.password)

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => {
      if (!e[name]) return e
      const next = { ...e }
      delete next[name]
      return next
    })
  }

  const toggleComponent = (c) => {
    set(
      'components',
      form.components.includes(c)
        ? form.components.filter((x) => x !== c)
        : [...form.components, c]
    )
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const okType = f.type === 'application/pdf' || f.type.startsWith('image/')
    if (!okType) {
      setErrors((er) => ({ ...er, file: 'Upload a PDF or an image file.' }))
      e.target.value = ''
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrors((er) => ({ ...er, file: 'The file must be 10 MB or smaller.' }))
      e.target.value = ''
      return
    }
    setFile(f)
    setErrors((er) => {
      const next = { ...er }
      delete next.file
      return next
    })
  }

  const removeFile = () => {
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const validate = (s) => {
    const e = {}
    if (s === 1) {
      if (form.name.trim().length < 2) e.name = 'Enter the facility name.'
      if (form.regNumber.trim().length < 4) e.regNumber = 'Enter your registration or license number.'
      if (!file) e.file = 'Upload your license document.'
      if (form.year) {
        const y = Number(form.year)
        if (!Number.isInteger(y) || y < 1800 || y > currentYear)
          e.year = `Enter a year between 1800 and ${currentYear}.`
      }
    }
    if (s === 2) {
      if (form.address.trim().length < 6) e.address = 'Enter the full street address.'
      if (!form.city.trim()) e.city = 'Enter the city.'
      if (!form.state.trim()) e.state = 'Enter the state.'
      if (!/^\d{6}$/.test(form.pin)) e.pin = 'Enter a valid 6-digit PIN code.'
      if (!phoneOk(form.phone)) e.phone = 'Enter a valid phone number (include the area code).'
      if (!phoneOk(form.emergencyPhone)) e.emergencyPhone = 'Enter a valid emergency number.'
      if (!emailOk(form.email)) e.email = 'Enter a valid official email.'
      if (form.website && !/^https?:\/\/\S+\.\S+/.test(form.website))
        e.website = 'Enter the full address, starting with https://'
    }
    if (s === 3) {
      if (form.components.length === 0) e.components = 'Select at least one component.'
      if (!form.open24) {
        if (!form.openTime || !form.closeTime) e.hours = 'Enter opening and closing times.'
        else if (form.openTime === form.closeTime)
          e.hours = 'Opening and closing times must be different.'
      }
    }
    if (s === 4) {
      if (form.contactName.trim().length < 3) e.contactName = 'Enter the contact person name and designation.'
      if (!/^[6-9]\d{9}$/.test(form.staffMobile)) e.staffMobile = 'Enter a valid 10-digit mobile number.'
      if (!emailOk(form.staffEmail)) e.staffEmail = 'Enter a valid staff login email.'
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
        e.password = 'Use at least 8 characters with letters and numbers.'
      if (form.confirm !== form.password) e.confirm = 'Passwords do not match.'
      if (!form.authorized) e.authorized = 'Please confirm to submit your application.'
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

    // Demo submission: nothing is saved yet. The backend call goes here later.
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const back = () => {
    setErrors({})
    if (step > 1) goTo(step - 1)
  }

  const pillClass = (n) =>
    n === step
      ? 'bg-primary-container text-on-primary'
      : n < step
      ? 'bg-surface-container-highest text-on-surface cursor-pointer'
      : 'bg-surface-container text-secondary cursor-default'

  return (
    <div className="w-full max-w-[1440px] mx-auto px-margin py-space-lg flex flex-col">
      <header className="w-full flex items-center justify-between mb-space-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-space-xs text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Portal Selection
        </Link>
        <Link to="/" className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[18px]">local_hospital</span>
          </div>
          <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">RedSync</span>
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-8 items-start pb-8">
        {/* LEFT */}
        <div className="col-span-12 lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm p-8 sm:p-10">
          {submitted ? (
            <div className="py-8 px-4 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6 text-secondary">
                <span className="material-symbols-outlined text-[44px]">schedule</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container mb-4">
                <span className="w-2 h-2 rounded-full bg-outline"></span>
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Pending approval
                </span>
              </div>
              <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mb-3">
                Application submitted
              </h2>
              <p className="font-body-lg text-body-lg text-secondary max-w-lg mb-8 leading-relaxed">
                We will review your details and email you once your account is approved. Your
                facility code will be sent with the approval.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
                <Link
                  to="/"
                  className="w-full sm:w-auto text-center rounded-full px-8 py-3.5 bg-surface-container hover:bg-secondary-container text-on-surface font-label-md text-label-md transition-colors"
                >
                  Back to Home
                </Link>
                <Link
                  to="/login/hospital"
                  className="w-full sm:w-auto text-center rounded-full px-8 py-3.5 bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-transform hover:-translate-y-0.5 shadow-sm"
                >
                  Hospital Login
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Stepper */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">
                    Step {step} of 4
                  </span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden mb-6">
                  <div
                    className="bg-primary-container h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(step / 4) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {steps.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => i + 1 < step && goTo(i + 1)}
                      className={`py-2 px-1 rounded-lg text-left transition-colors ${pillClass(i + 1)}`}
                    >
                      <span className="block font-label-sm text-label-sm opacity-80">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="block font-label-md text-label-md truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form
                className="space-y-6"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  next()
                }}
              >
                {/* STEP 1 */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                        Facility Details
                      </h2>
                      <p className="font-body-md text-body-md text-secondary">
                        Enter the official identity and licensing details of your facility.
                      </p>
                    </div>

                    <Field label="Facility name" htmlFor="facility-name" required error={errors.name}>
                      <input
                        id="facility-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="e.g. City General Hospital"
                        className={inputClass(errors.name)}
                      />
                    </Field>

                    <div>
                      <span className="block font-label-md text-label-md text-on-surface mb-1">
                        Type <span className="text-error">*</span>
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {facilityTypes.map((t) => (
                          <button
                            key={t.val}
                            type="button"
                            onClick={() => set('type', t.val)}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all cursor-pointer ${
                              form.type === t.val
                                ? 'bg-primary-container text-on-primary shadow-sm'
                                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                            }`}
                          >
                            <span className="material-symbols-outlined mb-1 text-[24px]">{t.icon}</span>
                            <span className="font-title-md text-title-md font-semibold">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Field
                      label="Registration / license number"
                      htmlFor="reg-number"
                      required
                      error={errors.regNumber}
                    >
                      <input
                        id="reg-number"
                        type="text"
                        value={form.regNumber}
                        onChange={(e) => set('regNumber', e.target.value)}
                        placeholder="Your registration or license number"
                        className={inputClass(errors.regNumber)}
                      />
                    </Field>

                    <div>
                      <span className="block font-label-md text-label-md text-on-surface mb-1">
                        License document upload <span className="text-error">*</span>
                      </span>
                      <input
                        ref={fileRef}
                        id="license-file"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleFile}
                        className="sr-only"
                      />
                      {file ? (
                        <div className="flex items-center justify-between gap-3 bg-surface-container-low p-4 rounded-xl">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="material-symbols-outlined text-primary">description</span>
                            <div className="min-w-0">
                              <p className="font-body-md text-body-md text-on-surface truncate">{file.name}</p>
                              <p className="font-body-sm text-body-sm text-secondary">
                                {(file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeFile}
                            className="font-label-md text-label-md text-primary hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="license-file"
                          className={`bg-surface-container-low hover:bg-surface-container p-6 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                            errors.file ? 'ring-2 ring-error' : ''
                          }`}
                        >
                          <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center mb-3 text-primary">
                            <span className="material-symbols-outlined text-[24px]">upload_file</span>
                          </div>
                          <p className="font-body-md text-body-md text-on-surface font-medium mb-1">
                            Upload registration or clinical license (PDF or image up to 10 MB)
                          </p>
                          <span className="mt-2 px-5 py-2 rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md">
                            Browse files
                          </span>
                        </label>
                      )}
                      <ErrorText>{errors.file}</ErrorText>
                    </div>

                    <Field label="Year established" htmlFor="year-established" optional error={errors.year}>
                      <input
                        id="year-established"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={form.year}
                        onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 1998"
                        className={inputClass(errors.year)}
                      />
                    </Field>
                  </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                        Location & Contact
                      </h2>
                      <p className="font-body-md text-body-md text-secondary">
                        Add your address and contact details so patients and donors can reach you.
                      </p>
                    </div>

                    <Field label="Full street address" htmlFor="street-address" required error={errors.address}>
                      <textarea
                        id="street-address"
                        rows={2}
                        value={form.address}
                        onChange={(e) => set('address', e.target.value)}
                        placeholder="Building name, street, area, landmark"
                        className={`w-full p-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-secondary focus:outline-none focus:bg-surface-container-lowest font-body-md text-body-md transition-all resize-none ${
                          errors.address ? 'ring-2 ring-error' : 'focus:ring-2 focus:ring-primary-container'
                        }`}
                      />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="City" htmlFor="city" required error={errors.city}>
                        <input
                          id="city"
                          type="text"
                          value={form.city}
                          onChange={(e) => set('city', e.target.value)}
                          placeholder="e.g. Bengaluru"
                          className={inputClass(errors.city)}
                        />
                      </Field>
                      <Field label="State" htmlFor="state" required error={errors.state}>
                        <input
                          id="state"
                          type="text"
                          value={form.state}
                          onChange={(e) => set('state', e.target.value)}
                          placeholder="e.g. Karnataka"
                          className={inputClass(errors.state)}
                        />
                      </Field>
                      <Field label="PIN code" htmlFor="pincode" required error={errors.pin}>
                        <input
                          id="pincode"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={form.pin}
                          onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 560001"
                          className={inputClass(errors.pin)}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Official phone number" htmlFor="phone-official" required error={errors.phone}>
                        <PhoneInput
                          id="phone-official"
                          value={form.phone}
                          onChange={(v) => set('phone', v)}
                          placeholder="80 2222 3333"
                          error={errors.phone}
                        />
                      </Field>
                      <Field
                        label="24x7 emergency number"
                        htmlFor="phone-emergency"
                        required
                        error={errors.emergencyPhone}
                      >
                        <PhoneInput
                          id="phone-emergency"
                          value={form.emergencyPhone}
                          onChange={(v) => set('emergencyPhone', v)}
                          placeholder="98765 43210"
                          error={errors.emergencyPhone}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Official email" htmlFor="email-official" required error={errors.email}>
                        <input
                          id="email-official"
                          type="email"
                          value={form.email}
                          onChange={(e) => set('email', e.target.value)}
                          placeholder="bloodbank@yourhospital.org"
                          className={inputClass(errors.email)}
                        />
                      </Field>
                      <Field label="Website" htmlFor="website-url" optional error={errors.website}>
                        <input
                          id="website-url"
                          type="url"
                          value={form.website}
                          onChange={(e) => set('website', e.target.value)}
                          placeholder="https://yourhospital.org"
                          className={inputClass(errors.website)}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                        Blood Services
                      </h2>
                      <p className="font-body-md text-body-md text-secondary">
                        Tell us which blood components you handle and when you are open.
                      </p>
                    </div>

                    <div>
                      <span className="block font-label-md text-label-md text-on-surface mb-3">
                        Components handled <span className="text-error">*</span>
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {componentOptions.map((c) => {
                          const on = form.components.includes(c)
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => toggleComponent(c)}
                              className={`flex items-center justify-between p-3.5 rounded-xl transition-all font-label-md text-label-md cursor-pointer ${
                                on
                                  ? 'bg-primary-container text-on-primary'
                                  : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                              }`}
                            >
                              <span>{c}</span>
                              <span className="material-symbols-outlined text-[18px]">
                                {on ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <ErrorText>{errors.components}</ErrorText>
                    </div>

                    <div className="space-y-4 pt-2">
                      <span className="block font-label-md text-label-md text-on-surface">
                        Operating hours
                      </span>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[20px]">schedule</span>
                          </div>
                          <div>
                            <span className="block font-title-md text-title-md font-semibold text-on-surface">
                              Open 24 hours
                            </span>
                            <span className="block font-body-sm text-body-sm text-secondary">
                              Blood issue desk runs round the clock
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={form.open24}
                          onClick={() => set('open24', !form.open24)}
                          className={`w-12 h-6 rounded-full relative p-0.5 transition-colors focus:outline-none cursor-pointer ${
                            form.open24 ? 'bg-primary-container' : 'bg-surface-container-highest'
                          }`}
                        >
                          <span
                            className={`block w-5 h-5 rounded-full shadow-sm transition-transform ${
                              form.open24
                                ? 'bg-on-primary translate-x-6'
                                : 'bg-on-surface translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {!form.open24 && (
                        <div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label
                                htmlFor="opening-time"
                                className="block font-label-md text-label-md text-secondary"
                              >
                                Opening time
                              </label>
                              <input
                                id="opening-time"
                                type="time"
                                value={form.openTime}
                                onChange={(e) => set('openTime', e.target.value)}
                                className={inputClass(errors.hours)}
                              />
                            </div>
                            <div className="space-y-2">
                              <label
                                htmlFor="closing-time"
                                className="block font-label-md text-label-md text-secondary"
                              >
                                Closing time
                              </label>
                              <input
                                id="closing-time"
                                type="time"
                                value={form.closeTime}
                                onChange={(e) => set('closeTime', e.target.value)}
                                className={inputClass(errors.hours)}
                              />
                            </div>
                          </div>
                          <ErrorText>{errors.hours}</ErrorText>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 4 */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                        Staff Account
                      </h2>
                      <p className="font-body-md text-body-md text-secondary">
                        Create the login for the person who will manage your blood stock.
                      </p>
                    </div>

                    <Field
                      label="Contact person name and designation"
                      htmlFor="contact-person"
                      required
                      error={errors.contactName}
                    >
                      <input
                        id="contact-person"
                        type="text"
                        value={form.contactName}
                        onChange={(e) => set('contactName', e.target.value)}
                        placeholder="e.g. Dr. Rajesh Khanna, Blood Bank Officer"
                        className={inputClass(errors.contactName)}
                      />
                    </Field>

                    <Field
                      label="Contact person mobile number"
                      htmlFor="staff-mobile"
                      required
                      error={errors.staffMobile}
                    >
                      <PhoneInput
                        id="staff-mobile"
                        value={form.staffMobile}
                        onChange={(v) => set('staffMobile', v)}
                        placeholder="98765 43210"
                        error={errors.staffMobile}
                        maxLength={10}
                      />
                    </Field>

                    <Field label="Staff login email" htmlFor="staff-email" required error={errors.staffEmail}>
                      <input
                        id="staff-email"
                        type="email"
                        value={form.staffEmail}
                        onChange={(e) => set('staffEmail', e.target.value)}
                        placeholder="staff@yourhospital.org"
                        className={inputClass(errors.staffEmail)}
                      />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Password" htmlFor="password-input" required error={errors.password}>
                        <div className="relative flex items-center">
                          <input
                            id="password-input"
                            type={showPwd ? 'text' : 'password'}
                            value={form.password}
                            onChange={(e) => set('password', e.target.value)}
                            className={`${inputClass(errors.password)} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd(!showPwd)}
                            className="absolute right-3 text-secondary hover:text-on-surface cursor-pointer"
                            aria-label="Toggle password visibility"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {showPwd ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                      </Field>
                      <Field
                        label="Confirm password"
                        htmlFor="confirm-password-input"
                        required
                        error={errors.confirm}
                      >
                        <input
                          id="confirm-password-input"
                          type={showPwd ? 'text' : 'password'}
                          value={form.confirm}
                          onChange={(e) => set('confirm', e.target.value)}
                          className={inputClass(errors.confirm)}
                        />
                      </Field>
                    </div>

                    {form.password && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-body-sm text-body-sm text-secondary">Password strength</span>
                          <span className="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-wide">
                            {strength.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 h-1.5">
                          {[1, 2, 3, 4].map((n) => (
                            <div
                              key={n}
                              className={`rounded-full h-full ${
                                n <= strength.score
                                  ? strength.score <= 1
                                    ? 'bg-error'
                                    : strength.score === 2
                                    ? 'bg-amber-500'
                                    : 'bg-tertiary-container'
                                  : 'bg-surface-container-high'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={form.authorized}
                          onChange={(e) => set('authorized', e.target.checked)}
                          className="mt-0.5 w-5 h-5 rounded accent-primary-container cursor-pointer"
                        />
                        <span className="font-body-md text-body-md text-on-surface select-none">
                          I confirm these details are accurate and I am authorized to register this
                          facility.
                        </span>
                      </label>
                      <ErrorText>{errors.authorized}</ErrorText>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="pt-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={back}
                    disabled={step === 1}
                    className="rounded-full px-8 py-3.5 bg-surface-container hover:bg-secondary-container text-on-surface font-label-md text-label-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="rounded-full px-8 py-3.5 bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-transform hover:-translate-y-0.5 shadow-sm cursor-pointer"
                  >
                    {step === 4 ? 'Submit Application' : 'Continue'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* RIGHT */}
        <div className="col-span-12 lg:col-span-5 bg-inverse-surface text-inverse-on-surface rounded-xl shadow-md p-8 sm:p-10 flex flex-col justify-between min-h-[600px] relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-tertiary/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary mb-4 shadow-sm">
                <span className="material-symbols-outlined text-[22px]">hub</span>
              </div>
              <h1 className="font-headline-md text-headline-md text-inverse-on-surface font-bold tracking-tight mb-2">
                Join RedSync
              </h1>
              <p className="font-body-md text-body-md text-surface-dim">
                Keep your blood stock up to date and reach donors faster.
              </p>
            </div>

            <div className="space-y-5">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-inverse-on-surface/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-primary-fixed text-[20px]">{f.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-title-md text-title-md text-inverse-on-surface font-semibold">
                      {f.title}
                    </p>
                    <p className="font-body-sm text-body-sm text-surface-dim mt-0.5">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface-container-highest/10 rounded-lg p-4 mt-8 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary-fixed text-[20px] shrink-0 mt-0.5">
                info
              </span>
              <p className="font-body-sm text-body-sm text-surface-dim leading-relaxed">
                Applications are reviewed by our team before your account goes live.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-10 border-t border-inverse-on-surface/10 flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-surface-dim">Already registered?</span>
            <Link
              to="/login/hospital"
              className="font-label-md text-label-md text-primary-fixed hover:underline"
            >
              Hospital Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}