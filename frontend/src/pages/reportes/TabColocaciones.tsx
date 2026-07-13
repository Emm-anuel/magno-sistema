import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import ExportExcelButton from '@/components/reportes/ExportExcelButton'
import { reporteService, type ReporteColocaciones } from '@/services/reporteService'

function lunesDeHoy() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

function TipoBadge({ tipo }: { tipo: string }) {
  return tipo === 'RENOVACION'
    ? <span className={`${BASE} bg-blue-100 text-blue-700`}>Renovación</span>
    : <span className={`${BASE} bg-emerald-100 text-emerald-800`}>Crédito Nuevo</span>
}

function PagoBadge({ tipoPago }: { tipoPago: string }) {
  return tipoPago === 'SEMANAL'
    ? <span className={`${BASE} bg-blue-100 text-blue-700`}>Semanal</span>
    : <span className={`${BASE} bg-gray-100 text-gray-700`}>Diario</span>
}

interface Props { sucursalId: number | null }

export default function TabColocaciones({ sucursalId }: Props) {
  const [desde, setDesde] = useState(lunesDeHoy)
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0])
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [data, setData] = useState<ReporteColocaciones | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [lastFilters, setLastFilters] = useState<{ desde: string; hasta: string; asesorId?: number } | null>(null)

  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-reportes', sucursalId],
    queryFn: () => api.get<{ id: number; nombre_completo: string }[]>(
      '/clientes/asesores',
      { params: sucursalId ? { sucursalId } : undefined },
    ).then(r => r.data),
    staleTime: 300_000,
  })

  useEffect(() => {
    setData(null)
    setGenerated(false)
    setLastFilters(null)
  }, [sucursalId])

  async function generar() {
    if (!sucursalId) return
    setLoading(true)
    try {
      const result = await reporteService.getColocaciones(sucursalId, desde, hasta, asesorId)
      setData(result)
      setGenerated(true)
      setLastFilters({ desde, hasta, asesorId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <FiltroFechas
            desde={desde} hasta={hasta}
            onDesdeChange={setDesde} onHastaChange={setHasta}
            onGenerar={generar} loading={loading}
            disabled={!sucursalId}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Asesor</label>
            <select
              value={asesorId ?? ''}
              onChange={(e) => setAsesorId(e.target.value ? Number(e.target.value) : undefined)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los asesores</option>
              {asesores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre_completo}
                </option>
              ))}
            </select>
          </div>
        </div>
        {generated && (
          <div className="flex gap-2">
            <ExportPdfButton
              onExport={() => reporteService.exportColocacionesPdf(
                sucursalId!,
                lastFilters?.desde ?? desde,
                lastFilters?.hasta ?? hasta,
                lastFilters?.asesorId ?? asesorId,
              )}
              disabled={!data || loading || !lastFilters}
            />
            <ExportExcelButton
              onExport={() => reporteService.exportColocacionesExcel(
                sucursalId!,
                lastFilters?.desde ?? desde,
                lastFilters?.hasta ?? hasta,
                lastFilters?.asesorId ?? asesorId,
              )}
              disabled={!data || loading || !lastFilters}
            />
          </div>
        )}
      </div>

      {generated && data && (
        data.items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay colocaciones en ese período</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-right">Cto. Anterior</th>
                  <th className="px-4 py-3 text-right">Cto. Nuevo</th>
                  <th className="px-4 py-3 text-right">Desembolso</th>
                  <th className="px-4 py-3 text-left">Pago</th>
                  <th className="px-4 py-3 text-left">Asesor</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 font-medium">{item.clienteNombre}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(item.creditoAnterior)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(item.creditoNuevo)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{fmt(item.desembolso)}</td>
                    <td className="px-4 py-3"><PagoBadge tipoPago={item.tipoPago} /></td>
                    <td className="px-4 py-3 text-gray-600">{item.asesorNombre}</td>
                    <td className="px-4 py-3"><TipoBadge tipo={item.tipo} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-3">Total Desembolsos</td>
                  <td className="px-4 py-3 text-right">{fmt(data.totalDesembolsos)}</td>
                  <td colSpan={3} />
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-3">Total Caja (Renovaciones)</td>
                  <td className="px-4 py-3 text-right">{fmt(data.totalCaja)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  )
}
