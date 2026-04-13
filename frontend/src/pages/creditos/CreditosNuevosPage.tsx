import { useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import TabSolicitudes from './TabSolicitudes'
import TabNuevaSolicitud from './TabNuevaSolicitud'

type Tab = 'solicitudes' | 'nueva' | 'evaluacion' | 'desembolso'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'nueva', label: 'Nueva Solicitud' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'desembolso', label: 'Desembolso' },
]

// Field roles only see the two operational tabs
const FIELD_TABS: Tab[] = ['solicitudes', 'nueva']

export default function CreditosNuevosPage() {
  const { usuario } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('solicitudes')

  const isFieldRole =
    usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  const visibleTabs = ALL_TABS.filter(
    (t) => !isFieldRole || FIELD_TABS.includes(t.id),
  )

  function handleEvaluar(_id: number) {
    setActiveTab('evaluacion')
  }

  function handleDesembolsar(_id: number) {
    setActiveTab('desembolso')
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">Créditos Nuevos</h1>
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="border-b border-gray-200 mb-6">
        <nav
          className="flex gap-0 overflow-x-auto -mb-px"
          style={{ scrollbarWidth: 'none' }}
          aria-label="Pestañas"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex-shrink-0',
                activeTab === tab.id
                  ? 'border-[#3d6b35] text-[#3d6b35]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'solicitudes' && (
        <TabSolicitudes onEvaluar={handleEvaluar} onDesembolsar={handleDesembolsar} />
      )}
      {activeTab === 'nueva' && (
        <TabNuevaSolicitud onSuccess={() => setActiveTab('solicitudes')} />
      )}
      {activeTab === 'evaluacion' && (
        <div className="card p-8 text-center text-gray-500">
          En construcción — Evaluación
        </div>
      )}
      {activeTab === 'desembolso' && (
        <div className="card p-8 text-center text-gray-500">
          En construcción — Desembolso
        </div>
      )}
    </div>
  )
}
