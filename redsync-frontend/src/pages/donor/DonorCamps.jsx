import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import { formatDate } from '../../data/donorDemo'

const REFRESH_MS = 60000

// Order and wording of the groups the camps are listed under
const GROUPS = [
  { key: 'area', title: 'In your area', note: 'Organised by a hospital with your PIN code', icon: 'near_me' },
  { key: 'nearby', title: 'Nearby', note: 'Same postal district as you', icon: 'pin_drop' },
  { key: 'city', title: 'Elsewhere in your city', note: '', icon: 'location_city' },
  { key: 'other', title: 'Other cities', note: 'Worth the trip?', icon: 'travel_explore' },
]

const DATE_CHIPS = [
  { key: 'all', label: 'All dates' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'month', label: 'This month' },
]

const CHECKLIST = [
  'Carry a valid photo ID (Aadhaar, Voter ID or licence).',
  'Drink plenty of water and eat a light meal beforehand.',
  'Avoid smoking and alcohol on the day.',
  'Get a good night of sleep before you donate.',
]

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function whenLabel(dateStr, today) {
  const days = Math.round((parseDate(dateStr) - today) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  const weekday = parseDate(dateStr).toLocaleDateString('en-IN', { weekday: 'long' })
  return days < 7 ? weekday : `${weekday}, ${formatDate(dateStr)}`
}

function inRange(dateStr, chip, today) {
  if (chip === 'all') return true
  const d = parseDate(dateStr)
  const days = Math.round((d - today) / 86400000)
  if (chip === 'week') return days <= 6
  if (chip === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  if (chip === 'weekend') {
    // the coming Saturday and Sunday (or today, if it is already the weekend)
    const dow = today.getDay()
    const toSat = dow === 0 ? -1 : 6 - dow
    const sat = new Date(today.getFullYear(), today.getMonth(), today.getDate() + toSat)
    const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1)
    return d.getTime() === sat.getTime() || d.getTime() === sun.getTime()
  }
  return true
}

const directionsUrl = (c) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.venue}, ${c.city}`)}`

