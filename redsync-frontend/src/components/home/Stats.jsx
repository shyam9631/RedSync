const stats = [
  {
    icon: 'volunteer_activism',
    value: '50,000+',
    label: 'Registered Donors',
    iconBox: 'bg-primary-fixed text-primary',
    fill: true,
  },
  {
    icon: 'local_hospital',
    value: '1,500+',
    label: 'Partner Hospitals',
    iconBox: 'bg-surface-container-high text-on-surface',
    fill: false,
  },
  {
    icon: 'verified',
    value: '99%+',
    label: 'Requests Fulfilled',
    iconBox: 'bg-tertiary-fixed text-tertiary-container',
    fill: false,
  },
  {
    icon: 'timer',
    value: '< 10 Mins',
    label: 'Avg. Response Time',
    iconBox: 'bg-error-container text-primary-container',
    fill: false,
  },
]

export default function Stats() {
  return (
    <section className="w-full py-12 bg-surface-container-lowest shadow-sm my-6 rounded-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="p-6 rounded-2xl bg-surface-container-low flex items-center gap-4 transition-transform hover:-translate-y-1"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${s.iconBox}`}>
              <span
                className="material-symbols-outlined text-3xl"
                style={s.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {s.icon}
              </span>
            </div>
            <div>
              <div className="font-headline-md text-headline-md text-on-surface">{s.value}</div>
              <div className="font-body-md text-body-md text-secondary">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}