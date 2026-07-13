import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu, KeyRound } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { authService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import CambiarPasswordModal from '@/components/CambiarPasswordModal'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/cobros':          'Cobros',
  '/creditos-nuevos': 'Créditos Nuevos',
  '/renovaciones':    'Renovaciones',
  '/clientes':        'Clientes',
  '/historial':       'Historial de Pago',
  '/caja':            'Corte de Caja',
  '/gastos':          'Gastos',
  '/reportes':        'Reportes',
  '/sucursales':      'Sucursales',
  '/usuarios':        'Usuarios',
  '/administracion':  'Administración',
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { logout, usuario } = useAuthStore()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [showCambiarPassword, setShowCambiarPassword] = useState(false)

  const title = PAGE_TITLES[location.pathname] ?? 'MAGNO'
  const subtitle = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })

  const mutation = useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      queryClient.clear()
      logout()
    },
  })

  return (
    <>
      <header className="h-14 bg-white border-b border-[#dee2e6] flex items-center px-4 lg:px-6 gap-3 shrink-0">
        {/* Hamburger — solo móvil */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg text-[#495057] hover:bg-[#f8f9fa] transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Título + fecha */}
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-[#212529] leading-none capitalize-first">
            {title}
          </p>
          <p className="text-[12px] text-[#adb5bd] mt-0.5 hidden sm:block capitalize">
            {subtitle}
          </p>
        </div>

        {/* Usuario + acciones */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Botón cambiar contraseña */}
          <button
            onClick={() => setShowCambiarPassword(true)}
            className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg hover:bg-[#f8f9fa] transition-colors"
            title="Cambiar contraseña"
          >
            <div className="w-7 h-7 rounded-full bg-[#2196F3] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
              {usuario ? initials(usuario.nombre_completo) : '?'}
            </div>
            <span className="hidden md:block text-[13px] text-[#495057] max-w-[140px] truncate">
              {usuario?.nombre_completo ?? ''}
            </span>
            <KeyRound className="w-3.5 h-3.5 text-[#adb5bd]" />
          </button>

          {/* Logout */}
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 text-[13px] text-[#495057] hover:text-[#dc2626] transition-colors py-2 px-1"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {showCambiarPassword && (
        <CambiarPasswordModal onClose={() => setShowCambiarPassword(false)} />
      )}
    </>
  )
}
