import type { EstadoCobro } from '@/types'

const CONFIG: Record<EstadoCobro, { label: string; cls: string }> = {
  PAGADO:        { label: 'Pagó',          cls: 'badge-verde' },
  PARCIAL:       { label: 'Abono',         cls: 'badge-amarillo' },
  NO_PAGADO:     { label: 'No pagó',       cls: 'badge-rojo' },
  INHABIL:       { label: 'Inhábil',       cls: 'badge-gris' },
  INHABILL:      { label: 'Inhábil',       cls: 'badge-gris' },
  SIN_REGISTRO:  { label: 'Sin registrar', cls: 'badge-azul' },
  VENCIDO:       { label: 'Vencido',       cls: 'badge-rojo' },
}

interface Props {
  estado: EstadoCobro
  size?: 'sm' | 'md'
}

export default function EstadoCobroBadge({ estado, size = 'md' }: Props) {
  const cfg = CONFIG[estado] ?? { label: estado, cls: 'badge-gris' }
  return (
    <span className={`badge ${cfg.cls} ${size === 'sm' ? 'text-[10px]' : ''}`}>
      {cfg.label}
    </span>
  )
}
