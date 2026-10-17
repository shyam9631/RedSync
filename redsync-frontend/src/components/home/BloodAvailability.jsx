import { useState } from 'react'
import { Link } from 'react-router-dom'

const regions = ['All Regions', 'Central Zone', 'North Zone', 'South Zone']

// Sample data. The backend will provide real stock later.
const stock = [
  { group: 'A+', units: 84, pct: 85, status: 'available' },
  { group: 'A-', units: 12, pct: 25, status: 'low' },
  { group: 'B+', units: 62, pct: 65, status: 'available' },
  { group: 'B-', units: 4, pct: 10, status: 'critical' },
  { group: 'O+', units: 98, pct: 90, status: 'available' },
  { group: 'O-', units: 2, pct: 5, status: 'critical' },
  { group: 'AB+', units: 45, pct: 55, status: 'available' },
  { group: 'AB-', units: 8, pct: 18, status: 'low' },
]

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
  const [region, setRegion] = useState(regions[0])

  return (
    <section className="w-full py-16 px-6 sm:px-8 bg-surface-container-low rounded-3xl my-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 mb-2 font-label-sm text-label-sm text-secondary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
            </span>
            <span>Sample preview • Real stock appears once hospitals update it</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            Live Blood Availability Preview
          </h2>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl self-start md:self-auto overflow-x-auto">
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={
                region === r
                  ? 'px-3.5 py-1.5 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-on-surface shadow-sm cursor-pointer whitespace-nowrap'
                  : 'px-3.5 py-1.5 rounded-lg font-label-md text-label-md text-secondary hover:text-on-surface transition-colors cursor-pointer whitespace-nowrap'
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stock.map((s) => {
          const st = styles[s.status]
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
                    {s.units} Units
                  </span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className={`${st.bar} h-full rounded-full`} style={{ width: `${s.pct}%` }}></div>
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
    </section>
  )
}