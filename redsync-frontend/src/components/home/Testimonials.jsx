// Sample text. Replace with real stories once RedSync is in use.
const reviews = [
  {
    icon: 'local_hospital',
    iconBox: 'bg-primary-fixed text-primary',
    role: 'Hospital Staff',
    sub: 'Emergency Department',
    text: '“Coordinating directly with local donors makes emergency handoffs much smoother for our team.”',
  },
  {
    icon: 'volunteer_activism',
    iconBox: 'bg-tertiary-fixed text-tertiary',
    role: 'Donor',
    sub: 'Regular Volunteer Donor',
    text: '“The alerts are relevant and only reach me when someone nearby needs my blood group.”',
  },
  {
    icon: 'family_restroom',
    iconBox: 'bg-surface-container-high text-on-surface',
    role: "Patient's Family",
    sub: 'Requester',
    text: '“When we needed blood urgently, finding willing donors in one place made a stressful night easier.”',
  },
]

export default function Testimonials() {
  return (
    <section className="w-full py-20">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
          Stories That Matter
        </span>
        <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mt-2 tracking-tight">
          Built for Donors, Patients, and Hospitals
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-2">
          Sample feedback shown for design. Real stories will appear here.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reviews.map((r) => (
          <div
            key={r.role}
            className="bg-surface-container-lowest p-8 rounded-2xl shadow-md flex flex-col justify-between hover:shadow-xl transition-shadow overflow-hidden"
          >
            <div>
              <div className="flex items-center gap-1 text-amber-500 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                ))}
              </div>
              <p className="font-body-lg text-body-md text-on-surface italic">{r.text}</p>
            </div>

            <div className="flex items-center gap-4 mt-8 pt-6 bg-surface-container-low/50 -mx-8 -mb-8 px-8 py-5">
              <div className={`w-12 h-12 rounded-full ${r.iconBox} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-2xl">{r.icon}</span>
              </div>
              <div>
                <div className="font-headline-sm text-sm text-on-surface">{r.role}</div>
                <div className="font-body-sm text-body-sm text-secondary">{r.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
