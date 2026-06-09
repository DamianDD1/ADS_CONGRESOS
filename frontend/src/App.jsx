import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BrandMark } from './components/Icon'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Recuperar from './pages/Recuperar'
import Dashboard from './pages/Dashboard'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash"><span className="splash-logo"><BrandMark size={56} /></span></div>
  return user ? children : <Navigate to="/login" />
}
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash"><span className="splash-logo"><BrandMark size={56} /></span></div>
  return user ? <Navigate to="/dashboard" /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register"  element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/recuperar" element={<PublicRoute><Recuperar /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
