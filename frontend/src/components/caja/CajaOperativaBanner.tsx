import { AlertTriangle, Clock } from 'lucide-react'
import type { BannerVariant } from '@/hooks/useCajaOperativa'

interface Props {
  variant: BannerVariant
  horaLimite: string
}

export default function CajaOperativaBanner({ variant, horaLimite }: Props) {
  if (variant === 'none') return null

  if (variant === 'danger') {
    return (
      <div className="alert alert-danger flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>La caja está cerrada — no es posible registrar operaciones hoy.</span>
      </div>
    )
  }

  return (
    <div className="alert alert-warn flex items-center gap-2">
      <Clock className="w-4 h-4 shrink-0" />
      <span>
        La caja cerrará pronto ({horaLimite}) — concluye tus operaciones antes del cierre.
      </span>
    </div>
  )
}