function CampCard({ c, today, busy, onToggle }) {
  const pct = c.target_units > 0 ? Math.min(100, Math.round((c.registered / c.target_units) * 100)) : 0
  const registered = c.is_registered
  const label = whenLabel(c.camp_date, today)
  const soon = label === 'Today' || label === 'Tomorrow'
  return (
    <article className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-space-md">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold ${
                soon ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-surface-container-low text-primary'
              }`}
            >
              {label}
            </span>
            <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {formatTime(c.start_time)} – {formatTime(c.end_time)}
            </span>
            {registered && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                You are registered
              </span>
            )}
          </div>
          <h4 className="font-title-md text-title-md text-on-surface font-bold">{c.title}</h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1">
            <span className="material-symbols-outlined text-[16px] shrink-0">location_on</span>
            <span>
              {c.venue}, {c.city}
            </span>
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-tertiary">local_hospital</span>
            <span>
              Organised by <strong>{c.hospital_name}</strong>
            </span>
          </p>
          <div className="mt-1">
            <div className="flex items-center justify-between font-label-sm text-label-sm mb-1">
              <span className="text-on-surface-variant">
                Target: <strong className="text-on-surface">{c.target_units} units</strong>
              </span>
              <span className="text-primary font-bold">
                {c.registered} donor{c.registered === 1 ? '' : 's'} registered
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div className="h-full bg-primary-container rounded-full" style={{ width: `${pct}%` }}></div>
            </div>
          </div>
          {!c.can_register && !registered && (
            <p className="mt-1 font-body-sm text-body-sm text-amber-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
              You can donate again from {formatDate(c.next_eligible)}, after this camp.
            </p>
          )}
        </div>

        <div className="flex md:flex-col items-stretch md:items-end gap-space-xs shrink-0 pt-2 md:pt-0">
          <button
            type="button"
            disabled={busy || (!registered && !c.can_register)}
            onClick={onToggle}
            className={`inline-flex items-center justify-center gap-1 px-space-md py-2 rounded-full font-label-md text-label-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              registered
                ? 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                : 'bg-primary-container hover:bg-primary text-on-primary shadow-sm active:scale-95'
            }`}
          >
            <span>{registered ? 'Cancel registration' : 'Register'}</span>
            {!registered && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
          </button>
          <a
            href={directionsUrl(c)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 px-space-md py-2 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">directions</span>
            Directions
          </a>
        </div>
      </div>
    </article>
  )
}

export default function DonorCamps() {
  const [today] = useState(() => startOfDay(new Date()))
  const [scope, setScope] = useState('city')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState('all')

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        const res = await api.get('/donor/camps/browse', { params: { scope } })
        setData(res.data)
        setLoadError('')
      } catch (err) {
        if (quiet) setActionError(errorMessage(err))
        else setLoadError(errorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [scope]
  )

  useEffect(() => {
    load()
    const timer = setInterval(() => load({ quiet: true }), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const toggle = async (c) => {
    setActionError('')
    setBusy(true)
    try {
      if (c.is_registered) await api.delete(`/donor/camps/${c.id}/register`)
      else await api.post(`/donor/camps/${c.id}/register`)
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
        <p className="mt-3 font-body-md text-body-md">Finding camps near you…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load camps</h2>
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

  const { location, eligibility, camps, my_camps: mine } = data
  const q = query.trim().toLowerCase()
  const visible = camps.filter(
    (c) =>
      inRange(c.camp_date, chip, today) &&
      (!q ||
        [c.title, c.venue, c.city, c.hospital_name, c.hospital_pin].some((v) => (v || '').toLowerCase().includes(q)))
  )
  const nearCount = camps.filter((c) => c.proximity !== 'other').length
  const filtering = q || chip !== 'all'

  return (
    <div className="w-full pb-8">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <nav className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">
            <span className="font-semibold text-primary">RedSync</span>
            <span>/</span>
            <span>Donor</span>
            <span>/</span>
            <span className="text-on-surface">Blood Camps</span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            Blood Donation Camps Near You
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
            Camps organised by approved hospitals, closest to you first. Register to let the hospital know you are
            coming.
          </p>
        </div>
        {mine.length > 0 && (
          <a
            href="#my-camps"
            className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md shadow-sm transition-all self-start lg:self-auto"
          >
            <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span>
            My registered camps ({mine.length})
          </a>
        )}
      </section>

      {/* Location strip */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-md mb-space-md">
        <div className="flex items-center gap-space-md min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">near_me</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-label-md text-label-md text-on-surface font-bold">Your location:</span>
              <span className="font-body-md text-body-md text-on-surface">
                {location.area}, {location.city} ({location.pin})
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {nearCount === 0
                ? `No upcoming camps in ${location.city} yet.`
                : `${nearCount} upcoming camp${nearCount === 1 ? '' : 's'} in ${location.city}.`}
            </span>
          </div>
        </div>
        <Link
          to="/donor/profile"
          className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container font-semibold self-start sm:self-center transition-colors"
        >
          <span>Change location</span>
          <span className="material-symbols-outlined text-[16px]">edit_location</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md mb-space-lg">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <label htmlFor="camp-search" className="sr-only">
            Search camps
          </label>
          <input
            id="camp-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by camp name, venue, hospital or PIN code…"
            className="w-full h-12 pl-12 pr-10 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary-container/30"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0" role="tablist" aria-label="Filter by date">
            {DATE_CHIPS.map((d) => (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={chip === d.key}
                onClick={() => setChip(d.key)}
                className={`px-space-md py-1.5 rounded-full font-label-sm text-label-sm shrink-0 transition-colors cursor-pointer ${
                  chip === d.key
                    ? 'bg-primary-fixed text-on-primary-fixed font-semibold'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-surface-container-low rounded-full p-0.5 self-start md:self-auto">
            {[
              { key: 'city', label: `My city` },
              { key: 'all', label: 'All cities' },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setScope(s.key)
                  setLoading(true)
                }}
                className={`px-space-md py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                  scope === s.key
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container mb-space-md">
          <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
          <p className="font-body-sm text-body-sm">{actionError}</p>
        </div>
      )}
      {!eligibility.eligible && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-amber-900 mb-space-md">
          <span className="material-symbols-outlined text-[20px] shrink-0">hourglass_top</span>
          <p className="font-body-sm text-body-sm">
            You can donate again on <strong>{formatDate(eligibility.next_eligible)}</strong>. You can register for
            camps that are held after that date.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* LEFT: camps */}
        <div className="lg:col-span-8 flex flex-col gap-space-lg min-w-0">
          {visible.length === 0 ? (
            <div className="p-10 text-center bg-surface-container-lowest rounded-2xl border border-surface-container">
              <span className="material-symbols-outlined text-secondary text-[36px]">
                {filtering ? 'filter_alt_off' : 'event_busy'}
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">
                {filtering ? 'No camps match your search' : `No upcoming camps in ${location.city}`}
              </h3>
              <p className="font-body-md text-body-md text-secondary mt-1">
                {filtering
                  ? 'Try a different date range or clear the search.'
                  : scope === 'city'
                  ? 'Hospitals add camps here when they plan one. You can also look at camps in other cities.'
                  : 'No hospital has scheduled a camp yet. Check back soon.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                {filtering && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setChip('all')
                    }}
                    className="px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
                {!filtering && scope === 'city' && (
                  <button
                    type="button"
                    onClick={() => {
                      setScope('all')
                      setLoading(true)
                    }}
                    className="px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
                  >
                    Show all cities
                  </button>
                )}
              </div>
            </div>
          ) : (
            GROUPS.map((g) => {
              const items = visible.filter((c) => c.proximity === g.key)
              if (items.length === 0) return null
              return (
                <section key={g.key} className="flex flex-col gap-space-md">
                  <div className="flex items-center justify-between px-1 gap-3">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[22px]">{g.icon}</span>
                      {g.key === 'city' ? `Elsewhere in ${location.city}` : g.title}
                    </h3>
                    {g.note && (
                      <span className="font-label-sm text-label-sm text-on-surface-variant hidden sm:inline">
                        {g.note}
                      </span>
                    )}
                  </div>
                  {items.map((c) => (
                    <CampCard key={c.id} c={c} today={today} busy={busy} onToggle={() => toggle(c)} />
                  ))}
                </section>
              )
            })
          )}
          <p className="font-body-sm text-body-sm text-on-surface-variant px-1">
            Closeness is worked out from PIN codes and cities, using the PIN code of the hospital that organises
            the camp, so check the venue before you travel.
          </p>
        </div>

        {/* RIGHT: my camps and checklist */}
        <aside className="lg:col-span-4 flex flex-col gap-space-lg">
          <div id="my-camps" className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md scroll-mt-28">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
                My registered camps
              </span>
              <span className="font-label-sm text-label-sm text-primary font-bold">{mine.length}</span>
            </div>
            {mine.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                You have not registered for any camp yet. Register for one and it will show up here.
              </p>
            ) : (
              <div className="flex flex-col gap-space-sm">
                {mine.map((c) => (
                  <div key={c.id} className="bg-surface-container-low p-space-md rounded-lg">
                    <h4 className="font-title-md text-[15px] leading-5 text-on-surface font-bold">{c.title}</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      {c.venue}, {c.city}
                    </p>
                    <div className="flex items-center gap-space-md mt-space-sm">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Date</span>
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          {whenLabel(c.camp_date, today)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Time</span>
                        <span className="font-label-md text-label-md text-primary font-bold">
                          {formatTime(c.start_time)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-xs mt-space-sm">
                      <a
                        href={directionsUrl(c)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm hover:bg-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">directions</span>
                        Directions
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggle(c)}
                        className="flex-1 inline-flex items-center justify-center py-1.5 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full bg-surface-container-low rounded-xl p-space-md">
            <h4 className="font-title-md text-title-md text-on-surface font-bold mb-space-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">task_alt</span>
              Before you go
            </h4>
            <ul className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface">
              {CHECKLIST.map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">check_circle</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}