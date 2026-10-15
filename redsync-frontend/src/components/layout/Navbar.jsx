import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const links = [
  { to: '/find-blood', label: 'Find Blood' },
  { to: '/donate', label: 'Donate' },
  { to: '/camps', label: 'Camps' },
  { to: '/how-it-works', label: 'How it Works' },
  { to: '/for-hospitals', label: 'For Hospitals' },
]

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिं' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [lang, setLang] = useState('en')

  const linkClass = ({ isActive }) =>
    isActive
      ? 'transition-colors bg-primary-container text-on-primary-container font-headline-sm text-label-md rounded-full px-space-md py-space-xs'
      : 'font-label-md text-label-md text-on-surface-variant hover:text-on-surface px-space-sm py-space-xs transition-colors'

  return (
    <header className="sticky top-0 z-50 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container-highest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-7xl mx-auto px-margin flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-space-sm focus:outline-none">
          <span
            className="material-symbols-outlined text-primary-container text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            water_drop
          </span>
          <span className="font-headline-sm text-headline-sm text-primary tracking-tight">
            RedSync
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden lg:flex items-center gap-space-md">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-space-sm sm:gap-space-md">
          {/* Language switcher */}
          <div className="hidden sm:flex items-center bg-surface-container-low px-2 py-1 rounded-full border border-surface-container-highest font-label-sm text-label-sm">
            {languages.map((l, i) => (
              <span key={l.code} className="flex items-center">
                {i > 0 && <span className="text-secondary-fixed-dim px-1">/</span>}
                <button
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={
                    lang === l.code
                      ? 'px-2 py-0.5 rounded-full bg-surface-container-lowest font-semibold text-primary shadow-sm'
                      : 'px-1.5 py-0.5 text-secondary hover:text-on-surface transition-colors cursor-pointer'
                  }
                >
                  {l.label}
                </button>
              </span>
            ))}
          </div>

          <Link
            to="/login"
            className="font-label-md text-label-md text-on-surface px-space-md py-space-xs rounded-full border border-outline hover:bg-surface-container-low transition-all"
          >
            Login
          </Link>

          <Link
            to="/request-blood"
            className="hidden sm:inline-flex items-center justify-center font-label-md text-label-md bg-primary-container text-on-primary hover:bg-primary px-space-lg py-space-xs rounded-full transition-all shadow-[0_4px_12px_rgba(198,40,40,0.2)] hover:shadow-none"
          >
            Request Blood
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="lg:hidden border-t border-surface-container-highest bg-surface-container-lowest px-margin py-space-md flex flex-col gap-space-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className="font-label-md text-label-md text-on-surface py-space-sm"
            >
              {l.label}
            </NavLink>
          ))}
          <Link
            to="/request-blood"
            onClick={() => setMenuOpen(false)}
            className="mt-space-sm text-center font-label-md text-label-md bg-primary-container text-on-primary px-space-lg py-space-sm rounded-full"
          >
            Request Blood
          </Link>
        </nav>
      )}
    </header>
  )
}