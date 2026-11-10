import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api, { errorMessage, getStoredSession } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import { Field, ErrorText, inputClass } from '../../components/forms/FormBits'
import { DONATE_TO, formatDate } from '../../data/donorDemo'

const RADII = [5, 10, 15, 25]
const HISTORY_SHOWN = 5

// Recognitions come only from the donor's real donation count
const BADGES = [
  { icon: 'military_tech', title: 'First Drop', need: 1, note: 'First donation', tone: 'bg-primary/10 text-primary' },
  { icon: 'health_and_safety', title: 'Tri-Pledge', need: 3, note: '3 donations', tone: 'bg-primary-container/10 text-primary-container' },
  { icon: 'workspace_premium', title: 'Lifesaver', need: 5, note: '5 donations', tone: 'bg-tertiary/10 text-tertiary' },
]

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

function ageOf(dob) {
  const [y, m, d] = dob.split('-').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1
  return age
}

const rhOf = (group) => (group.endsWith('+') ? 'RhD positive (+)' : 'RhD negative (−)')

async function fetchAll() {
  const [dash, history] = await Promise.all([api.get('/donor/dashboard'), api.get('/donor/history')])
  return { profile: dash.data.profile, eligibility: dash.data.eligibility, history: history.data }
}

/* ---------- Edit profile dialog ---------- */
function EditProfileModal({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email || '')
  const [weight, setWeight] = useState(String(profile.weight_kg))
  const [city, setCity] = useState(profile.city)
  const [area, setArea] = useState(profile.area)
  const [pin, setPin] = useState(profile.pin)
  const [radius, setRadius] = useState(profile.radius_km)
  const [sms, setSms] = useState(profile.sms_alerts)
  const [wa, setWa] = useState(profile.whatsapp_alerts)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const clear = (k) => setErrors((e) => ({ ...e, [k]: undefined }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    const w = Number(weight)
    if (name.trim().length < 2) er.name = 'Enter your full name.'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) er.email = 'Enter a valid email address.'
    if (!Number.isFinite(w) || w <= 50 || w > 200) er.weight = 'Weight must be above 50 kg.'
    if (city.trim().length < 2) er.city = 'Enter your city.'
    if (area.trim().length < 2) er.area = 'Enter your area.'
    if (!/^\d{6}$/.test(pin)) er.pin = 'Enter a 6-digit PIN code.'
    if (!sms && !wa) er.channels = 'Keep at least one alert channel on.'
    setErrors(er)
    if (Object.keys(er).length) return

    setSaving(true)
    setFormError('')
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || undefined,
        weight_kg: w,
        city: city.trim(),
        area: area.trim(),
        pin,
        radius_km: radius,
        sms_alerts: sms,
        whatsapp_alerts: wa,
      })
    } catch (err) {
      setFormError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit profile"
      subtitle="Blood group, date of birth, gender and phone cannot be changed here."
      leading={
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">edit_square</span>
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" htmlFor="pf-name" required error={errors.name}>
            <input
              id="pf-name"
              type="text"
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clear('name')
              }}
              className={inputClass(errors.name)}
            />
          </Field>
          <Field label="Email" htmlFor="pf-email" optional error={errors.email}>
            <input
              id="pf-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clear('email')
              }}
              placeholder="you@example.com"
              className={inputClass(errors.email)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Weight (kg)" htmlFor="pf-weight" required error={errors.weight}>
            <input
              id="pf-weight"
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))
                clear('weight')
              }}
              className={inputClass(errors.weight)}
            />
          </Field>
          <Field label="PIN code" htmlFor="pf-pin" required error={errors.pin}>
            <input
              id="pf-pin"
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                clear('pin')
              }}
              className={inputClass(errors.pin)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="City" htmlFor="pf-city" required error={errors.city}>
            <input
              id="pf-city"
              type="text"
              maxLength={100}
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                clear('city')
              }}
              className={inputClass(errors.city)}
            />
          </Field>
          <Field label="Area" htmlFor="pf-area" required error={errors.area}>
            <input
              id="pf-area"
              type="text"
              maxLength={100}
              value={area}
              onChange={(e) => {
                setArea(e.target.value)
                clear('area')
              }}
              className={inputClass(errors.area)}
            />
          </Field>
        </div>

        <div>
          <span className="block font-label-md text-label-md text-on-surface mb-2">Alert radius</span>
          <div className="flex items-center gap-2 flex-wrap">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  radius === r
                    ? 'bg-primary-container text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block font-label-md text-label-md text-on-surface mb-2">Alert channels</span>
          <div className="flex items-center gap-5 flex-wrap">
            <label className="inline-flex items-center gap-2 cursor-pointer font-body-md text-body-md text-on-surface">
              <input
                type="checkbox"
                checked={sms}
                onChange={(e) => {
                  setSms(e.target.checked)
                  clear('channels')
                }}
                className="w-4 h-4 accent-[#c62828]"
              />
              SMS
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer font-body-md text-body-md text-on-surface">
              <input
                type="checkbox"
                checked={wa}
                onChange={(e) => {
                  setWa(e.target.checked)
                  clear('channels')
                }}
                className="w-4 h-4 accent-[#c62828]"
              />
              WhatsApp
            </label>
          </div>
          <ErrorText>{errors.channels}</ErrorText>
        </div>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
            <p className="font-body-sm text-body-sm">{formError}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary hover:bg-primary font-label-md text-label-md shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>{saving ? 'Saving…' : 'Save changes'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Small building blocks ---------- */
function SectionTitle({ icon, title, right }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-space-sm mb-space-md">
      <div className="flex items-center gap-space-xs min-w-0">
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        <h2 className="font-title-md text-title-md text-on-surface font-bold">{title}</h2>
      </div>
      {right}
    </div>
  )
}

