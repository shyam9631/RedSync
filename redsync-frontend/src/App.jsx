import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import AuthLayout from './components/layout/AuthLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'
import LoginChooser from './pages/auth/LoginChooser'
import DonorLogin from './pages/auth/DonorLogin'
import HospitalLogin from './pages/auth/HospitalLogin'
import DonorDashboard from './pages/donor/DonorDashboard'
import HospitalDashboard from './pages/hospital/HospitalDashboard'

export default function App() {
  return (
    <Routes>
      {/* Login pages: no navbar */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginChooser />} />
        <Route path="/login/donor" element={<DonorLogin />} />
        <Route path="/login/hospital" element={<HospitalLogin />} />
      </Route>

      {/* Pages with navbar */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        <Route element={<ProtectedRoute role="donor" />}>
          <Route path="/donor/dashboard" element={<DonorDashboard />} />
        </Route>

        <Route element={<ProtectedRoute role="hospital" />}>
          <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        </Route>

        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}