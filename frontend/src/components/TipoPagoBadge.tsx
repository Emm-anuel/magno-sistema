import type { TipoPago } from '@/types'

interface Props {
  tipo: TipoPago
  size?: 'sm' | 'md'
}

const CONFIG: Record<TipoPago, { label: string; cls: string }> = {
  DIARIO:   { label: 'Diario',   cls: 'bg-gray-100 text-gray-700' },
  SEMANAL:  { label: 'Semanal',  cls: 'bg-blue-100 text-blue-700' },
}

export default function TipoPagoBadge({ tipo, size = 'md' }: Props) {
  const { label, cls } = CONFIG[tipo] ?? { label: tipo, cls: 'bg-gray-100 text-gray-700' }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${cls}`}>
      {label}
    </span>
  )
}
