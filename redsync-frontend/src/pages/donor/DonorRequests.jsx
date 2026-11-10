import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import { formatDate } from '../../data/donorDemo'

const REFRESH_MS = 30000
const URGENCY_LABEL = { critical: 'Critical', urgent: 'Urgent', normal: 'Normal' }
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'normal', label: 'Normal' },
]

function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

// "in 5 hours", "tomorrow, 6:30 PM" style label for the deadline
function neededBy(iso) {
  if (!iso) return ''
  const t = new Date(iso)
  const mins = Math.round((t.getTime() - Date.now()) / 60000)
  if (mins <= 0) return 'now'
  if (mins < 60) return `within ${mins} min`
  if (mins < 24 * 60) return `within ${Math.round(mins / 60)} hr`
  return t.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function Banner({ tone = 'info', icon, children, action }) {
  const tones = {
    info: 'bg-surface-container-low text-on-surface',
    warn: 'bg-amber-50 text-amber-900',
    error: 'bg-error-container text-on-error-container',
    ok: 'bg-tertiary-fixed/60 text-on-tertiary-fixed',
  }
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`flex items-start gap-3 rounded-xl px-4 py-3 ${tones[tone]}`}
    >
      <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 font-body-sm text-body-sm leading-relaxed">{children}</div>
      {action}
    </div>
  )
}

