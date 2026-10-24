import { Link, Outlet } from 'react-router-dom'
import DashboardNavbar from './DashboardNavbar'

export default function DashboardLayout({ role }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardNavbar role={role} />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-margin py-space-lg">
        <Outlet />
      </main>

      <footer className="w-full bg-surface-container-low py-space-lg">
        <div className="max-w-[1280px] mx-auto px-margin flex flex-col md:flex-row items-center justify-between gap-space-md text-center md:text-left">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            © 2026 RedSync. All rights reserved.
          </p>
          <div className="flex items-center gap-space-lg text-on-surface-variant font-label-sm text-label-sm">
            <Link to="/privacy" className="hover:text-on-surface transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-on-surface transition-colors">
              Terms of Service
            </Link>
            <Link to="/contact" className="hover:text-on-surface transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}