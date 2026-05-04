import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import AlertLog from './pages/AlertLog'
import SensorStatusPage from './pages/SensorStatusPage'
import BlockchainPage from './pages/BlockchainPage'
import AnalyticsPage from './pages/AnalyticsPage'
import FireDeptDashboard from './pages/FireDeptDashboard'
import { AdminProvider } from './context/AdminContext'
import { Outlet } from 'react-router-dom'

// Persistent wrapper for Admin state
const AdminProviderWrapper = () => (
  <AdminProvider>
    <Outlet />
  </AdminProvider>
)

// Auth guard — checks token; optionally checks role if provided
const PrivateRoute = ({ children, role }) => {
  const token = localStorage.getItem('pyrochain_token')
  const user  = JSON.parse(localStorage.getItem('pyrochain_user') || '{}')
  if (!token) return <Navigate to="/login" replace />
  // Admins can see everything; others must match role exactly
  if (role && user.role !== 'admin' && user.role !== role) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/admin" element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/alerts" element={<PrivateRoute role="admin"><AlertLog /></PrivateRoute>} />
          <Route path="/admin/sensors" element={<PrivateRoute role="admin"><SensorStatusPage /></PrivateRoute>} />
          <Route path="/admin/blockchain" element={<PrivateRoute role="admin"><BlockchainPage /></PrivateRoute>} />
          <Route path="/admin/analytics" element={<PrivateRoute role="admin"><AnalyticsPage /></PrivateRoute>} />

          <Route path="/firedept" element={
            <PrivateRoute role="firedept">
              <FireDeptDashboard />
            </PrivateRoute>
          } />
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AdminProvider>
    </BrowserRouter>
  )
}
