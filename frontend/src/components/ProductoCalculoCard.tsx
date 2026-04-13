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
        Plazo: <strong>{calculo.plazo} días</strong> &nbsp;|&nbsp; Tasa:{' '}
        <strong>{(calculo.tasa * 100).toFixed(0)}%</strong>
      </div>
      <Row label="Capital:" value={fmt(calculo.capital)} />
      <Row label="Intereses:" value={fmt(calculo.cargoFinanciero)} />
      <Row label="Total a pagar:" value={fmt(calculo.totalAPagar)} />
      <hr className="border-green-200 my-1" />
      <Row label="Pago diario:" value={fmt(calculo.pagoPeriodico)} bold />
      <Row label="Pago adelantado:" value={fmt(calculo.pagoAdelantado)} />
    </div>
  )
}
