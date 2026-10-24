import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import AuthLayout from './components/layout/AuthLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'
import LoginChooser from './pages/auth/LoginChooser'
import DonorLogin from './pages/auth/DonorLogin'
import HospitalLogin from './pages/auth/HospitalLogin'
import DonorRegister from './pages/auth/DonorRegister'
import HospitalRegister from './pages/auth/HospitalRegister'
import DonorDashboard from './pages/donor/DonorDashboard'

export default function App() {
  return (
    <Routes>
      {/* First page: no navbar */}
      <Route path="/" element={<Welcome />} />

      {/* Login and registration pages: no navbar */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginChooser />} />
        <Route path="/login/donor" element={<DonorLogin />} />
        <Route path="/login/hospital" element={<HospitalLogin />} />
        <Route path="/register/donor" element={<DonorRegister />} />
        <Route path="/register/hospital" element={<HospitalRegister />} />
      </Route>

      {/* Donor pages: donor dashboard navbar */}
      <Route element={<ProtectedRoute role="donor" />}>
        <Route element={<DashboardLayout role="donor" />}>
          <Route path="/donor/dashboard" element={<DonorDashboard />} />
          <Route path="/donor/*" element={<ComingSoon />} />
        </Route>
      </Route>

      {/* Public pages and hospital pages (hospital dashboard comes next) */}
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />
        <Route element={<ProtectedRoute role="hospital" />}>
          <Route path="/hospital/dashboard" element={<Home />} />
        </Route>
        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}