function Attr({ label, value, note, noteClass = 'text-on-surface-variant', big }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-space-md min-w-0">
      <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant block font-semibold mb-1">
        {label}
      </span>
      <span
        className={`block truncate ${
          big
            ? 'font-headline-sm text-headline-sm text-primary font-extrabold'
            : 'font-label-md text-label-md text-on-surface font-bold'
        }`}
      >
        {value}
      </span>
      {note && <span className={`font-body-sm text-[11px] ${noteClass}`}>{note}</span>}
    </div>
  )
}

function Toggle({ id, checked, disabled, onChange }) {
  return (
    <div className="relative shrink-0 ml-4">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-12 h-7 bg-surface-container-highest rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container"></div>
    </div>
  )
}

/* ---------- Page ---------- */
export default function DonorProfile() {
  const { login } = useAuth()
  const { pathname } = useLocation()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [toast, setToast] = useState(null) // { text, error }

  useEffect(() => {
    let alive = true
    fetchAll()
      .then((d) => alive && setData(d))
      .catch((err) => alive && setLoadError(errorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [toast])

  // "Alert preferences" on the dashboard links to /donor/alerts: jump to that section
  useEffect(() => {
    if (pathname === '/donor/alerts' && data) {
      document.getElementById('alerts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [pathname, data])

  const retry = () => {
    setLoading(true)
    setLoadError('')
    fetchAll()
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false))
  }

  // Keeps the name and city in the navbar session in step with what was just saved
  const syncSession = (p) => {
    try {
      const session = getStoredSession()
      if (!session?.user) return
      login({
        token: session.token,
        user: {
          ...session.user,
          name: p.name,
          email: p.email,
          donor: {
            ...session.user.donor,
            city: p.city,
            area: p.area,
            radius_km: p.radius_km,
            weight_kg: p.weight_kg,
            available: p.available,
          },
        },
      })
    } catch {
      /* the page still shows the saved data */
    }
  }

  const save = async (changes) => {
    const res = await api.put('/donor/profile', changes)
    setData((d) => ({ ...d, profile: res.data }))
    syncSession(res.data)
  }

  // For the radius chips and channel toggles: saves at once, shows a message either way
  const quickSave = async (changes, okText) => {
    setBusy(true)
    try {
      await save(changes)
      setToast({ text: okText })
    } catch (err) {
      setToast({ text: errorMessage(err), error: true })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading your profile…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load your profile</h2>
        <p className="font-body-md text-body-md text-secondary mt-1">{loadError}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  const { profile, eligibility, history } = data
  const group = profile.blood_group
  const age = ageOf(profile.dob)
  const totalUnits = history.reduce((sum, h) => sum + h.units, 0)
  const canGiveTo = DONATE_TO[group] || []
  const elapsed = Math.max(0, eligibility.gap_days - eligibility.days_left)
  const memberSince = profile.member_since
    ? new Date(profile.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null
  const unlocked = BADGES.filter((b) => history.length >= b.need).length
  const shownHistory = showAll ? history : history.slice(0, HISTORY_SHOWN)

  return (
    <div className="relative w-full pb-8">
      {/* Page header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm mb-1 uppercase tracking-wider">
            <span className="font-semibold text-primary">RedSync</span>
            <span>/</span>
            <span>Donor</span>
            {profile.code && (
              <>
                <span>/</span>
                <span className="text-on-surface">{profile.code}</span>
              </>
            )}
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            My Profile
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
            Manage your donor details, how soon you can donate again, your alert radius and how you
            want to be alerted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-md transition-all active:scale-95 cursor-pointer self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">edit_square</span>
          <span>Edit Profile</span>
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* ================= LEFT COLUMN ================= */}
        <div className="lg:col-span-4 flex flex-col gap-space-lg">
          {/* Identity card */}
          <div className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg flex flex-col relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/5 pointer-events-none"></div>
            <div className="flex items-start justify-between gap-space-md">
              <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-headline-md text-headline-md font-bold shadow-inner">
                {initials(profile.name)}
              </div>
              <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary flex flex-col items-center justify-center shadow-md">
                <span className="font-headline-sm text-headline-sm leading-none font-extrabold tracking-tight">
                  {group}
                </span>
              </div>
            </div>

            <div className="mt-space-md min-w-0">
              <h2 className="font-headline-md text-headline-md text-on-surface truncate">{profile.name}</h2>
              <div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md mt-0.5 flex-wrap">
                <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                {profile.code && (
                  <>
                    <span className="font-semibold text-on-surface">{profile.code}</span>
                    <span>•</span>
                  </>
                )}
                <span>Registered Donor</span>
              </div>
            </div>

            <div className="mt-space-md flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md">
                <span className="relative flex h-2.5 w-2.5">
                  {profile.available && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      profile.available ? 'bg-tertiary' : 'bg-outline'
                    }`}
                  ></span>
                </span>
                <span className="font-semibold">
                  {profile.available ? 'Available to donate' : 'Not available'}
                </span>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md font-semibold ${
                  eligibility.eligible ? 'bg-tertiary/10 text-tertiary' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {eligibility.eligible ? 'check_circle' : 'hourglass_top'}
                </span>
                {eligibility.eligible ? 'Eligible now' : `Eligible in ${eligibility.days_left}d`}
              </div>
            </div>

            <div className="mt-space-lg bg-surface-container-low rounded-xl p-space-md">
              {memberSince && (
                <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm mb-3">
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  Member since {memberSince}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-container-lowest p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-primary mb-1">
                    <span className="material-symbols-outlined text-[18px]">bloodtype</span>
                    <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                      Donations
                    </span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface font-bold">
                    {history.length}
                  </div>
                  <span className="font-label-sm text-[11px] text-tertiary font-medium">
                    Confirmed by hospitals
                  </span>
                </div>
                <div className="rounded-lg bg-surface-container-lowest p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-primary-container mb-1">
                    <span className="material-symbols-outlined text-[18px]">water_drop</span>
                    <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                      Units
                    </span>
                  </div>
                  <div className="font-headline-md text-headline-md text-primary font-bold">
                    {totalUnits}
                  </div>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">Total donated</span>
                </div>
              </div>
            </div>

            {/* Donor card */}
            <div className="mt-space-lg rounded-xl bg-gradient-to-br from-primary via-primary-container to-primary text-on-primary p-4 shadow-lg relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-on-primary-container">
                    water_drop
                  </span>
                  <span className="font-headline-sm text-[14px] font-bold tracking-tight">
                    RedSync Donor Card
                  </span>
                </div>
                {profile.code && (
                  <span className="font-label-sm text-[10px] tracking-widest uppercase bg-black/25 px-2 py-0.5 rounded-full font-mono">
                    {profile.code}
                  </span>
                )}
              </div>
              <p className="font-label-sm text-[10px] uppercase text-on-primary-container font-semibold">
                Registered full name
              </p>
              <p className="font-title-md text-title-md font-bold leading-tight truncate">{profile.name}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-white/20 font-mono text-[11px] font-bold tracking-wider">
                  {group.replace('+', ' POSITIVE').replace('-', ' NEGATIVE')}
                </span>
                <span className="text-[11px] opacity-90">
                  {eligibility.eligible
                    ? 'Eligible to donate now'
                    : `Next whole blood: ${formatDate(eligibility.next_eligible)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg flex flex-col gap-space-md">
            <div className="flex items-center gap-space-sm text-on-surface">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">shield_person</span>
              </div>
              <div>
                <h3 className="font-title-md text-title-md text-on-surface leading-tight">Your privacy</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">How your details are shared</p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-container-low p-space-md flex items-start gap-2.5">
              <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">
                verified_user
              </span>
              <p className="font-body-sm text-body-sm text-on-surface leading-snug">
                <strong className="font-semibold">No cold calls:</strong> your phone number stays hidden
                from hospitals until you accept one of their requests. Declining a request shares
                nothing.
              </p>
            </div>
          </div>

          {/* Recognitions */}
          <div className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-title-md text-title-md text-on-surface">Recognitions</span>
              <span className="font-label-sm text-label-sm text-primary font-semibold">
                {unlocked} unlocked
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              {BADGES.map((b) => {
                const on = history.length >= b.need
                return (
                  <div
                    key={b.title}
                    className={`p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center gap-1 ${
                      on ? '' : 'opacity-50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        on ? b.tone : 'bg-surface-container-highest text-outline'
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[22px]"
                        style={on ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {on ? b.icon : 'lock'}
                      </span>
                    </div>
                    <span className="font-label-sm text-[11px] font-bold text-on-surface mt-1">{b.title}</span>
                    <span className="font-body-sm text-[10px] text-on-surface-variant">{b.note}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="lg:col-span-8 flex flex-col gap-space-lg min-w-0">
          {/* Personal details */}
          <div className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg">
            <SectionTitle icon="clinical_notes" title="Personal & Health Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              <Attr label="Full name" value={profile.name} note="As entered at registration" />
              <Attr
                label="Date of birth"
                value={formatDate(profile.dob)}
                note={`${age} years (eligible 18–65)`}
                noteClass="text-tertiary font-medium"
              />
              <Attr
                label="Gender"
                value={profile.gender}
                note={`Whole blood gap: ${eligibility.gap_days} days`}
              />
              <Attr
                label="Body weight"
                value={`${profile.weight_kg} kg`}
                note="Meets the 50 kg minimum"
                noteClass="text-tertiary font-medium"
              />
              <Attr
                label="Blood group"
                value={group}
                big
                note={`Can donate to: ${canGiveTo.join(', ')}`}
              />
              <Attr label="Rh factor" value={rhOf(group)} note="Taken from your blood group" />
              <Attr
                label="Last donation"
                value={profile.never_donated ? 'Never' : formatDate(profile.last_donation)}
                note={profile.never_donated ? 'No donation on record' : 'Recorded by a hospital'}
              />
              <Attr
                label="Phone"
                value={`+91 ${profile.phone}`}
                note="Verified with an OTP"
                noteClass="text-tertiary font-medium"
              />
            </div>
          </div>

          {/* Contact and alert radius */}
          <div className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg">
            <SectionTitle
              icon="share_location"
              title="Contact & Location"
              right={
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-primary hover:text-primary-container font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md mb-space-md">
              <div className="rounded-lg bg-surface-container-low p-space-md flex flex-col gap-space-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Mobile number
                </span>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">phone_iphone</span>
                  <span className="font-title-md text-title-md text-on-surface font-mono font-semibold">
                    +91 {profile.phone}
                  </span>
                </div>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  This is your login. It is shared with a hospital only after you accept their request.
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-low p-space-md flex flex-col gap-space-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Email
                </span>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">mail</span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {profile.email || 'Not added'}
                  </span>
                </div>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  {profile.email ? 'Used for account notices.' : 'Add an email in Edit Profile.'}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-surface-container-low p-space-md">
              <div className="mb-3">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold block">
                  Home area
                </span>
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  {profile.area}, {profile.city} — {profile.pin}
                </span>
              </div>
              <div className="bg-surface-container-lowest rounded-lg p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-bold">Alert radius</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Saved with your profile. Right now requests are matched by blood group and city.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {RADII.map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        r !== profile.radius_km && quickSave({ radius_km: r }, `Alert radius set to ${r} km.`)
                      }
                      className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all cursor-pointer disabled:opacity-60 ${
                        profile.radius_km === r
                          ? 'font-bold bg-primary-container text-on-primary shadow-sm'
                          : 'font-semibold bg-surface-container-low text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cooldown and history */}
          <div className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg flex flex-col gap-space-md">
            <SectionTitle
              icon="history_edu"
              title="Donation History & Cooldown"
              right={
                <Link
                  to="/donor/dashboard"
                  className="font-label-sm text-label-sm text-primary hover:text-primary-container font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Dashboard</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              }
            />

            <div className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container text-[22px]">timelapse</span>
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block">
                      Whole blood cooldown: {eligibility.gap_days} days
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant">
                      {profile.never_donated
                        ? 'No donation on record, so you can donate now.'
                        : `Last donation: ${formatDate(profile.last_donation)}${
                            eligibility.next_eligible
                              ? ` • You can donate again from ${formatDate(eligibility.next_eligible)}`
                              : ''
                          }`}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold flex items-center gap-1 self-start ${
                    eligibility.eligible
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {eligibility.eligible ? 'check' : 'hourglass_top'}
                  </span>
                  {eligibility.eligible ? 'Ready to donate' : 'Recovery period'}
                </span>
              </div>
              {!profile.never_donated && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-label-sm font-semibold text-on-surface-variant">
                    <span>
                      Day {Math.min(elapsed, eligibility.gap_days)} of {eligibility.gap_days}
                    </span>
                    <span className="text-primary font-bold">
                      {eligibility.eligible
                        ? 'Cooldown complete'
                        : `${eligibility.days_left} day${eligibility.days_left === 1 ? '' : 's'} remaining`}
                    </span>
                  </div>
                  <div
                    className="w-full h-3 rounded-full bg-surface-container-highest overflow-hidden p-0.5"
                    role="progressbar"
                    aria-valuenow={eligibility.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary-container transition-all"
                      style={{ width: `${eligibility.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {history.length === 0 ? (
              <p className="font-body-md text-body-md text-secondary">
                No donations recorded yet. Donations confirmed by a hospital appear here.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-sm text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 rounded-l-lg">Date</th>
                        <th className="py-2.5 px-3">Type & volume</th>
                        <th className="py-2.5 px-3">Hospital</th>
                        <th className="py-2.5 px-3 text-right rounded-r-lg">Status</th>
                      </tr>
                    </thead>
                    <tbody className="font-body-sm text-body-sm text-on-surface">
                      {shownHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="py-3 px-3 font-semibold whitespace-nowrap">{formatDate(h.date)}</td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-primary">{h.component}</span>
                            <span className="text-on-surface-variant text-[11px] block">
                              {h.units} unit{h.units === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold">{h.hospital}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-label-sm text-[11px] font-semibold whitespace-nowrap">
                              <span
                                className="material-symbols-outlined text-[13px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                verified
                              </span>
                              Confirmed by hospital
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {history.length > HISTORY_SHOWN && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="self-start text-primary hover:underline font-label-md text-label-md font-semibold cursor-pointer"
                  >
                    {showAll ? 'Show fewer' : `Show all ${history.length} donations`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Alert channels */}
          <div
            id="alerts"
            className="rounded-xl bg-surface-container-lowest shadow-md p-space-lg flex flex-col gap-space-md scroll-mt-28"
          >
            <SectionTitle icon="notifications_active" title="Alert Preferences" />
            <div className="flex flex-col gap-3">
              <label
                htmlFor="toggle-sms"
                className="flex items-center justify-between p-space-md rounded-lg bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">sms</span>
                  </div>
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block">
                      SMS alerts
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Be told by text message when a request matches your blood group.
                    </span>
                  </div>
                </div>
                <Toggle
                  id="toggle-sms"
                  checked={profile.sms_alerts}
                  disabled={busy}
                  onChange={(v) =>
                    quickSave({ sms_alerts: v }, v ? 'SMS alerts turned on.' : 'SMS alerts turned off.')
                  }
                />
              </label>
              <label
                htmlFor="toggle-wa"
                className="flex items-center justify-between p-space-md rounded-lg bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">chat</span>
                  </div>
                  <div>
                    <span className="font-label-md text-label-md text-on-surface font-bold block">
                      WhatsApp alerts
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Be told on WhatsApp when a request matches your blood group.
                    </span>
                  </div>
                </div>
                <Toggle
                  id="toggle-wa"
                  checked={profile.whatsapp_alerts}
                  disabled={busy}
                  onChange={(v) =>
                    quickSave(
                      { whatsapp_alerts: v },
                      v ? 'WhatsApp alerts turned on.' : 'WhatsApp alerts turned off.'
                    )
                  }
                />
              </label>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">info</span>
              <p className="font-body-sm text-body-sm">
                Keep at least one channel on. For now, requests reach you inside RedSync (the bell and
                your dashboard). SMS and WhatsApp delivery is coming soon, and your choice here will be
                used when it does.
              </p>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          onSave={async (changes) => {
            await save(changes)
            setEditing(false)
            setToast({ text: 'Profile updated.' })
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[calc(100vw-2rem)] px-5 py-3 rounded-full shadow-xl font-label-md text-label-md flex items-center gap-2 ${
            toast.error ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface'
          }`}
        >
          <span className={`material-symbols-outlined text-[18px] ${toast.error ? '' : 'text-tertiary-fixed-dim'}`}>
            {toast.error ? 'error' : 'check_circle'}
          </span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}