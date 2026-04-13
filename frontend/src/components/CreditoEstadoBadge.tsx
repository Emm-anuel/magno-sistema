import type { EstadoCredito } from '@/types'

interface Props {
  estado: EstadoCredito
  size?: 'sm' | 'md'
}

const CONFIG: Record<EstadoCredito, { label: string; cls: string }> = {
  SOLICITADO: {
    label: 'Solicitado',
    cls: 'bg-blue-100 text-blue-800',
  },
  APROBADO: {
    label: 'Aprobado',
    cls: 'bg-yellow-100 text-yellow-800',
  },
  ACTIVO: {
    label: 'Activo',
    cls: 'bg-green-100 text-green-800',
  },
  PAGADO: {
    label: 'Pagado',
    cls: 'bg-gray-100 text-gray-700',
  },
  RENOVADO: {
    label: 'Renovado',
    cls: 'bg-purple-100 text-purple-800',
  },
  CANCELADO: {
    label: 'Cancelado',
    cls: 'bg-red-100 text-red-800',
  },
}

export default function CreditoEstadoBadge({ estado, size = 'md' }: Props) {
  const { label, cls } = CONFIG[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-700' }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${cls}`}>
      {label}
    </span>
  )
}
