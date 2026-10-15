const steps = [
  {
    number: '01',
    icon: 'post_add',
    iconBox: 'bg-primary-fixed text-primary',
    title: 'Post or Search Need',
    text: 'Enter patient details, required blood component (PRBC, Platelets, Plasma), hospital location, and urgency status.',
    noteIcon: 'bolt',
    note: 'Fast request creation without long forms',
    noteColor: 'text-primary',
  },
  {
    number: '02',
    icon: 'hub',
    iconBox: 'bg-surface-container-high text-on-surface',
    title: 'Instant Smart Match',
    text: 'Automated alerts notify nearby verified donors and affiliated blood banks immediately via WhatsApp and SMS.',
    noteIcon: 'sensors',
    note: 'Local area radius matching',
    noteColor: 'text-tertiary',
  },
  {
    number: '03',
    icon: 'qr_code_scanner',
    iconBox: 'bg-tertiary-fixed text-tertiary-container',
    title: 'Direct Coordination',
    text: 'Donors arrive at the hospital blood bank or center with verified confirmation to complete the donation promptly.',
    noteIcon: 'verified',
    note: 'Secure coordinator verification',
    noteColor: 'text-secondary',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full py-20">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
          Simple & Lifesaving Process
        </span>
        <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mt-2 tracking-tight">
          How RedSync Works in 3 Quick Steps
        </h2>
        <p className="font-body-lg text-body-lg text-secondary mt-3">
          Automated real-time matching connects hospitals with available volunteer donors within seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s) => (
          <div
            key={s.number}
            className="bg-surface-container-lowest p-8 rounded-2xl shadow-md flex flex-col justify-between hover:shadow-xl transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-headline-lg text-4xl text-primary-fixed-dim font-extrabold">
                  {s.number}
                </span>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.iconBox}`}>
                  <span className="material-symbols-outlined text-2xl">{s.icon}</span>
                </div>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{s.title}</h3>
              <p className="font-body-md text-body-md text-secondary">{s.text}</p>
            </div>
            <div className={`mt-8 pt-4 flex items-center gap-2 font-label-md text-label-md ${s.noteColor}`}>
              <span className="material-symbols-outlined text-sm">{s.noteIcon}</span>
              <span>{s.note}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}