import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import { formatDate } from '../../data/donorDemo'

const PAGE = 10

async function fetchAll() {
  const [dash, history] = await Promise.all([api.get('/donor/dashboard'), api.get('/donor/history')])
  return { profile: dash.data.profile, eligibility: dash.data.eligibility, history: history.data }
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function downloadCsv(rows, donorName) {
  const lines = [
    ['Date', 'Hospital', 'Component', 'Units'].map(csvCell).join(','),
    ...rows.map((h) => [h.date, h.hospital, h.component, h.units].map(csvCell).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `redsync-donations-${donorName.split(' ')[0].toLowerCase()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Tile({ icon, label, value, note, accent }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm min-w-0">
      <div className="flex items-center gap-1.5 text-primary mb-1">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
      </div>
      <div
        className={`font-headline-md text-headline-md font-bold truncate ${accent ? 'text-primary' : 'text-on-surface'}`}
      >
        {value}
      </div>
      {note && <span className="font-body-sm text-body-sm text-on-surface-variant">{note}</span>}
    </div>
  )
}

export default function DonorHistory() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [year, setYear] = useState('all')
  const [component, setComponent] = useState('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

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

  const retry = () => {
    setLoading(true)
    setLoadError('')
    fetchAll()
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading your donation history…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load your history</h2>
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
  const totalUnits = history.reduce((s, h) => s + h.units, 0)
  const years = [...new Set(history.map((h) => h.date.slice(0, 4)))].sort().reverse()
  const components = [...new Set(history.map((h) => h.component))].sort()
  const hospitals = new Set(history.map((h) => h.hospital)).size
  const q = query.trim().toLowerCase()

  const filtered = history.filter(
    (h) =>
      (year === 'all' || h.date.startsWith(year)) &&
      (component === 'all' || h.component === component) &&
      (!q || h.hospital.toLowerCase().includes(q))
  )
  const filtering = year !== 'all' || component !== 'all' || q
  const visible = filtered.slice(0, shown)

  const resetFilters = () => {
    setYear('all')
    setComponent('all')
    setQuery('')
    setShown(PAGE)
  }

  return (
    <div className="w-full pb-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <nav className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">
            <span className="font-semibold text-primary">RedSync</span>
            <span>/</span>
            <span>Donor</span>
            <span>/</span>
            <span className="text-on-surface">Donation History</span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            Donation History
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
            Every donation a hospital has recorded for you. Only the hospital can add entries, so this list is a
            trusted record.
          </p>
        </div>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={() => downloadCsv(filtered, profile.name)}
          className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-full bg-surface-container-lowest hover:bg-surface-container-low text-primary border border-outline-variant/40 font-label-md text-label-md shadow-sm transition-all cursor-pointer self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Download CSV
        </button>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        <Tile icon="bloodtype" label="Donations" value={history.length} note="Confirmed by hospitals" />
        <Tile
          icon="water_drop"
          label="Units"
          value={totalUnits}
          note={hospitals > 0 ? `At ${hospitals} hospital${hospitals === 1 ? '' : 's'}` : 'Total donated'}
          accent
        />
        <Tile
          icon="event"
          label="Last donation"
          value={profile.never_donated ? 'Never' : formatDate(profile.last_donation)}
          note={profile.never_donated ? 'No donation on record' : 'Recorded by a hospital'}
        />
        <Tile
          icon="timelapse"
          label="Next eligible"
          value={eligibility.eligible ? 'Now' : formatDate(eligibility.next_eligible)}
          note={
            eligibility.eligible
              ? 'You can donate today'
              : `${eligibility.days_left} day${eligibility.days_left === 1 ? '' : 's'} to go`
          }
          accent={eligibility.eligible}
        />
      </div>

      {!eligibility.eligible && (
        <div className="mb-space-lg rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant mb-2">
            <span className="font-semibold">Recovery period ({eligibility.gap_days} days)</span>
            <span className="text-primary font-bold">{eligibility.percent}% complete</span>
          </div>
          <div
            className="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden"
            role="progressbar"
            aria-valuenow={eligibility.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary-container" style={{ width: `${eligibility.percent}%` }}></div>
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div className="p-10 text-center bg-surface-container-lowest rounded-2xl border border-surface-container">
          <span className="material-symbols-outlined text-secondary text-[36px]">history</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">No donations recorded yet</h3>
          <p className="font-body-md text-body-md text-secondary mt-1 max-w-md mx-auto">
            When a hospital records a donation for you, it appears here. You can start by answering an urgent
            request or joining a camp.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <Link
              to="/donor/requests"
              className="px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md"
            >
              See urgent requests
            </Link>
            <Link
              to="/donor/camps"
              className="px-5 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            >
              Find a camp
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm mb-space-md">
            <div className="relative w-full lg:max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <label htmlFor="hist-search" className="sr-only">
                Search by hospital
              </label>
              <input
                id="hist-search"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShown(PAGE)
                }}
                placeholder="Search by hospital…"
                className="w-full h-10 pl-10 pr-3 rounded-full bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary-container/30"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="hist-year" className="sr-only">
                Year
              </label>
              <select
                id="hist-year"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value)
                  setShown(PAGE)
                }}
                className="h-10 px-4 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface focus:outline-none cursor-pointer"
              >
                <option value="all">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {components.length > 1 && (
                <>
                  <label htmlFor="hist-comp" className="sr-only">
                    Component
                  </label>
                  <select
                    id="hist-comp"
                    value={component}
                    onChange={(e) => {
                      setComponent(e.target.value)
                      setShown(PAGE)
                    }}
                    className="h-10 px-4 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface focus:outline-none cursor-pointer"
                  >
                    <option value="all">All components</option>
                    {components.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {filtering && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-primary hover:underline font-label-md text-label-md font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center font-body-md text-body-md text-secondary">
              No donations match these filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-sm text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3 rounded-l-lg">Date</th>
                      <th className="py-2.5 px-3">Hospital</th>
                      <th className="py-2.5 px-3">Type & volume</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-sm text-body-sm text-on-surface">
                    {visible.map((h) => (
                      <tr key={h.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3 px-3 font-semibold whitespace-nowrap">{formatDate(h.date)}</td>
                        <td className="py-3 px-3 font-semibold">{h.hospital}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-primary">{h.component}</span>
                          <span className="text-on-surface-variant text-[11px] block">
                            {h.units} unit{h.units === 1 ? '' : 's'}
                          </span>
                        </td>
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
              <div className="mt-space-md flex items-center justify-between gap-3 flex-wrap">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Showing {visible.length} of {filtered.length}
                  {filtering ? ' matching' : ''} donation{filtered.length === 1 ? '' : 's'}
                </span>
                {filtered.length > shown && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE)}
                    className="px-5 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer"
                  >
                    Show more
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}