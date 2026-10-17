import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const quotes = [
  {
    icon: 'water_drop',
    text: '“A single drop of blood can make a huge ocean of difference.”',
    caption: 'The Ripple of Compassion',
  },
  {
    icon: 'celebration',
    text: '“To give blood is to give another birthday, another anniversary, another day to someone in need.”',
    caption: 'Renewing Tomorrow',
  },
  {
    icon: 'favorite',
    text: '“Your blood drop creates a heartbeat. The gift of blood is the gift of life.”',
    caption: 'The Human Lifeline',
  },
]

export default function Welcome() {
  const { user } = useAuth()

  return (
    <main className="w-full min-h-screen relative overflow-hidden bg-background antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      <section className="relative w-full overflow-hidden py-space-xl lg:py-28 flex flex-col items-center justify-center">
        {/* Logo and login */}
        <div className="w-full max-w-5xl px-margin flex flex-col items-center text-center pt-space-xl mb-space-xl relative z-10">
          <div className="flex flex-col items-center justify-center gap-space-sm mb-space-lg">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-sm mb-space-xs border border-primary/20">
              <span className="material-symbols-outlined text-4xl">bloodtype</span>
            </div>
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Red<span className="text-primary">Sync</span>
            </span>
          </div>

          <div className="flex flex-col items-center gap-space-md">
            <Link
              to={user ? `/${user.role}/dashboard` : '/login'}
              className="inline-flex items-center justify-center gap-space-sm h-14 px-10 rounded-full bg-primary text-on-primary font-headline-sm text-headline-sm tracking-wide hover:bg-primary-container transition-all duration-200 transform hover:-translate-y-0.5 shadow-[0_10px_25px_-5px_rgba(198,40,40,0.35)]"
            >
              <span>{user ? 'Go to Dashboard' : 'Login'}</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>

            <Link
              to="/home"
              className="font-label-md text-label-md text-secondary hover:text-primary transition-colors"
            >
              Explore RedSync
            </Link>
          </div>
        </div>

        {/* Voices of Hope */}
        <div className="w-full max-w-6xl px-margin pb-space-xl relative z-10">
          <div className="text-center mb-space-lg">
            <span className="font-label-md text-label-md uppercase tracking-widest text-primary font-bold">
              Voices of Hope
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
            {quotes.map((q) => (
              <div
                key={q.caption}
                className="group relative p-space-xl rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between bg-surface-container-lowest border border-outline-variant/30"
              >
                <div className="mb-space-md">
                  <span className="material-symbols-outlined text-primary text-3xl mb-space-sm block">
                    {q.icon}
                  </span>
                  <p className="font-headline-sm text-headline-sm leading-snug text-on-surface">
                    {q.text}
                  </p>
                </div>
                <div className="pt-space-md">
                  <div className="w-8 h-1 group-hover:w-16 transition-all duration-300 rounded-full mb-space-sm bg-primary"></div>
                  <span className="font-body-sm text-body-sm text-secondary">{q.caption}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}