import { useState } from 'react'
import TabListosRenovar from './TabListosRenovar'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import type { ClienteResumen } from '@/types'

type Tab = 'listos' | 'nueva'

export default function RenovacionesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('listos')
  const [clientePreseleccionado, setClientePreseleccionado] = useState<ClienteResumen | null>(null)

  function handleRenovar(cliente: ClienteResumen) {
    setClientePreseleccionado(cliente)
    setActiveTab('nueva')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'listos', label: 'Listos para Renovar' },
    { id: 'nueva', label: 'Nueva Renovación' },
  ]

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Consulta clientes listos para renovar y procesa renovaciones de crédito
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Pestañas">
          {tabs.map((tab) => (
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
      {activeTab === 'nueva' && (
        <TabNuevaRenovacion
          initialCliente={clientePreseleccionado}
          onClearInitial={() => setClientePreseleccionado(null)}
        />
      )}
    </div>
  )
}
