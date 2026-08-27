import { useState } from 'react'
import TabListosRenovar from './TabListosRenovar'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import TabPendientesRenovacion from './TabPendientesRenovacion'
import TabPendientesDesembolso from './TabPendientesDesembolso'
import TabMisSolicitudes from './TabMisSolicitudes'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useCajaOperativa } from '@/hooks/useCajaOperativa'
import CajaOperativaBanner from '@/components/caja/CajaOperativaBanner'
import type { ClienteResumen } from '@/types'

type Tab = 'listos' | 'nueva' | 'pendientes' | 'desembolso' | 'mis-solicitudes'

export default function RenovacionesPage() {
  const { usuario } = useAuthStore()
  const { bannerVariant, horaLimite, bloqueado } = useCajaOperativa()
  const [activeTab, setActiveTab] = useState<Tab>('listos')
  const [clientePreseleccionado, setClientePreseleccionado] = useState<ClienteResumen | null>(null)
  const [creditoPreseleccionadoId, setCreditoPreseleccionadoId] = useState<number | null>(null)

  const isGerente = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const puedeCrear  = usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  function handleRenovar(cliente: ClienteResumen, creditoId: number) {
    setClientePreseleccionado(cliente)
    setCreditoPreseleccionadoId(creditoId)
    setActiveTab('nueva')
  }

  function clearPreseleccion() {
    setClientePreseleccionado(null)
    setCreditoPreseleccionadoId(null)
  }

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'listos',          label: 'Listos para Renovar',      visible: true },
    { id: 'pendientes',      label: 'Pendientes de Aprobación', visible: isGerente },
    { id: 'desembolso',      label: 'Pendientes de Desembolso', visible: isGerente },
    { id: 'nueva',           label: 'Nueva Solicitud',          visible: puedeCrear && !bloqueado },
    { id: 'mis-solicitudes', label: 'Mis Solicitudes',          visible: puedeCrear },
  ]

  return (
    <div className="space-y-4 pb-8">
      <CajaOperativaBanner variant={bannerVariant} horaLimite={horaLimite} />
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isGerente
            ? 'Aprueba solicitudes y confirma los desembolsos de renovación'
            : 'Consulta clientes listos para renovar y envía solicitudes'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Pestañas">
          {tabs.filter((t) => t.visible).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? 'border-b-2 border-[#3d6b35] text-[#3d6b35] pb-3 text-sm font-semibold whitespace-nowrap'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 pb-3 text-sm font-medium whitespace-nowrap'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'listos' && (
        <TabListosRenovar onRenovar={handleRenovar} />
      )}
      {activeTab === 'pendientes' && isGerente && (
        <TabPendientesRenovacion />
      )}
      {activeTab === 'desembolso' && isGerente && (
        <TabPendientesDesembolso />
      )}
      {activeTab === 'nueva' && puedeCrear && (
        <TabNuevaRenovacion
          initialCliente={clientePreseleccionado}
          initialCreditoId={creditoPreseleccionadoId}
          onClearInitial={clearPreseleccion}
        />
      )}
      {activeTab === 'mis-solicitudes' && puedeCrear && (
        <TabMisSolicitudes />
      )}
    </div>
  )
}
