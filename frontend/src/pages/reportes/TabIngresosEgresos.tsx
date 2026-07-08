import { useEffect, useState } from 'react'
import MetricCard from '@/components/reportes/MetricCard'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReporteIngresosEgresos } from '@/services/reporteService'

function mesActual() {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  return { desde: `${y}-${m}-01`, hasta: hoy.toISOString().split('T')[0] }
}

function fmt(n: number | null | undefined) {
  if (n == null) return '$0.00'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props { sucursalId: number | null }

export default function TabIngresosEgresos({ sucursalId }: Props) {
  const { desde: d0, hasta: h0 } = mesActual()
  const [desde, setDesde] = useState(d0)
  const [hasta, setHasta] = useState(h0)
  const [data, setData] = useState<ReporteIngresosEgresos | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [lastRange, setLastRange] = useState<{ desde: string; hasta: string } | null>(null)

  useEffect(() => {
    setData(null)
    setGenerated(false)
    setLastRange(null)
  }, [sucursalId])

  async function generar() {
    if (!sucursalId) return
    setLoading(true)
    try {
      const result = await reporteService.getIngresosEgresos(sucursalId, desde, hasta)
      setData(result)
      setGenerated(true)
      setLastRange({ desde, hasta })
    } finally {
      setLoading(false)
    }
  }

  const neto = data?.subtotalNeto ?? 0
  const netoColor = neto >= 0
    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
    : 'bg-red-50 border-red-300 text-red-800'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FiltroFechas
          desde={desde} hasta={hasta}
          onDesdeChange={setDesde} onHastaChange={setHasta}
          onGenerar={generar} loading={loading}
          disabled={!sucursalId}
        />
        {generated && (
          <ExportPdfButton
            onExport={() => reporteService.exportIngresosEgresosPdf(
              sucursalId!,
              lastRange?.desde ?? desde,
              lastRange?.hasta ?? hasta,
            )}
            disabled={!data || loading || !lastRange}
          />
        )}
      </div>

      {generated && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Apertura" value={fmt(data.totalMontoApertura)}
              colorClass="bg-slate-50 border-slate-300 text-slate-800" />
            <MetricCard label="Total Ingresos Carteras" value={fmt(data.totalIngresoCarteras)}
              colorClass="bg-emerald-50 border-emerald-300 text-emerald-800" />
            <MetricCard label="Total Desembolsos" value={fmt(data.totalDesembolsos)}
              colorClass="bg-blue-50 border-blue-300 text-blue-800" />
            <MetricCard label="Total Gastos" value={fmt(data.totalGastos)}
              colorClass="bg-amber-50 border-amber-300 text-amber-800" />
            <MetricCard label="Total Nómina" value={fmt(data.totalNomina)}
              colorClass="bg-red-50 border-red-300 text-red-800" />
            <MetricCard label="Subtotal Neto" value={fmt(neto)} colorClass={netoColor} />
          </div>

          {data.filas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No hay datos para el período seleccionado</p>
              <button onClick={generar} className="mt-2 text-emerald-600 text-sm underline">
                Cambiar filtros
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-right">Apertura</th>
                    <th className="px-4 py-3 text-right">Ing. Carteras</th>
                    <th className="px-4 py-3 text-right">Desembolsos</th>
                    <th className="px-4 py-3 text-right">Gastos</th>
                    <th className="px-4 py-3 text-right">Nómina</th>
                    <th className="px-4 py-3 text-right">Inversiones</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmt(f.montoApertura)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmt(f.ingresoCarteras)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(f.desembolsos)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{fmt(f.gastos)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmt(f.nomina)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(f.inversiones)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(f.subtotalCaja)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                  <tr>
                    <td className="px-4 py-3">TOTALES</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalMontoApertura)}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalIngresoCarteras)}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalDesembolsos)}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalGastos)}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalNomina)}</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className={`px-4 py-3 text-right ${neto < 0 ? 'text-red-700' : ''}`}>
                      {fmt(neto)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
