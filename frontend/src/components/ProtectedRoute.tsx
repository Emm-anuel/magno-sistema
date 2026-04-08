import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { Rol } from '@/types'

interface Props {
  allowedRoles?: Rol[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isHydrated, usuario } = useAuthStore()

  if (!isHydrated) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && usuario && !allowedRoles.includes(usuario.rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
