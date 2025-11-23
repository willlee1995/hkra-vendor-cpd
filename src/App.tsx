import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { VendorLoginForm } from '@/components/vendor/VendorLoginForm'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Dashboard } from '@/pages/vendor/Dashboard'
import { RequestNew } from '@/pages/vendor/RequestNew'
import { RequestEdit } from '@/pages/vendor/RequestEdit'
import { RequestDetail } from '@/pages/vendor/RequestDetail'
import { Settings } from '@/pages/vendor/Settings'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminRequestDetail } from '@/pages/admin/AdminRequestDetail'
import { AppShell } from '@/components/layout/AppShell'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vendor/login" element={<VendorLoginForm />} />
        <Route
          path="/vendor/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <Dashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/request/new"
          element={
            <ProtectedRoute>
              <AppShell>
                <RequestNew />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/request/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <RequestDetail />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/request/:id/edit"
          element={
            <ProtectedRoute>
              <AppShell>
                <RequestEdit />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/settings"
          element={
            <ProtectedRoute>
              <AppShell>
                <Settings />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <AdminDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/request/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <AdminRequestDetail />
              </AppShell>
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
