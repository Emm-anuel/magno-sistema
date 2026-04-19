import { useState } from 'react'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import type { ClienteResumen } from '@/types'

export default function RenovacionesPage() {
  const [clientePreseleccionado, setClientePreseleccionado] = useState<ClienteResumen | null>(null)

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Procesa renovaciones de crédito para clientes elegibles
        </p>
      </div>
      <TabNuevaRenovacion
        initialCliente={clientePreseleccionado}
        onClearInitial={() => setClientePreseleccionado(null)}
      />
    </div>
  )
}
