const groups = [
  {
    group: 'O-',
    name: 'O Negative',
    note: 'Can save all blood types',
    donateAll: true,
    donate: [],
    receive: ['O-'],
    receiveOnlyText: 'O- only',
    tag: 'Universal Donor',
    tone: 'donor',
  },
  {
    group: 'O+',
    name: 'O Positive',
    note: 'Most common blood type',
    donate: ['O+', 'A+', 'B+', 'AB+'],
    receive: ['O+', 'O-'],
    positive: true,
  },
  {
    group: 'A-',
    name: 'A Negative',
    note: 'Rare negative group',
    donate: ['A-', 'A+', 'AB-', 'AB+'],
    receive: ['A-', 'O-'],
  },
  {
    group: 'A+',
    name: 'A Positive',
    note: 'High daily demand',
    donate: ['A+', 'AB+'],
    receive: ['A+', 'A-', 'O+', 'O-'],
    positive: true,
  },
  {
    group: 'B-',
    name: 'B Negative',
    note: 'Rare negative group',
    donate: ['B-', 'B+', 'AB-', 'AB+'],
    receive: ['B-', 'O-'],
  },
  {
    group: 'B+',
    name: 'B Positive',
    note: 'Frequently requested',
    donate: ['B+', 'AB+'],
    receive: ['B+', 'B-', 'O+', 'O-'],
    positive: true,
  },
  {
    group: 'AB-',
    name: 'AB Negative',
    note: 'Rarest blood type',
    donate: ['AB-', 'AB+'],
    receive: ['AB-', 'A-', 'B-', 'O-'],
  },
  {
    group: 'AB+',
    name: 'AB Positive',
    note: 'Receives from any group',
    donate: [],
    donateOnlyText: 'AB+ only',
    receiveAll: true,
    tag: 'Universal Recipient',
    tone: 'recipient',
    positive: true,
  },
]

function Chips({ items, chipClass }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i} className={`px-1.5 py-0.5 rounded font-semibold ${chipClass}`}>
          {i}
        </span>
      ))}
    </div>
  )
}

export default function CompatibilityChart() {
  return (
    <section className="w-full py-20">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <span className="text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
          Compatibility Guide
        </span>
        <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mt-2 tracking-tight">
          Who Can Donate To Whom
        </h2>
        <p className="font-body-lg text-body-lg text-secondary mt-2">
          Blood compatibility guide for safe donations and emergency transfusions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {groups.map((g) => {
          const border =
            g.tone === 'donor'
              ? 'border-2 border-primary-fixed'
              : g.tone === 'recipient'
              ? 'border-2 border-tertiary-fixed'
              : ''
          const circle =
            g.tone === 'recipient'
              ? 'bg-tertiary-container text-on-tertiary'
              : g.tone === 'donor'
              ? 'bg-primary text-on-primary shadow-md'
              : g.positive
              ? 'bg-primary-container text-on-primary'
              : 'bg-surface-container-highest text-on-surface'
          const tagColor =
            g.tone === 'recipient'
              ? 'bg-tertiary-container text-on-tertiary'
              : 'bg-primary text-on-primary'

          return (
            <div
              key={g.group}
              className={`bg-surface-container-lowest p-6 rounded-2xl shadow-md ${border} relative overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all`}
            >
              {g.tag && (
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full ${tagColor} text-[10px] font-bold uppercase tracking-wider`}
                  >
                    {g.tag}
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-full ${circle} font-badge-blood-group text-badge-blood-group flex items-center justify-center`}
                  >
                    {g.group}
                  </div>
                  <div>
                    <h3 className="font-title-md text-base text-on-surface font-semibold">{g.name}</h3>
                    <span className="text-xs text-secondary">{g.note}</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2 text-xs font-body-sm">
                  <div>
                    <span className="text-secondary block font-semibold mb-1">Can Donate To:</span>
                    {g.donateAll ? (
                      <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold text-[11px]">
                        All Types (Universal)
                      </span>
                    ) : g.donateOnlyText ? (
                      <span className="px-2 py-0.5 rounded bg-surface-container font-semibold text-on-surface text-[11px]">
                        {g.donateOnlyText}
                      </span>
                    ) : (
                      <Chips items={g.donate} chipClass="bg-surface-container-low text-primary" />
                    )}
                  </div>

                  <div>
                    <span className="text-secondary block font-semibold mb-1">Can Receive From:</span>
                    {g.receiveAll ? (
                      <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold text-[11px]">
                        All Types (Universal)
                      </span>
                    ) : g.receiveOnlyText ? (
                      <span className="px-2 py-0.5 rounded bg-surface-container font-semibold text-on-surface text-[11px]">
                        {g.receiveOnlyText}
                      </span>
                    ) : (
                      <Chips items={g.receive} chipClass="bg-surface-container text-on-surface" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}