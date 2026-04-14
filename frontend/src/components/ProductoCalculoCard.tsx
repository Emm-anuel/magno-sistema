import type { ProductoCalculo } from '@/types'

interface Props {
  calculo: ProductoCalculo | null
  loading: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(n)
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function getCalculoValue(calculo: ProductoCalculo, key: keyof ProductoCalculo, fallbackKey?: string) {
  const direct = calculo[key]
  if (typeof direct === 'number' || typeof direct === 'string') return direct
  const calculoRecord = calculo as unknown as Record<string, unknown>
  if (fallbackKey && fallbackKey in calculoRecord) {
    return calculoRecord[fallbackKey]
  }
  return 0
}

function getTotalAPagar(calculo: ProductoCalculo): number {
  const raw = getCalculoValue(calculo, 'totalAPagar', 'total_a_pagar')
  const total = safeNumber(raw)
  if (total > 0) return total

  // Fallback defensivo por si el backend omite total_a_pagar en alguna respuesta.
  const capital = safeNumber(getCalculoValue(calculo, 'capital'))
  const intereses = safeNumber(getCalculoValue(calculo, 'cargoFinanciero', 'cargo_financiero'))
  return capital + intereses
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className={`text-sm text-gray-600 ${bold ? 'font-semibold text-gray-800' : ''}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold text-[#3d6b35]' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}

export default function ProductoCalculoCard({ calculo, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
      </div>
    )
  }

  if (!calculo) return null

  return (
    <div className="rounded-xl border border-[#3d6b35] bg-green-50 p-4 space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🧮</span>
        <span className="text-sm font-semibold text-[#3d6b35]">Producto detectado</span>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Plazo: <strong>{safeNumber(getCalculoValue(calculo, 'plazo', 'plazo_dias'))} días</strong> &nbsp;|&nbsp; Tasa:{' '}
        <strong>{(safeNumber(getCalculoValue(calculo, 'tasa', 'tasa_interes')) * 100).toFixed(0)}%</strong>
      </div>
      <Row label="Capital:" value={fmt(safeNumber(getCalculoValue(calculo, 'capital')))} />
      <Row label="Intereses:" value={fmt(safeNumber(getCalculoValue(calculo, 'cargoFinanciero', 'cargo_financiero')))} />
      <Row label="Total a pagar:" value={fmt(getTotalAPagar(calculo))} />
      <hr className="border-green-200 my-1" />
      <Row label="Pago diario:" value={fmt(safeNumber(getCalculoValue(calculo, 'pagoPeriodico', 'pago_periodico')))} bold />
      <Row label="Pago adelantado:" value={fmt(safeNumber(getCalculoValue(calculo, 'pagoAdelantado', 'pago_adelantado')))} />
    </div>
  )
}
