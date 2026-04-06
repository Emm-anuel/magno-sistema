import { useMutation } from '@tanstack/react-query'
import { LogOut, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { authService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'

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
  '/bitacora':        'Bitácora',
  '/administracion':  'Administración',
}

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { logout } = useAuthStore()
  const location = useLocation()

  const title = PAGE_TITLES[location.pathname] ?? 'MAGNO'
  const subtitle = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })

  const mutation = useMutation({
    mutationFn: authService.logout,
    onSettled: logout,
  })

  return (
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

      {/* Logout */}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center gap-2 text-[13px] text-[#495057] hover:text-[#dc2626] transition-colors py-2 px-1 shrink-0"
        title="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  )
}
