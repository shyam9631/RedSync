import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'

const REFRESH_MS = 30000 // stock is re-read every 30 seconds
const BAR_MIN_SCALE = 40 // a bar is "full" at 40 units, or at the largest group if that is higher

const styles = {
  available: {
    label: 'Available',
    circle: 'bg-primary-container text-on-primary shadow-inner',
    badge: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    dot: 'bg-tertiary',
    bar: 'bg-tertiary',
    card: 'bg-surface-container-lowest',
    unitText: 'text-on-surface',
    caption: 'In Reserve',
    captionColor: 'text-secondary',
    requestLabel: 'Request',
  },
  low: {
    label: 'Low Stock',
    circle: 'bg-surface-container-highest text-on-surface',
    badge: 'bg-amber-100 text-amber-900',
    dot: 'bg-amber-600',
    bar: 'bg-amber-500',
    card: 'bg-surface-container-lowest',
    unitText: 'text-on-surface',
    caption: 'In Reserve',
    captionColor: 'text-secondary',
    requestLabel: 'Request',
  },
  critical: {
    label: 'Critical',
    circle: 'bg-error text-on-error',
    badge: 'bg-error-container text-on-error-container animate-pulse',
    dot: 'bg-error',
    bar: 'bg-error',
    card: 'bg-surface-container-lowest ring-2 ring-error-container',
    unitText: 'text-error',
    caption: 'Urgent Need',
    captionColor: 'text-error font-medium',
    requestLabel: 'SOS Request',
  },
}

export default function BloodAvailability() {
  const [hospitals, setHospitals] = useState(null) // approved hospitals, null while loading
  const [city, setCity] = useState('all')
  const [stock, setStock] = useState(null) // null while loading
  const [failed, setFailed] = useState(false)

  // Approved hospitals: gives the city list and the "N partner hospitals" count
  useEffect(() => {
    let alive = true
    api
      .get('/public/hospitals')
      .then((res) => alive && setHospitals(res.data))
      .catch(() => alive && setHospitals([]))
    return () => {
      alive = false
    }
  }, [])

  // Stock totals for the chosen city, refreshed on a timer
  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .get('/public/availability', { params: city === 'all' ? {} : { city } })
        .then((res) => {
          if (!alive) return
          setStock(res.data)
          setFailed(false)
        })
        .catch(() => alive && setFailed(true))
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [city])

  const cities = hospitals ? [...new Set(hospitals.map((h) => h.city))].sort() : []
  const hospitalCount =
    hospitals === null
      ? null
      : city === 'all'
      ? hospitals.length
      : hospitals.filter((h) => h.city === city).length
  const noHospitals = hospitals !== null && hospitals.length === 0
  const scale = stock ? Math.max(BAR_MIN_SCALE, ...stock.map((s) => s.units)) : BAR_MIN_SCALE

  return (
    <section className="w-full py-16 px-6 sm:px-8 bg-surface-container-low rounded-3xl my-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 mb-2 font-label-sm text-label-sm text-secondary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
            </span>
            <span>
              {failed && !stock
                ? 'Live stock unavailable right now'
                : hospitalCount === null
                ? 'Loading live stock…'
                : `Live from ${hospitalCount} partner hospital${hospitalCount === 1 ? '' : 's'}`}
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            Live Blood Availability
          </h2>
        </div>

        {cities.length > 1 && (
          <div className="self-start md:self-auto">
            <label htmlFor="avail-city" className="sr-only">
              Filter by city
            </label>
            <select
              id="avail-city"
              value={city}
              onChange={(e) => {
                setStock(null)
                setCity(e.target.value)
              }}
              className="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container cursor-pointer"
            >
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {failed && !stock ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-2xl">
          <span className="material-symbols-outlined text-secondary text-[32px]">cloud_off</span>
          <p className="font-body-md text-body-md text-secondary mt-2">
            Could not load blood availability right now. Please try again in a moment.
          </p>
        </div>
      ) : noHospitals ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-2xl">
          <span className="material-symbols-outlined text-secondary text-[32px]">local_hospital</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">
            No hospitals have joined yet
          </h3>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Live stock appears here as soon as an approved hospital updates its blood stock.
          </p>
          <Link
            to="/register/hospital"
            className="inline-block mt-4 px-5 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-colors"
          >
            Register your hospital
          </Link>
        </div>
      ) : !stock ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-surface-container-lowest animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stock.map((s) => {
            const st = styles[s.status]
            const pct = Math.min(100, Math.round((s.units / scale) * 100))
            return (
              <div
                key={s.group}
                className={`${st.card} p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-12 h-12 rounded-full ${st.circle} font-badge-blood-group text-badge-blood-group flex items-center justify-center`}
                  >
                    {s.group}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full ${st.badge} font-label-sm text-label-sm font-bold flex items-center gap-1`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                    {st.label}
                  </span>
                </div>

                <div className="my-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className={`font-body-sm text-body-sm ${st.captionColor}`}>{st.caption}</span>
                    <span className={`font-headline-sm text-headline-sm ${st.unitText}`}>
                      {s.units} {s.units === 1 ? 'Unit' : 'Units'}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className={`${st.bar} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    to={`/request-blood?group=${encodeURIComponent(s.group)}`}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    {st.requestLabel} {s.status === 'critical' ? '' : s.group}
                  </Link>
                  <Link
                    to="/register/donor"
                    className="font-label-sm text-label-sm text-secondary hover:text-on-surface"
                  >
                    {s.status === 'available' ? 'Donate' : 'Donate Now'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-5 font-body-sm text-[12px] text-secondary">
        Totals across approved hospitals, refreshed every 30 seconds. Always call the hospital to
        confirm before travelling.
      </p>
    </section>
  )
}