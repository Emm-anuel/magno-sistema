import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, CreditCard, Wallet, RefreshCw, Users, History,
  Archive, Receipt, BarChart2, Building2, UserCog, ScrollText, Settings, X,
  CalendarDays, TrendingUp,
} from 'lucide-react'
import type { Rol } from '@/types'
import { useAuthStore } from '@/hooks/useAuthStore'
import { ROL_LABELS } from '@/types'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  roles: Rol[]
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
    ],
  },
  {
    label: 'Operación',
    items: [
      { label: 'Cobros',          to: '/cobros',          icon: Wallet,       roles: ['SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
      { label: 'Créditos Nuevos', to: '/creditos-nuevos', icon: CreditCard,   roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
      { label: 'Renovaciones',    to: '/renovaciones',    icon: RefreshCw,    roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
      { label: 'Colocaciones',    to: '/colocaciones',    icon: CalendarDays, roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { label: 'Clientes',  to: '/clientes',  icon: Users,   roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
      { label: 'Historial', to: '/historial', icon: History, roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { label: 'Caja',     to: '/caja',     icon: Archive,  roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Gastos',      to: '/gastos',      icon: Receipt,     roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Inversiones', to: '/inversiones', icon: TrendingUp,  roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Reportes',    to: '/reportes',    icon: BarChart2,   roles: ['ADMINISTRADOR','SUPERVISOR'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Sucursales',     to: '/sucursales',     icon: Building2, roles: ['ADMINISTRADOR'] },
      { label: 'Usuarios',       to: '/usuarios',       icon: UserCog,   roles: ['ADMINISTRADOR'] },
      { label: 'Administración', to: '/administracion', icon: Settings,  roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function getInitials(name: string): string {
  if (!name?.trim()) return 'U'

  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w?.[0] ?? '')
    .join('')
    .toUpperCase()
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const usuario = useAuthStore((s) => s.usuario)
  const rol = usuario?.rol
  const nombreCompleto = usuario?.nombre_completo ?? (usuario as any)?.nombreCompleto ?? ''
  const sucursalNombre = usuario?.sucursal?.nombre ?? ''

  return (
    <nav
      className={clsx(
        'fixed inset-y-0 left-0 z-40 w-60 bg-[#1b4332] flex flex-col h-full',
        'transition-transform duration-200 ease-in-out lg:transition-none',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:relative lg:translate-x-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-[18px] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#52b788] flex items-center justify-center text-white font-semibold text-[15px] shrink-0">
            M
          </div>
          <div>
            <div className="text-white font-semibold text-base leading-none">MAGNO</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide mt-0.5">
              Sistema de Cobros
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-white/50 hover:text-white p-1 rounded"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter(
            (item) => !rol || item.roles.includes(rol),
          )
          if (visible.length === 0) return null

          return (
            <div key={section.label} className="px-2.5 mb-1">
              <p className="text-[10px] uppercase tracking-[0.8px] text-white/40 px-2 pb-1.5 pt-3">
                {section.label}
              </p>
              {visible.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => { if (window.innerWidth < 1024) onClose() }}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13px] font-normal',
                      'transition-all duration-150 mb-px',
                      isActive
                        ? 'bg-[#52b788]/25 text-[#74c69d]'
                        : 'text-white/75 hover:bg-white/[0.09] hover:text-white opacity-75 hover:opacity-100',
                    )
                  }
                >
                  <Icon className="w-[15px] h-[15px] shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </div>

      {/* User */}
      {usuario && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-t border-white/10 shrink-0">
          <div className="w-[30px] h-[30px] rounded-full bg-[#2d6a4f] flex items-center justify-center text-[12px] font-semibold text-white shrink-0">
            {getInitials(nombreCompleto)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-[12px] font-medium truncate">
              {nombreCompleto.split(' ').filter(Boolean).slice(0, 2).join(' ') || 'Usuario'}
            </p>
            <p className="text-white/50 text-[10px] truncate">
              {ROL_LABELS[usuario.rol]}{sucursalNombre ? ` · ${sucursalNombre}` : ''}
            </p>
          </div>
        </div>
      )}
    </nav>
  )
}
