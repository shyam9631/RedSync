import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import { ALL_GROUPS, DONATE_TO, formatDate } from '../../data/donorDemo'

const RING_PATH =
  'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831'

const URGENCY_LABEL = { critical: 'Critical', urgent: 'Urgent', normal: 'Normal' }

function minutesSince(iso) {
  if (!iso) return 0
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

function timeAgo(iso) {
  const mins = minutesSince(iso)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

/* ---------- Request card ---------- */
function RequestCard({ r, isAccepted, canAccept, blockedReason, onAccept, onDecline }) {
  const critical = r.urgency === 'critical'
  const normal = r.urgency === 'normal'
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 font-badge-blood-group text-[16px] font-bold shadow-sm">
            {r.blood_group}
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="font-headline-sm text-[18px] leading-6 font-bold text-on-surface">
                {r.hospital.name}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                  critical
                    ? 'bg-error-container text-on-error-container'
                    : normal
                    ? 'bg-surface-container text-secondary'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {URGENCY_LABEL[r.urgency] || 'Urgent'}
              </span>
              {isAccepted && (
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
                  Accepted
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 mt-1.5 font-body-sm text-body-sm text-secondary">
              <span className="font-semibold text-on-surface">{r.component}</span>
              <span className="text-outline-variant">•</span>
              <span className={critical ? 'text-error font-medium' : 'text-amber-800 font-medium'}>
                {r.units} unit{r.units === 1 ? '' : 's'} needed
              </span>
              <span className="text-outline-variant">•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                {r.hospital.city}
              </span>
              <span className="text-outline-variant">•</span>
              <span>{timeAgo(r.posted_at)}</span>
            </div>
            {r.notes && (
              <p className="mt-2 font-body-sm text-body-sm text-secondary">{r.notes}</p>
            )}
          </div>
        </div>

        {!isAccepted && (
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={onDecline}
              className="px-4 py-2 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={!canAccept}
              title={canAccept ? undefined : blockedReason}
              onClick={onAccept}
              className="px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Accept
            </button>
          </div>
        )}
      </div>

      <div className="mt-3.5 pt-3 border-t border-surface-container-high flex items-center gap-2 font-label-sm text-label-sm text-secondary">
        <span className="material-symbols-outlined text-[15px] text-outline">lock</span>
        <span>Your phone number is shared only after you accept.</span>
      </div>
    </div>
  )
}

/* ---------- Status tracker ---------- */
function StatusTracker({ completed, acceptedAt }) {
  const steps = [
    {
      label: 'Accepted',
      note: acceptedAt
        ? new Date(acceptedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
        : '',
    },
    { label: 'Hospital confirmed', note: completed >= 2 ? 'Confirmed' : 'Waiting for hospital' },
    { label: 'Donation completed', note: completed >= 3 ? 'Done' : 'Final step' },
  ]

  return (
    <div className="relative grid grid-cols-3 max-w-xl mx-auto">
      <div className="absolute top-[17px] left-[16.667%] w-[66.667%] h-0.5 bg-surface-container-highest"></div>
      <div
        className="absolute top-[17px] left-[16.667%] h-0.5 bg-tertiary-container transition-all duration-300"
        style={{ width: `${(completed - 1) * 33.333}%` }}
      ></div>

      {steps.map((s, i) => {
        const n = i + 1
        const done = n <= completed
        const current = n === completed + 1
        return (
          <div key={s.label} className="relative z-10 flex flex-col items-center text-center px-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
                done
                  ? 'bg-tertiary-container text-on-tertiary'
                  : current
                  ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                  : 'bg-surface-container text-outline'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {done ? 'check' : current ? 'radio_button_checked' : 'circle'}
              </span>
            </div>
            <span
              className={`font-label-sm text-label-sm mt-2 ${
                done || current ? 'font-semibold text-on-surface' : 'text-outline'
              }`}
            >
              {s.label}
            </span>
            <span className="font-body-sm text-[11px] text-secondary">{s.note}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Page ---------- */
export default function DonorDashboard() {
  const [dash, setDash] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const [filter, setFilter] = useState('all')
  const [pending, setPending] = useState(null)
  const [dismissedId, setDismissedId] = useState(null)

  // Reload everything the page shows from the server
  const load = useCallback(async ({ quiet = false, spinner = !quiet } = {}) => {
    if (spinner) setLoading(true)
    try {
      const [d, r] = await Promise.all([api.get('/donor/dashboard'), api.get('/donor/requests')])
      setDash(d.data)
      setRequests(r.data.requests || [])
      setLoadError('')
    } catch (err) {
      if (!quiet) setLoadError(errorMessage(err))
      else setActionError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ spinner: false }) // `loading` already starts as true
  }, [load])

  // Close the accept dialog with Escape
  useEffect(() => {
    if (!pending) return
    const onKey = (e) => {
      if (e.key === 'Escape') setPending(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending])

  // Runs an API action, shows its error, then refreshes the page data
  const run = async (fn) => {
    setActionError('')
    setBusy(true)
    try {
      await fn()
      await load({ quiet: true })
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading your dashboard…</p>
      </div>
    )
  }

  if (loadError || !dash) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Could not load your dashboard
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-1">{loadError}</p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-5 px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  const { profile, eligibility, stats, history, camps } = dash
  const available = dash.available
  const activeRaw = dash.active_response
  const active = activeRaw && activeRaw.response_id !== dismissedId ? activeRaw : null
  const completed = active ? active.step : 0
  const group = profile.blood_group
  const firstName = (profile.name || 'Donor').split(' ')[0]

  // A request I already donated for is finished, so it no longer belongs in the list
  const liveRequests = requests.filter((r) => r.my_status !== 'completed')
  const counts = {
    all: liveRequests.length,
    critical: liveRequests.filter((r) => r.urgency === 'critical').length,
    urgent: liveRequests.filter((r) => r.urgency === 'urgent').length,
  }
  const list = liveRequests.filter((r) => filter === 'all' || r.urgency === filter)

  const hasActive = active && active.status !== 'completed'
  const canAccept = eligibility.eligible && !hasActive && !busy
  const blockedReason = !eligibility.eligible
    ? 'You are not eligible to donate yet.'
    : 'You already have an active response.'

  const toggleAvailable = (value) =>
    run(() => api.patch('/donor/availability', { available: value }))

  const confirmAccept = () => {
    const id = pending.id
    setPending(null)
    run(() => api.post(`/donor/requests/${id}/accept`))
  }

  const declineRequest = (id) => run(() => api.post(`/donor/requests/${id}/decline`))

  const cancelResponse = () => {
    if (!window.confirm('Cancel your response to this request?')) return
    run(() => api.post(`/donor/responses/${active.response_id}/cancel`))
  }

  const toggleCamp = (c) =>
    run(() =>
      c.is_registered
        ? api.delete(`/donor/camps/${c.id}/register`)
        : api.post(`/donor/camps/${c.id}/register`)
    )

  // Compatibility
  const canGiveTo = DONATE_TO[group] || []
  const cannotGiveTo = ALL_GROUPS.filter((g) => !canGiveTo.includes(g))

  const lastDonationText = stats.last_donation ? formatDate(stats.last_donation) : 'Never'

  const filters = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'critical', label: `Critical (${counts.critical})` },
    { key: 'urgent', label: `Urgent (${counts.urgent})` },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      {actionError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container"
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
          <p className="font-body-sm text-body-sm flex-1">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError('')}
            aria-label="Dismiss message"
            className="cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* TOP ROW */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Welcome */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Registered donor
              </div>
              <h1 className="font-headline-sm text-headline-sm text-on-surface pt-1 truncate">
                Welcome back, {firstName}
              </h1>
              <p className="font-body-sm text-body-sm text-secondary">
                {profile.area ? `${profile.area}, ` : ''}
                {profile.city}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm font-badge-blood-group text-xl font-extrabold">
              {group}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-surface-container-high flex items-center justify-between font-label-sm text-label-sm">
            <span className="text-secondary">Matching requests in</span>
            <span className="font-semibold text-on-surface">{profile.city}</span>
          </div>
        </div>

        {/* Availability */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-headline-sm text-[18px] leading-6 font-semibold text-on-surface">
                Available to donate
              </h2>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={available}
                  disabled={busy}
                  onChange={(e) => toggleAvailable(e.target.checked)}
                  aria-label="Available to donate"
                  className="sr-only peer"
                />
                <div className="w-12 h-7 bg-surface-container-highest rounded-full peer peer-checked:bg-tertiary-container after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container"></div>
              </label>
            </div>
            <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
              When on, you can receive requests that match your blood group.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center gap-2">
            {available ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-fixed-dim opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary"></span>
                </span>
                <span className="font-label-sm text-label-sm font-semibold text-tertiary">
                  You will be notified about matching requests
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex rounded-full h-2.5 w-2.5 bg-outline"></span>
                <span className="font-label-sm text-label-sm font-semibold text-secondary">
                  You will not receive new requests
                </span>
              </>
            )}
          </div>
        </div>

        {/* Eligibility */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-headline-sm text-[18px] leading-6 font-semibold text-on-surface">
              Eligibility check
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap ${
                eligibility.eligible
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {eligibility.eligible ? 'check_circle' : 'hourglass_top'}
              </span>
              {eligibility.eligible ? 'Ready to donate' : 'Recovery period'}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-high"
                  d={RING_PATH}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                />
                <path
                  className={eligibility.eligible ? 'text-tertiary-container' : 'text-amber-500'}
                  d={RING_PATH}
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${eligibility.percent}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              </svg>
              <span
                className={`material-symbols-outlined absolute text-[22px] ${
                  eligibility.eligible ? 'text-tertiary-container' : 'text-amber-600'
                }`}
              >
                {eligibility.eligible ? 'done_all' : 'schedule'}
              </span>
            </div>
            <div>
              <div className="font-label-md text-label-md font-semibold text-on-surface">
                {eligibility.eligible
                  ? 'Eligible now'
                  : `Eligible again in ${eligibility.days_left} day${
                      eligibility.days_left === 1 ? '' : 's'
                    }`}
              </div>
              <div className="font-body-sm text-body-sm text-secondary">
                {eligibility.eligible
                  ? profile.never_donated
                    ? 'No earlier donation on record'
                    : `${eligibility.gap_days}-day gap since your last donation is over`
                  : `Next eligible date: ${formatDate(eligibility.next_eligible)}`}
              </div>
            </div>
          </div>

          <p className="mt-4 pt-3 border-t border-surface-container-high font-body-sm text-[12px] text-secondary">
            Whole blood donors can give again after {eligibility.gap_days} days.
          </p>
        </div>
      </section>

      {/* MAIN AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Requests */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                Urgent requests near you
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-secondary font-label-sm text-label-sm self-start sm:self-auto">
                <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                Most urgent first • {group} • {profile.city}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-3.5 py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                    filter === f.key
                      ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                      : 'bg-surface-container-lowest text-secondary border border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!eligibility.eligible && (
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-100 px-4 py-3 text-amber-900">
                <span className="material-symbols-outlined text-[20px] shrink-0">hourglass_top</span>
                <p className="font-body-sm text-body-sm">
                  You can accept requests again on {formatDate(eligibility.next_eligible)}.
                </p>
              </div>
            )}
            {hasActive && (
              <p className="font-body-sm text-body-sm text-secondary">
                Finish or cancel your active response to accept another request.
              </p>
            )}

            {!available ? (
              <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-3 text-secondary">
                  <span className="material-symbols-outlined text-[24px]">notifications_off</span>
                </div>
                <h4 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface">
                  You are set to unavailable
                </h4>
                <p className="font-body-sm text-body-sm text-secondary max-w-md mt-1">
                  Turn availability on to see and receive requests that match your blood group.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleAvailable(true)}
                  className="mt-4 px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  Turn availability on
                </button>
              </div>
            ) : list.length === 0 ? (
              <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-3 text-secondary">
                  <span className="material-symbols-outlined text-[24px]">inbox</span>
                </div>
                <h4 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface">
                  No matching requests right now. We will notify you when one comes up.
                </h4>
                <p className="font-body-sm text-body-sm text-secondary max-w-md mt-1">
                  You will be alerted when a hospital in {profile.city} needs {group} blood.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {list.map((r) => (
                  <RequestCard
                    key={r.id}
                    r={r}
                    isAccepted={active?.request.id === r.id}
                    canAccept={canAccept}
                    blockedReason={blockedReason}
                    onAccept={() => setPending(r)}
                    onDecline={() => declineRequest(r.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Active response */}
          <section
            className={`bg-surface-container-lowest rounded-2xl p-6 shadow-sm ${
              active ? 'border-2 border-primary/20' : 'border border-surface-container'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    active ? 'bg-primary-container' : 'bg-outline-variant'
                  }`}
                ></span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                  My active response
                </h2>
              </div>
              {active && (
                <span
                  className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                    completed === 3
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {completed === 3 ? 'Completed' : 'In progress'}
                </span>
              )}
            </div>

            {!active ? (
              <p className="pt-5 font-body-md text-body-md text-secondary">
                You have no active response. When you accept a request, its status appears here.
              </p>
            ) : (
              <>
                <div className="py-6">
                  <StatusTracker completed={completed} acceptedAt={active.accepted_at} />
                </div>

                <div className="p-4 bg-surface-container-low rounded-xl space-y-3 font-body-sm text-body-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="font-label-md text-label-md font-bold text-on-surface">
                        {active.hospital.name}
                      </div>
                      <div className="text-secondary flex items-center gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-[16px] text-outline shrink-0">
                          location_on
                        </span>
                        {active.hospital.address}, {active.hospital.city}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-lowest border border-outline-variant text-on-surface font-label-sm text-label-sm font-semibold shrink-0 self-start">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        water_drop
                      </span>
                      {active.request.component} • {active.request.units} unit
                      {active.request.units === 1 ? '' : 's'}
                    </div>
                  </div>

                  {completed === 3 ? (
                    <div className="pt-2 border-t border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-on-surface">
                        Donation completed. Thank you! The hospital will record it in your history.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDismissedId(active.response_id)}
                        className="px-4 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 text-on-surface">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary">
                            call
                          </span>
                          <span className="font-medium">Hospital desk:</span>
                          <a
                            href={`tel:${active.hospital.phone}`}
                            className="font-semibold hover:underline"
                          >
                            {active.hospital.phone}
                          </a>
                        </div>
                        {active.hospital.emergency_phone && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-error">
                              emergency
                            </span>
                            <span className="font-medium">Emergency:</span>
                            <a
                              href={`tel:${active.hospital.emergency_phone}`}
                              className="font-semibold hover:underline"
                            >
                              {active.hospital.emergency_phone}
                            </a>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelResponse}
                        className="font-label-sm text-label-sm text-secondary hover:text-error underline cursor-pointer self-start sm:self-auto disabled:opacity-50"
                      >
                        Cancel my response
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* RIGHT */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* Stats */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm">
            <h2 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface mb-4">
              Your Donor Record
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-1.5 text-primary mb-1">
                  <span className="material-symbols-outlined text-[18px]">water_drop</span>
                  <span className="font-label-sm text-label-sm text-secondary">Donations</span>
                </div>
                <div className="font-headline-lg text-[28px] leading-8 font-bold text-on-surface">
                  {stats.total_donations}
                </div>
                <div className="font-body-sm text-[11px] text-secondary mt-0.5">
                  Confirmed by hospitals
                </div>
              </div>
              <div className="p-3.5 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[18px] text-secondary">event</span>
                  <span className="font-label-sm text-label-sm text-secondary">Last donation</span>
                </div>
                <div className="font-headline-sm text-[18px] leading-6 font-bold text-on-surface mt-1">
                  {lastDonationText}
                </div>
              </div>
            </div>
          </section>

          {/* History */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface">
                Donation history
              </h2>
              <Link
                to="/donor/history"
                className="font-label-sm text-label-sm font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {history.length === 0 ? (
              <p className="font-body-sm text-body-sm text-secondary">
                No donations recorded yet. Donations confirmed by a hospital appear here.
              </p>
            ) : (
              <div className="space-y-3 font-body-sm text-body-sm">
                {history.map((h, i) => (
                  <div
                    key={h.id}
                    className={`flex flex-col gap-1 ${
                      i < history.length - 1 ? 'pb-3 border-b border-surface-container-high' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-on-surface">{h.hospital}</span>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-[11px] font-semibold whitespace-nowrap">
                        Confirmed
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary text-xs">
                      <span>{formatDate(h.date)}</span>
                      <span>•</span>
                      <span>{h.component}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Camps */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm">
            <h2 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface mb-3">
              Upcoming camps near you
            </h2>
            {camps.length === 0 ? (
              <p className="font-body-sm text-body-sm text-secondary">
                No camps are scheduled in {profile.city} right now.
              </p>
            ) : (
              <div className="space-y-3 font-body-sm text-body-sm">
                {camps.map((c) => (
                  <div key={c.id} className="p-3.5 bg-surface-container-low rounded-xl space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-on-surface">{c.title}</h3>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleCamp(c)}
                        title={c.is_registered ? 'Click to cancel registration' : undefined}
                        className={`font-label-sm text-label-sm font-semibold shrink-0 cursor-pointer disabled:opacity-50 ${
                          c.is_registered ? 'text-tertiary' : 'text-primary hover:underline'
                        }`}
                      >
                        {c.is_registered ? 'Registered ✓' : 'Register →'}
                      </button>
                    </div>
                    <p className="text-xs text-secondary">
                      {formatDate(c.camp_date)} • {formatTime(c.start_time)} –{' '}
                      {formatTime(c.end_time)}
                    </p>
                    <p className="text-xs text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                      {c.venue}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Compatibility */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">group</span>
              <h2 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface">
                Who can I donate to?
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mb-3.5">
              As an <strong className="font-bold text-on-surface">{group}</strong> donor, your red
              blood cells can help recipients with:
            </p>

            <div className="space-y-2.5">
              <div>
                <span className="font-label-sm text-[11px] font-semibold text-tertiary uppercase tracking-wide">
                  Compatible recipients
                </span>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {canGiveTo.map((g) => (
                    <div
                      key={g}
                      className="p-2 bg-tertiary-fixed/40 rounded-lg text-center border border-tertiary-fixed flex flex-col items-center"
                    >
                      <span className="font-badge-blood-group font-bold text-on-tertiary-fixed text-sm">
                        {g}
                      </span>
                      <span className="material-symbols-outlined text-tertiary text-[14px] mt-0.5">
                        check
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {cannotGiveTo.length > 0 ? (
                <div>
                  <span className="font-label-sm text-[11px] font-semibold text-outline uppercase tracking-wide">
                    Not compatible
                  </span>
                  <div className="grid grid-cols-4 gap-2 mt-1.5">
                    {cannotGiveTo.map((g) => (
                      <div
                        key={g}
                        className="p-2 bg-surface-container-low rounded-lg text-center text-outline flex flex-col items-center"
                      >
                        <span className="font-badge-blood-group font-medium text-xs">{g}</span>
                        <span className="material-symbols-outlined text-outline-variant text-[14px] mt-0.5">
                          remove
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-body-sm text-body-sm text-tertiary font-semibold">
                  You are a universal donor.
                </p>
              )}
            </div>
          </section>

          {/* Profile */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-sm space-y-3">
            <h2 className="font-headline-sm text-[16px] leading-5 font-semibold text-on-surface">
              Keep your profile up to date
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Keep your contact info and health details accurate.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Link
                to="/donor/profile"
                className="flex-1 px-4 py-2 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors text-center"
              >
                Edit profile
              </Link>
              <Link
                to="/donor/alerts"
                className="flex-1 px-4 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors text-center"
              >
                Alert preferences
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {/* ACCEPT DIALOG */}
      {pending && (
        <div
          className="fixed inset-0 z-[60] bg-on-surface/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPending(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="accept-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 shadow-2xl border border-surface-container"
          >
            <div className="w-12 h-12 rounded-full bg-error-container text-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">emergency</span>
            </div>
            <h3 id="accept-title" className="font-headline-sm text-headline-sm text-on-surface mb-1">
              Accept this request?
            </h3>
            <div className="my-4 p-3.5 bg-surface-container-low rounded-xl space-y-1">
              <div className="font-label-md text-label-md font-bold text-on-surface">
                {pending.hospital.name}
              </div>
              <div className="font-body-sm text-body-sm text-secondary">
                {pending.component} • {pending.units} unit{pending.units === 1 ? '' : 's'} needed
              </div>
              <div className="font-body-sm text-[12px] text-secondary">
                {pending.hospital.address}, {pending.hospital.city}
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-secondary leading-relaxed mb-6">
              Your phone number will be shared with the hospital so their blood bank team can contact
              you to coordinate your arrival.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="px-5 py-2.5 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAccept}
                className="px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Yes, accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}