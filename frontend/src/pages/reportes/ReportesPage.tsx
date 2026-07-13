import { useEffect, useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import SucursalSelector from '@/components/reportes/SucursalSelector'
import TabIngresosEgresos from '@/pages/reportes/TabIngresosEgresos'
import TabColocaciones from '@/pages/reportes/TabColocaciones'
import TabCartera from '@/pages/reportes/TabCartera'
import TabPorAsesor from '@/pages/reportes/TabPorAsesor'
import TabClientes from '@/pages/reportes/TabClientes'

type Tab = 'ingresos-egresos' | 'colocaciones' | 'cartera' | 'por-asesor' | 'clientes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ingresos-egresos', label: 'Ingresos/Egresos' },
  { id: 'colocaciones', label: 'Colocaciones' },
  { id: 'cartera', label: 'Cartera' },
  { id: 'por-asesor', label: 'Por Asesor' },
  { id: 'clientes', label: 'Clientes' },
]

export default function ReportesPage() {
  const { usuario } = useAuthStore()
  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const [activeTab, setActiveTab] = useState<Tab>('ingresos-egresos')
  const [sucursalId, setSucursalId] = useState<number | null>(
    isAdmin ? null : (usuario?.sucursal?.id ?? null),
  )

  useEffect(() => {
    if (!isAdmin) {
      setSucursalId(usuario?.sucursal?.id ?? null)
    }
  }, [isAdmin, usuario?.sucursal?.id])

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <SucursalSelector
          sucursalId={sucursalId}
          onChange={setSucursalId}
          readonly={!isAdmin}
          readonlyNombre={usuario?.sucursal?.nombre}
        />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        <div className={activeTab === 'ingresos-egresos' ? 'block' : 'hidden'}>
          <TabIngresosEgresos sucursalId={sucursalId} />
        </div>
        <div className={activeTab === 'colocaciones' ? 'block' : 'hidden'}>
          <TabColocaciones sucursalId={sucursalId} />
        </div>
        <div className={activeTab === 'cartera' ? 'block' : 'hidden'}>
          <TabCartera sucursalId={sucursalId} />
        </div>
        <div className={activeTab === 'por-asesor' ? 'block' : 'hidden'}>
          <TabPorAsesor sucursalId={sucursalId} />
        </div>
        <div className={activeTab === 'clientes' ? 'block' : 'hidden'}>
          <TabClientes sucursalId={sucursalId} />
        </div>
      </div>
    </div>
  )
}
