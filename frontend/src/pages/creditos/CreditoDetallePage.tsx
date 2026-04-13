import { useParams } from 'react-router-dom'

export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="card p-8 text-center text-gray-500">
      <h2 className="text-lg font-semibold mb-2">Detalle de Crédito #{id}</h2>
      <p>En construcción</p>
    </div>
  )
}
