import type { TipoCredito } from '@/types'

interface Props {
  tipo: TipoCredito
  size?: 'sm' | 'md'
}

const CONFIG: Record<TipoCredito, { label: string; cls: string }> = {
  NUEVO:      { label: 'Nuevo',      cls: 'bg-emerald-100 text-emerald-800' },
  RENOVACION: { label: 'Renovación', cls: 'bg-blue-100 text-blue-800' },
}

export default function TipoCreditoBadge({ tipo, size = 'md' }: Props) {
  const { label, cls } = CONFIG[tipo] ?? { label: tipo, cls: 'bg-gray-100 text-gray-700' }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${cls}`}>
      {label}
    </span>
  )
}
