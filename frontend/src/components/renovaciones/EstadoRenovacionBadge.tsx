import type { EstadoRenovacion } from '@/types'

interface Props {
  estado: EstadoRenovacion
  size?: 'sm' | 'md'
}

const CONFIG: Record<EstadoRenovacion, { label: string; cls: string }> = {
  SOLICITADO: { label: 'Solicitada',           cls: 'bg-blue-100 text-blue-800' },
  APROBADO:   { label: 'Pend. desembolso',     cls: 'bg-amber-100 text-amber-800' },
  RECHAZADO:  { label: 'Rechazada',            cls: 'bg-red-100 text-red-800' },
  ACTIVO:     { label: 'Activa',               cls: 'bg-teal-100 text-teal-800' },
}

export default function EstadoRenovacionBadge({ estado, size = 'md' }: Props) {
  const { label, cls } = CONFIG[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-700' }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${cls}`}>
      {label}
    </span>
  )
}
