import { Link } from 'react-router-dom'

// Sample camps. Real camps will come from the backend.
const camps = [
  {
    when: 'This Weekend',
    highlight: true,
    slots: '38 slots left',
    title: 'Central Civic Center Mega Drive',
    time: 'Saturday, 10:00 AM – 4:00 PM',
    place: 'Main Auditorium, Civic Center',
    organizer: 'Community Health Trust',
    note: 'Walk-ins welcome',
  },
  {
    when: 'Next Tuesday',
    slots: '22 slots left',
    title: 'Metro Tech Park Blood Drive',
    time: 'Tuesday, 9:00 AM – 3:30 PM',
    place: 'Building 4 Atrium, Tech Park',
    organizer: 'Metro Healthcare Guild',
    note: 'Refreshments provided',
  },
  {
    when: 'Next Sunday',
    slots: '45 slots left',
    title: 'University Campus Community Camp',
    time: 'Sunday, 10:30 AM – 5:00 PM',
    place: 'Student Activity Center',
    organizer: 'Student Volunteer Wing',
    note: 'Open to all eligible donors',
  },
]

export default function DonationCamps() {
  return (
    <section className="w-full py-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <span className="text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
            Community Drives
          </span>
          <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mt-1 tracking-tight">
            Upcoming Donation Camps
          </h2>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Join scheduled blood drives happening near your neighborhood.
          </p>
        </div>
        <Link
          to="/camps"
          className="inline-flex items-center gap-1 text-primary hover:underline font-label-md text-label-md font-semibold self-start sm:self-auto"
        >
          View all camps <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {camps.map((c) => (
          <div
            key={c.title}
            className="bg-surface-container-lowest p-6 rounded-2xl shadow-md border border-surface-container hover:shadow-xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    c.highlight ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  {c.when}
                </span>
                <span className="text-xs font-semibold text-tertiary">{c.slots}</span>
              </div>
              <h3 className="font-title-md text-base text-on-surface font-semibold mb-2">{c.title}</h3>
              <div className="space-y-2 text-xs text-secondary font-body-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>{c.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  <span>{c.place}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">corporate_fare</span>
                  <span>Organizer: {c.organizer}</span>
                </div>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-surface-container-high flex items-center justify-between">
              <span className="text-xs text-secondary">{c.note}</span>
              <Link
                to="/camps"
                className="bg-primary-container text-on-primary hover:bg-primary px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}