import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthLayout from '@/pages/auth/AuthLayout'
import LoginPage from '@/pages/auth/LoginPage'
import AppLayout from '@/pages/AppLayout'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import ModulePlaceholderPage from '@/pages/ModulePlaceholderPage'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Rutas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Módulos — se reemplazarán por sus páginas reales al implementarse */}
            <Route path="/cobros" element={<ModulePlaceholderPage />} />
            <Route path="/creditos-nuevos" element={<ModulePlaceholderPage />} />
            <Route path="/renovaciones" element={<ModulePlaceholderPage />} />
            <Route path="/clientes" element={<ModulePlaceholderPage />} />
            <Route path="/clientes/:id" element={<ModulePlaceholderPage />} />
            <Route path="/historial" element={<ModulePlaceholderPage />} />
            <Route path="/caja" element={<ModulePlaceholderPage />} />
            <Route path="/gastos" element={<ModulePlaceholderPage />} />
            <Route path="/reportes" element={<ModulePlaceholderPage />} />
            <Route path="/sucursales" element={<ModulePlaceholderPage />} />
            <Route path="/usuarios" element={<ModulePlaceholderPage />} />
            <Route path="/bitacora" element={<ModulePlaceholderPage />} />
            <Route path="/administracion" element={<ModulePlaceholderPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
