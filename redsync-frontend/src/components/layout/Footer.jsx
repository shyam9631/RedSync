import { Link } from 'react-router-dom'

const donorLinks = [
  { to: '/find-blood', label: 'Find Blood Near Me' },
  { to: '/register/donor', label: 'Register as Donor' },
  { to: '/compatibility', label: 'Blood Compatibility Guide' },
  { to: '/camps', label: 'Donation Camps' },
  { to: '/how-it-works', label: 'How Requests Work' },
]

const hospitalLinks = [
  { to: '/login/hospital', label: 'Hospital Login' },
  { to: '/register/hospital', label: 'Register Your Hospital' },
  { to: '/for-hospitals', label: 'For Hospitals' },
]

const supportLinks = [
  { to: '/faq', label: 'Donor FAQs' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/contact', label: 'Contact Us' },
]

function LinkColumn({ title, items }) {
  return (
    <div className="flex flex-col space-y-3">
      <h4 className="font-headline-sm text-sm text-on-primary uppercase tracking-wider">
        {title}
      </h4>
      <ul className="space-y-2.5 font-body-md text-body-md text-secondary-fixed-dim">
        {items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="hover:text-on-primary transition-colors">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer() {
  return (
    <footer className="w-full bg-inverse-surface text-inverse-on-surface pt-16 pb-10 px-8 sm:px-12 rounded-3xl mt-12 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12">
        {/* Brand */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary-fixed-dim text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              water_drop
            </span>
            <span className="font-headline-md text-headline-sm text-on-primary">RedSync</span>
          </div>
          <p className="font-body-md text-body-md text-secondary-fixed-dim max-w-sm">
            Empowering communities to save lives through real-time blood connectivity,
            rapid coordination, and verified donor response.
          </p>
        </div>

        <div className="lg:col-span-3">
          <LinkColumn title="Patients & Donors" items={donorLinks} />
        </div>

        <div className="lg:col-span-2">
          <LinkColumn title="Hospitals" items={hospitalLinks} />
        </div>

        <div className="lg:col-span-3 flex flex-col space-y-3">
          <h4 className="font-headline-sm text-sm text-on-primary uppercase tracking-wider">
            Emergency & Support
          </h4>
          <div className="p-4 rounded-xl bg-surface-container-highest/10 space-y-2">
            <span className="font-label-sm text-label-sm text-primary-fixed block font-bold">
              24/7 Emergency Line
            </span>
            <a
              href="tel:+910000000000"
              className="font-headline-sm text-lg text-on-primary block hover:underline"
            >
              +91 XXXXX XXXXX
            </a>
          </div>
          <ul className="space-y-2 font-body-md text-body-md text-secondary-fixed-dim pt-2">
            {supportLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-on-primary transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-secondary-fixed-dim">
        <p>© 2026 RedSync. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="hover:text-on-primary transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-on-primary transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}