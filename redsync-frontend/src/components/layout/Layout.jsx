import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="w-full max-w-7xl mx-auto px-margin flex-1">
        <Outlet />
      </main>
      <div className="w-full max-w-7xl mx-auto px-margin">
        <Footer />
      </div>
    </div>
  )
}