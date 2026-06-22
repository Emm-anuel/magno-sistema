import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { Rol } from '@/types'

interface Props {
  allowedRoles?: Rol[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isHydrated, usuario } = useAuthStore()

  if (!isHydrated) {
    console.warn(`DEBUG-AUTH [${new Date().toISOString()}] ProtectedRoute: !isHydrated, return null`)
    return null
  }

  if (!isAuthenticated) {
    console.warn(`DEBUG-AUTH [${new Date().toISOString()}] ProtectedRoute: !isAuthenticated -> Navigate /login`)
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && usuario && !allowedRoles.includes(usuario.rol)) {
    console.warn(`DEBUG-AUTH [${new Date().toISOString()}] ProtectedRoute: rol ${usuario.rol} no permitido -> Navigate /dashboard`)
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
