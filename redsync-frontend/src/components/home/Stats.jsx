import { useEffect, useState } from 'react'
import api from '../../lib/api'

// Real totals from the backend. Nothing here is a made-up figure.
const tiles = [
  {
    key: 'donors',
    icon: 'volunteer_activism',
    label: 'Registered Donors',
    iconBox: 'bg-primary-fixed text-primary',
    fill: true,
  },
  {
    key: 'hospitals',
    icon: 'local_hospital',
    label: 'Partner Hospitals',
    iconBox: 'bg-surface-container-high text-on-surface',
    fill: false,
  },
  {
    key: 'donations',
    icon: 'bloodtype',
    label: 'Donations Recorded',
    iconBox: 'bg-tertiary-fixed text-tertiary-container',
    fill: false,
  },
  {
    key: 'requests_fulfilled',
    icon: 'verified',
    label: 'Requests Fulfilled',
    iconBox: 'bg-error-container text-primary-container',
    fill: false,
  },
]

export default function Stats() {
  const [stats, setStats] = useState(null) // null while loading or if the server is unreachable

  useEffect(() => {
    let alive = true
    api
      .get('/public/stats')
      .then((res) => alive && setStats(res.data))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="w-full py-12 bg-surface-container-lowest shadow-sm my-6 rounded-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6">
        {tiles.map((t) => (
          <div
            key={t.key}
            className="p-6 rounded-2xl bg-surface-container-low flex items-center gap-4 transition-transform hover:-translate-y-1"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${t.iconBox}`}>
              <span
                className="material-symbols-outlined text-3xl"
                style={t.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {t.icon}
              </span>
            </div>
            <div>
              <div className="font-headline-md text-headline-md text-on-surface">
                {stats ? stats[t.key].toLocaleString('en-IN') : '–'}
              </div>
              <div className="font-body-md text-body-md text-secondary">{t.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}