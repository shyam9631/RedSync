import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { DONOR_NOTIFICATIONS, HOSPITAL_NOTIFICATIONS } from '../../data/donorDemo'

const NAV = {
  donor: [
    { to: '/donor/dashboard', label: 'Dashboard', end: true },
    { to: '/donor/requests', label: 'Urgent Requests' },
    { to: '/donor/camps', label: 'Blood Camps' },
    { to: '/donor/history', label: 'Donation History' },
    { to: '/donor/profile', label: 'My Profile' },
  ],
  hospital: [
    { to: '/hospital/dashboard', label: 'Dashboard', end: true },
    { to: '/hospital/stock', label: 'Blood Stock' },
    { to: '/hospital/donors', label: 'Donor Registry' },
    { to: '/hospital/requests', label: 'Requests' },
    { to: '/hospital/camps', label: 'Donation Camps' },
  ],
}

const PORTAL_LABEL = { donor: 'Donor Portal', hospital: 'Hospital Portal' }

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिं' },
]

export default function DashboardNavbar({ role }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = NAV[role] || NAV.donor

  const [menuOpen, setMenuOpen] = useState(false)
  const [lang, setLang] = useState('en')
  const [notifOpen, setNotifOpen] = useState(false)
  const [items, setItems] = useState(
    role === 'hospital' ? HOSPITAL_NOTIFICATIONS : DONOR_NOTIFICATIONS
  )
  const bellRef = useRef(null)

  const unread = items.filter((n) => n.unread).length

  // Close the notification dropdown on outside click or Escape
  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setNotifOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen])

  const markRead = (id) =>
    setItems((list) => list.map((n) => (n.id === id ? { ...n, unread: false } : n)))
  const markAll = () => setItems((list) => list.map((n) => ({ ...n, unread: false })))

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  const linkClass = ({ isActive }) =>
    isActive
      ? 'px-space-md py-space-xs rounded-full transition-all bg-primary-fixed text-on-primary-fixed font-label-md text-label-md font-semibold'
      : 'px-space-md py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all'

  return (
    <header className="sticky top-0 z-50 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container-highest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1280px] mx-auto px-margin flex items-center justify-between gap-space-md">
        {/* Logo */}
        <Link to={`/${role}/dashboard`} className="flex items-center gap-space-sm group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm transition-transform group-hover:scale-105">
            <span className="material-symbols-outlined text-[24px]">water_drop</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight leading-none">
              RedSync
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-wider uppercase mt-1">
              {PORTAL_LABEL[role]}
            </span>
          </div>
        </Link>

        {/* Desktop links */}
        <nav className="hidden xl:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-space-sm sm:gap-space-md shrink-0">
          {/* Language switcher */}
          <div className="hidden lg:flex items-center bg-surface-container-low px-2 py-1 rounded-full border border-surface-container-highest font-label-sm text-label-sm">
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

          {/* Notifications */}
          <div className="relative" ref={bellRef}>
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((o) => !o)}
              className="relative w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unread > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-primary-container ring-2 ring-surface-container-lowest"></span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-headline-sm text-[16px] leading-5 font-bold text-on-surface">
                      Notifications
                    </h2>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 bg-error-container text-primary font-label-sm text-[11px] font-bold rounded-full">
                        {unread} unread
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={markAll}
                    className="font-label-sm text-[11px] text-secondary hover:text-primary transition-colors cursor-pointer"
                  >
                    Mark all as read
                  </button>
                </div>

                <div className="divide-y divide-surface-container-high max-h-80 overflow-y-auto">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="w-full text-left py-3 flex items-start gap-3 hover:bg-surface-container-low -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-2 ${
                          n.unread ? 'bg-primary-container' : 'bg-surface-container-highest'
                        }`}
                      ></span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-label-md text-label-md font-semibold text-on-surface">
                          {n.title}
                        </span>
                        <span className="block font-body-sm text-[12px] text-secondary mt-0.5">
                          {n.text}
                        </span>
                        <span className="block font-body-sm text-[10px] text-outline mt-1">
                          {n.time}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            to="/request-blood"
            className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">emergency</span>
            <span className="hidden sm:inline">Request Blood</span>
          </Link>

          {/* User */}
          <div className="hidden sm:flex items-center gap-space-sm bg-surface-container-low py-1 pl-1 pr-3 rounded-full">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <span className="hidden md:inline font-label-md text-label-md text-on-surface font-semibold max-w-[120px] truncate">
              {user?.name}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="hidden sm:inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-error transition-colors px-1 py-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="hidden lg:inline">Logout</span>
          </button>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="xl:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low cursor-pointer"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="xl:hidden border-t border-surface-container-highest bg-surface-container-lowest px-margin py-space-md flex flex-col gap-space-xs">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `py-space-sm px-space-md rounded-lg font-label-md text-label-md ${
                  isActive ? 'bg-primary-fixed text-on-primary-fixed' : 'text-on-surface'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-space-sm py-space-sm px-space-md rounded-lg text-left font-label-md text-label-md text-error cursor-pointer"
          >
            Logout
          </button>
        </nav>
      )}
    </header>
  )
}