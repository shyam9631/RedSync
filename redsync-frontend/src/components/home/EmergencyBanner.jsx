import { Link } from 'react-router-dom'

export default function EmergencyBanner() {
  return (
    <section className="w-full my-12">
      <div className="relative bg-gradient-to-r from-primary-container via-primary to-primary-container text-on-primary py-12 px-8 sm:px-12 rounded-3xl shadow-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg">
            <circle cx="700" cy="150" fill="none" r="160" stroke="currentColor" strokeWidth="12" />
            <circle cx="700" cy="150" fill="none" r="100" stroke="currentColor" strokeWidth="8" />
            <circle cx="700" cy="150" fill="none" r="40" stroke="currentColor" strokeWidth="4" />
            <path d="M-50 150 Q 200 40 400 150 T 850 150" fill="none" stroke="currentColor" strokeWidth="6" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-4xl text-on-primary animate-pulse"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                emergency_heat
              </span>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/20 text-on-primary font-label-sm text-label-sm uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-ping"></span>
                Emergency Support
              </div>
              <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-primary tracking-tight">
                Medical emergency? Request blood right now.
              </h2>
              <p className="font-body-md text-body-md text-on-primary-container max-w-xl mt-1">
                Send an urgent request to nearby donors and hospitals, or call our emergency helpline.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
            <a
              href="tel:+910000000000"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-surface-container-lowest text-primary hover:bg-surface-container-low px-8 py-4 rounded-full font-headline-sm text-base shadow-xl transition-all"
            >
              <span
                className="material-symbols-outlined text-2xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                call
              </span>
              <span>+91 XXXXX XXXXX</span>
            </a>
            <Link
              to="/request-blood"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-black/30 hover:bg-black/40 text-on-primary px-6 py-4 rounded-full font-label-md text-label-md backdrop-blur-sm transition-all"
            >
              <span className="material-symbols-outlined text-lg">campaign</span>
              <span>Send Urgent Request</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}