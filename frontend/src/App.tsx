import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthLayout from '@/pages/auth/AuthLayout'
import LoginPage from '@/pages/auth/LoginPage'
import AppLayout from '@/pages/AppLayout'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import UsuariosPage from '@/pages/usuarios/UsuariosPage'
import UsuarioDetallePage from '@/pages/usuarios/UsuarioDetallePage'
import SucursalesPage from '@/pages/sucursales/SucursalesPage'
import ClientesPage from '@/pages/clientes/ClientesPage'
import ClienteDetallePage from '@/pages/clientes/ClienteDetallePage'
import CreditosNuevosPage from '@/pages/creditos/CreditosNuevosPage'
import CreditoDetallePage from '@/pages/creditos/CreditoDetallePage'
import CobrosPage from '@/pages/cobros/CobrosPage'
import HistorialPage from '@/pages/Historial'
import RenovacionesPage from '@/pages/renovaciones/RenovacionesPage'
import ModulePlaceholderPage from '@/pages/ModulePlaceholderPage'
import ColocacionesPage from '@/pages/colocaciones/ColocacionesPage'
import AdministracionPage from '@/pages/administracion/AdministracionPage'
import CajaPage from '@/pages/caja/CajaPage'
import CajaCierrePage from '@/pages/caja/CajaCierrePage'
import GastosPage from '@/pages/gastos/GastosPage'
import InversionesPage from '@/pages/inversiones/InversionesPage'
import ReportesPage from '@/pages/reportes/ReportesPage'
import {
  ALL_ROLES,
  ADMIN_SUPERVISOR_ROLES,
  ADMIN_ONLY_ROLES,
  COBROS_ROLES,
  CLIENTES_ROLES,
} from '@/utils/roles'

export default function App() {
  const { isAuthenticated, isHydrated } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Rutas protegidas — todos los roles autenticados */}
        <Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Solo Supervisor y Asesor */}
            <Route element={<ProtectedRoute allowedRoles={COBROS_ROLES} />}>
              <Route path="/cobros" element={<CobrosPage />} />
            </Route>

            {/* Todos los roles operativos — Créditos, Renovaciones, Historial */}
            <Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>
              <Route path="/creditos-nuevos" element={<CreditosNuevosPage />} />
              <Route path="/creditos/:id" element={<CreditoDetallePage />} />
              <Route path="/renovaciones" element={<RenovacionesPage />} />
              <Route path="/colocaciones" element={<ColocacionesPage />} />
              <Route path="/historial" element={<HistorialPage />} />
            </Route>

            {/* Todos los roles — Clientes */}
            <Route element={<ProtectedRoute allowedRoles={CLIENTES_ROLES} />}>
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/clientes/:id" element={<ClienteDetallePage />} />
            </Route>

            {/* Solo Administrador y Supervisor */}
            <Route element={<ProtectedRoute allowedRoles={ADMIN_SUPERVISOR_ROLES} />}>
              <Route path="/caja" element={<CajaPage />} />
              <Route path="/caja/cierre" element={<CajaCierrePage />} />
              <Route path="/gastos" element={<GastosPage />} />
              <Route path="/inversiones" element={<InversionesPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
            </Route>

            {/* Solo Administrador */}
            <Route element={<ProtectedRoute allowedRoles={ADMIN_ONLY_ROLES} />}>
              <Route path="/sucursales" element={<SucursalesPage />} />
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/usuarios/:id" element={<UsuarioDetallePage />} />
            </Route>

            {/* Administrador y Gerente de Sucursal */}
            <Route element={<ProtectedRoute allowedRoles={ADMIN_SUPERVISOR_ROLES} />}>
              <Route path="/administracion" element={<AdministracionPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={
            !isHydrated ? null : (
              <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
