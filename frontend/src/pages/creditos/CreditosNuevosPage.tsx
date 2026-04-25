import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useCajaOperativa } from '@/hooks/useCajaOperativa'
import CajaOperativaBanner from '@/components/caja/CajaOperativaBanner'
import TabSolicitudes from './TabSolicitudes'
import TabNuevaSolicitud from './TabNuevaSolicitud'
import TabEvaluacion from './TabEvaluacion'
import TabDesembolso from './TabDesembolso'

type Tab = 'solicitudes' | 'nueva' | 'evaluacion' | 'desembolso'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'desembolso', label: 'Desembolso' },
]

// Field roles only see the two operational tabs
const FIELD_TABS: Tab[] = ['solicitudes', 'nueva']

export default function CreditosNuevosPage() {
  const { usuario } = useAuthStore()
  const { bannerVariant, horaLimite } = useCajaOperativa()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<Tab>('solicitudes')
  const [nuevaSolicitudOpen, setNuevaSolicitudOpen] = useState(false)
  const [editingSolicitudId, setEditingSolicitudId] = useState<number | undefined>()
  const [selectedCreditoId, setSelectedCreditoId] = useState<number | undefined>()

  useEffect(() => {
    const state = location.state as { initialTab?: string; initialCreditoId?: number } | null
    if (state?.initialTab === 'evaluacion' || state?.initialTab === 'desembolso') {
      setActiveTab(state.initialTab as Tab)
      if (state.initialCreditoId) setSelectedCreditoId(state.initialCreditoId)
    }
  }, [location.state])

  const isFieldRole =
    usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  const visibleTabs = ALL_TABS.filter(
    (t) => !isFieldRole || FIELD_TABS.includes(t.id),
  )

  useEffect(() => {
    if (!nuevaSolicitudOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNuevaSolicitudOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nuevaSolicitudOpen])

  function handleEvaluar(id: number) {
    setSelectedCreditoId(id)
    setActiveTab('evaluacion')
  }

  function handleDesembolsar(id: number) {
    setSelectedCreditoId(id)
    setActiveTab('desembolso')
  }

  function handleEditarSolicitud(id: number) {
    setEditingSolicitudId(id)
    setNuevaSolicitudOpen(true)
  }

  return (
    <div>
      <CajaOperativaBanner variant={bannerVariant} horaLimite={horaLimite} />
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
        <TabSolicitudes
          onEvaluar={handleEvaluar}
          onDesembolsar={handleDesembolsar}
          onNuevaSolicitud={() => setNuevaSolicitudOpen(true)}
          onEditarSolicitud={handleEditarSolicitud}
        />
      )}
      {activeTab === 'evaluacion' && (
        <TabEvaluacion initialCreditoId={selectedCreditoId} />
      )}
      {activeTab === 'desembolso' && (
        <TabDesembolso initialCreditoId={selectedCreditoId} />
      )}

      {nuevaSolicitudOpen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/60 flex items-start justify-center overflow-y-auto px-3 py-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setNuevaSolicitudOpen(false)
            }
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-4xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] my-auto">
            <div className="modal-header">
              <div>
                <h3 className="font-semibold text-[15px] text-[#212529]">
                  {editingSolicitudId ? 'Editar Solicitud' : 'Nueva Solicitud'}
                </h3>
                <p className="text-xs text-gray-500">
                  {editingSolicitudId
                    ? 'Actualiza los datos de la solicitud en estado Solicitado'
                    : 'Captura los datos del crédito desde este formulario'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNuevaSolicitudOpen(false)
                  setEditingSolicitudId(undefined)
                }}
                className="text-[#adb5bd] hover:text-[#495057] p-1"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 sm:px-5 py-4 max-h-[85vh] overflow-y-auto">
              <TabNuevaSolicitud
                initialCreditoId={editingSolicitudId}
                onSuccess={() => {
                  setNuevaSolicitudOpen(false)
                  setEditingSolicitudId(undefined)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
