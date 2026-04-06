import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-[#1b4332] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#52b788] flex items-center justify-center text-white font-semibold text-lg">
            M
          </div>
          <div>
            <p className="text-white font-semibold text-xl leading-none">MAGNO</p>
            <p className="text-[11px] text-white/50 uppercase tracking-wide mt-0.5">
              Sistema de Cobros
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
