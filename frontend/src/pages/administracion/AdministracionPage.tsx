import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings, CalendarOff, ClipboardList, Building2 } from 'lucide-react'
import { api } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import TabConfigSucursal from '@/pages/administracion/TabConfigSucursal'
import TabDiasInhabiles from '@/pages/administracion/TabDiasInhabiles'
import TabBitacora from '@/pages/administracion/TabBitacora'

interface Sucursal {
  id: number
  nombre: string
}

const TABS = [
  { id: 'config',    label: 'Configuración',   icon: Settings },
  { id: 'inhabiles', label: 'Días Inhábiles',   icon: CalendarOff },
  { id: 'bitacora',  label: 'Bitácora',         icon: ClipboardList },
] as const

type TabId = typeof TABS[number]['id']

export default function AdministracionPage() {
  const { usuario } = useAuthStore()
  const esSupervisor = usuario?.rol === 'SUPERVISOR'

  const [tab, setTab] = useState<TabId>('config')
  const [sucursalId, setSucursalId] = useState<number | null>(null)

  const { data: sucursales = [], isLoading: loadingSucursales } = useQuery<Sucursal[]>({
    queryKey: ['sucursales-list'],
    queryFn: () => api.get<Sucursal[]>('/sucursales').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    // SUPERVISOR no necesita la lista completa, pero la cargamos igual para mostrar el nombre
  })

  // SUPERVISOR: siempre su propia sucursal. ADMINISTRADOR: selector libre.
  const sucursalSeleccionada: number | null = esSupervisor
    ? (usuario?.sucursal?.id ?? null)
    : (sucursalId ?? sucursales[0]?.id ?? null)

  const nombreSucursalSupervisor = usuario?.sucursal?.nombre ?? ''

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-5">
        <h1 className="text-[18px] font-semibold text-[#212529]">Administración</h1>
        <p className="text-[13px] text-[#adb5bd] mt-0.5">
          Configuración del sistema por sucursal
        </p>
      </div>

      {/* Selector / indicador de sucursal */}
      <div className="card mb-5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#d1fae5] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-[#2d6a4f]" />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide block mb-1">
              Sucursal activa
            </label>
            {esSupervisor ? (
              <p className="text-[14px] font-medium text-[#212529]">{nombreSucursalSupervisor}</p>
            ) : loadingSucursales ? (
              <p className="text-[13px] text-[#adb5bd]">Cargando sucursales...</p>
            ) : (
              <select
                className="input max-w-xs font-medium text-[14px]"
                value={sucursalSeleccionada ?? ''}
                onChange={e => setSucursalId(Number(e.target.value))}
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {sucursalSeleccionada === null ? null : (
        <>
          {/* Tabs */}
          <div className="tabs mb-5">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  className={`tab flex items-center gap-1.5 ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>

          {/* Contenido */}
          {tab === 'config' && (
            <TabConfigSucursal sucursalId={sucursalSeleccionada} />
          )}

          {tab === 'inhabiles' && (
            <TabDiasInhabiles />
          )}

          {tab === 'bitacora' && (
            <TabBitacora />
          )}
        </>
      )}
    </div>
  )
}
