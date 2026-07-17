import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  pagosVencidos: number
  multasPendientes: number
  /** Solo mostrar indicador para créditos ACTIVO */
  estado: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(n)
}

export default function PagoStatusBadge({ pagosVencidos, multasPendientes, estado }: Props) {
  if (estado !== 'ACTIVO') {
    return <span className="text-gray-300 text-xs">—</span>
  }

  const tieneVencidos = pagosVencidos > 0
  const tieneMultas = multasPendientes > 0

  if (!tieneVencidos && !tieneMultas) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        Al corriente
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {tieneVencidos && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium whitespace-nowrap">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {pagosVencidos} pago{pagosVencidos !== 1 ? 's' : ''} vencido{pagosVencidos !== 1 ? 's' : ''}
        </span>
      )}
      {tieneMultas && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {fmt(multasPendientes)} multas
        </span>
      )}
    </div>
  )
}