function RequestCard({ r, canAccept, blockedReason, busy, onAccept, onDecline }) {
  const critical = r.urgency === 'critical'
  const normal = r.urgency === 'normal'
  const mine = r.my_status === 'accepted' || r.my_status === 'confirmed'
  return (
    <article
      className={`bg-surface-container-lowest rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow ${
        critical ? 'border-error-container' : 'border-surface-container'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 font-badge-blood-group text-[16px] font-bold shadow-sm">
            {r.blood_group}
          </div>
          <div className="min-w-0">
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
              {mine && (
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
                  {r.my_status === 'confirmed' ? 'Confirmed by hospital' : 'You accepted'}
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
              <span>Needed {neededBy(r.required_by)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 mt-1 font-body-sm text-body-sm text-secondary">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                {r.hospital.address}, {r.hospital.city}
              </span>
              <span className="text-outline-variant">•</span>
              <span>Posted {timeAgo(r.posted_at)}</span>
            </div>
            {r.notes && (
              <p className="mt-2 font-body-sm text-body-sm text-on-surface bg-surface-container-low rounded-lg px-3 py-2">
                {r.notes}
              </p>
            )}
          </div>
        </div>

        {!mine && (
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              className="px-4 py-2 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors cursor-pointer disabled:opacity-50"
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
    </article>
  )
}

export default function DonorRequests() {
  const [dash, setDash] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [urgency, setUrgency] = useState('all')
  const [component, setComponent] = useState('all')
  const [pending, setPending] = useState(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const [d, r] = await Promise.all([api.get('/donor/dashboard'), api.get('/donor/requests')])
      setDash(d.data)
      setRequests(r.data.requests || [])
      setLoadError('')
    } catch (err) {
      if (quiet) setActionError(errorMessage(err))
      else setLoadError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load({ quiet: true }), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!pending) return
    const onKey = (e) => e.key === 'Escape' && setPending(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending])

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
        <p className="mt-3 font-body-md text-body-md">Loading urgent requests…</p>
      </div>
    )
  }

  if (loadError || !dash) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load requests</h2>
        <p className="font-body-md text-body-md text-secondary mt-1">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            load()
          }}
          className="mt-5 px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  const { profile, eligibility } = dash
  const available = dash.available
  const active = dash.active_response
  const hasActive = active && active.status !== 'completed'

  // A request already donated for is finished, so it no longer belongs in the list
  const live = requests.filter((r) => r.my_status !== 'completed')
  const components = [...new Set(live.map((r) => r.component))].sort()
  const count = (key) => (key === 'all' ? live.length : live.filter((r) => r.urgency === key).length)
  const list = live.filter(
    (r) => (urgency === 'all' || r.urgency === urgency) && (component === 'all' || r.component === component)
  )

  const canAccept = available && eligibility.eligible && !hasActive && !busy
  const blockedReason = !available
    ? 'Turn on "Available to donate" first.'
    : !eligibility.eligible
    ? 'You are not eligible to donate yet.'
    : 'You already have an active response.'

  const confirmAccept = () => {
    const id = pending.id
    setPending(null)
    run(() => api.post(`/donor/requests/${id}/accept`))
  }

  return (
    <div className="w-full pb-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm mb-1 uppercase tracking-wider">
            <span className="font-semibold text-primary">RedSync</span>
            <span>/</span>
            <span>Donor</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            Urgent Requests
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
            Hospitals in {profile.city} that need {profile.blood_group} blood. Most urgent first, refreshed
            every 30 seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ quiet: true })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors cursor-pointer self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </section>

      <div className="flex flex-col gap-3 mb-6">
        {actionError && (
          <Banner tone="error" icon="error">
            {actionError}
          </Banner>
        )}
        {!available && (
          <Banner
            tone="warn"
            icon="pause_circle"
            action={
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => api.patch('/donor/availability', { available: true }))}
                className="px-4 py-1.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer disabled:opacity-60 shrink-0"
              >
                Turn on
              </button>
            }
          >
            You are marked <strong>not available</strong>, so no requests are shown. Turn availability on to
            see requests that match you.
          </Banner>
        )}
        {available && !eligibility.eligible && (
          <Banner tone="warn" icon="hourglass_top">
            You can accept requests again on <strong>{formatDate(eligibility.next_eligible)}</strong> (
            {eligibility.days_left} day{eligibility.days_left === 1 ? '' : 's'} to go). You can still look at
            requests until then.
          </Banner>
        )}
        {hasActive && (
          <Banner
            tone="ok"
            icon="volunteer_activism"
            action={
              <Link
                to="/donor/dashboard"
                className="font-label-md text-label-md font-semibold underline shrink-0"
              >
                View status
              </Link>
            }
          >
            You have an active response with <strong>{active.hospital.name}</strong>. Finish or cancel it on your
            dashboard before accepting another request.
          </Banner>
        )}
      </div>

      {available && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Filter by urgency">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={urgency === f.key}
                onClick={() => setUrgency(f.key)}
                className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  urgency === f.key
                    ? 'bg-primary-container text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {f.label} ({count(f.key)})
              </button>
            ))}
          </div>
          {components.length > 1 && (
            <div>
              <label htmlFor="req-component" className="sr-only">
                Filter by component
              </label>
              <select
                id="req-component"
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                className="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container cursor-pointer"
              >
                <option value="all">All components</option>
                {components.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {available && list.length === 0 ? (
        <div className="p-10 text-center bg-surface-container-lowest rounded-2xl border border-surface-container">
          <span className="material-symbols-outlined text-secondary text-[36px]">
            {live.length === 0 ? 'task_alt' : 'filter_alt_off'}
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">
            {live.length === 0 ? 'No open requests right now' : 'No requests match these filters'}
          </h3>
          <p className="font-body-md text-body-md text-secondary mt-1">
            {live.length === 0
              ? `There are no open ${profile.blood_group} requests in ${profile.city}. We will show new ones here as hospitals post them.`
              : 'Try a different urgency or component.'}
          </p>
          {live.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setUrgency('all')
                setComponent('all')
              }}
              className="mt-4 px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              busy={busy}
              canAccept={canAccept}
              blockedReason={blockedReason}
              onAccept={() => setPending(r)}
              onDecline={() => run(() => api.post(`/donor/requests/${r.id}/decline`))}
            />
          ))}
        </div>
      )}

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
              <div className="font-label-md text-label-md font-bold text-on-surface">{pending.hospital.name}</div>
              <div className="font-body-sm text-body-sm text-secondary">
                {pending.component} • {pending.units} unit{pending.units === 1 ? '' : 's'} needed
              </div>
              <div className="font-body-sm text-[12px] text-secondary">
                {pending.hospital.address}, {pending.hospital.city}
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-secondary leading-relaxed mb-6">
              Your phone number will be shared with the hospital so their blood bank team can contact you to
              coordinate your arrival.
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