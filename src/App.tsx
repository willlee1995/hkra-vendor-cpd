import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { VendorLoginForm } from '@/components/vendor/VendorLoginForm'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Dashboard } from '@/pages/vendor/Dashboard'
import { RequestNew } from '@/pages/vendor/RequestNew'
import { RequestEdit } from '@/pages/vendor/RequestEdit'
import { RequestDetail } from '@/pages/vendor/RequestDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vendor/login" element={<VendorLoginForm />} />
        <Route
          path="/vendor/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/request/new"
          element={
            <ProtectedRoute>
              <RequestNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/request/:id"
          element={
            <ProtectedRoute>
              <RequestDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/request/:id/edit"
          element={
            <ProtectedRoute>
              <RequestEdit />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/vendor/login" replace />} />
        <Route path="*" element={<Navigate to="/vendor/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
