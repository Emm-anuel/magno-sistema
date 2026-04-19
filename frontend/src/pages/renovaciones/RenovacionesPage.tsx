import { useState } from 'react'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import TabColocacionesSemanales from '../colocaciones/TabColocacionesSemanales'
import { useAuthStore } from '@/hooks/useAuthStore'

type Tab = 'colocaciones' | 'nueva'

export default function RenovacionesPage() {
  const { usuario } = useAuthStore()
  const isAdminOrSup = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  // Admins y supervisores ven colocaciones primero; asesores van directo al formulario
  const [activeTab, setActiveTab] = useState<Tab>(isAdminOrSup ? 'colocaciones' : 'nueva')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'colocaciones', label: 'Colocaciones Semanales' },
    { id: 'nueva', label: 'Nueva Renovación' },
  ]

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestión de renovaciones de crédito y colocaciones semanales
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
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
      <div>
        {activeTab === 'colocaciones' && <TabColocacionesSemanales />}
        {activeTab === 'nueva' && <TabNuevaRenovacion />}
      </div>
    </div>
  )
}
