import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import AuthLayout from './components/layout/AuthLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'
import LoginChooser from './pages/auth/LoginChooser'
import DonorLogin from './pages/auth/DonorLogin'
import HospitalLogin from './pages/auth/HospitalLogin'

export default function App() {
  return (
    <Routes>
      {/* First page: no navbar */}
      <Route path="/" element={<Welcome />} />

      {/* Login pages: no navbar */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginChooser />} />
        <Route path="/login/donor" element={<DonorLogin />} />
        <Route path="/login/hospital" element={<HospitalLogin />} />
      </Route>

      {/* Pages with navbar */}
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />

        {/* After login: landing page for now. Real dashboards come later. */}
        <Route element={<ProtectedRoute role="donor" />}>
          <Route path="/donor/dashboard" element={<Home />} />
        </Route>
        <Route element={<ProtectedRoute role="hospital" />}>
          <Route path="/hospital/dashboard" element={<Home />} />
        </Route>

        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}