import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import MetricCard from '@/components/reportes/MetricCard'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReporteCartera } from '@/services/reporteService'

function fmt(n: number | null | undefined) {
  if (n == null) return '$0.00'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ESTADOS = ['TODOS', 'AL_CORRIENTE', 'EN_MORA'] as const
type Estado = typeof ESTADOS[number]

const ESTADO_LABELS: Record<Estado, string> = {
  TODOS: 'Todos',
  AL_CORRIENTE: 'Al corriente',
  EN_MORA: 'En mora',
}

const PAGE_SIZE = 50

interface Props { sucursalId: number | null }

export default function TabCartera({ sucursalId }: Props) {
  const [estado, setEstado] = useState<Estado>('TODOS')
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [data, setData] = useState<ReporteCartera | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [lastFilters, setLastFilters] = useState<{ estado: Estado; asesorId?: number } | null>(null)

  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-reportes'],
    queryFn: () => api.get<{ id: number; nombre_completo: string }[]>('/clientes/asesores')
      .then(r => r.data),
    staleTime: 300_000,
  })

  useEffect(() => {
    setData(null)
    setPage(0)
    setLastFilters(null)
  }, [sucursalId])

  async function generar(nuevoEstado?: Estado, nuevoAsesorId?: number) {
    if (!sucursalId) return
    const est = nuevoEstado ?? estado
    const asesor = nuevoAsesorId ?? asesorId
    setLoading(true)
    try {
      const result = await reporteService.getCartera(sucursalId, asesor, est)
      setData(result)
      setPage(0)
      setLastFilters({ estado: est, asesorId: asesor })
    } finally {
      setLoading(false)
    }
  }

  function handleEstado(est: Estado) {
    setEstado(est)
    generar(est)
  }

  function handleAsesor(id?: number) {
    setAsesorId(id)
    generar(undefined, id)
  }

  const paginated = useMemo(() => {
    if (!data) return []
    const start = page * PAGE_SIZE
    return data.creditos.slice(start, start + PAGE_SIZE)
  }, [data, page])

  const totalPages = data ? Math.ceil(data.creditos.length / PAGE_SIZE) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {ESTADOS.map(est => (
              <button
                key={est}
                onClick={() => handleEstado(est)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  estado === est
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {ESTADO_LABELS[est]}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Asesor</label>
            <select
              value={asesorId ?? ''}
              onChange={(e) => handleAsesor(e.target.value ? Number(e.target.value) : undefined)}
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
          <button
            onClick={() => generar()}
            disabled={loading || !sucursalId}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Generar reporte'}
          </button>
        </div>
        {data && (
          <ExportPdfButton
            onExport={() => reporteService.exportCarteraPdf(
              sucursalId!,
              lastFilters?.asesorId ?? asesorId,
              lastFilters?.estado ?? estado,
            )}
            disabled={loading || !lastFilters}
          />
        )}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Créditos Activos" value={String(data.totalCreditosActivos)}
              colorClass="bg-emerald-50 border-emerald-300 text-emerald-800" />
            <MetricCard label="Monto Total Colocado" value={fmt(data.montoTotalColocado)}
              colorClass="bg-blue-50 border-blue-300 text-blue-800" />
            <MetricCard label="Créditos en Mora" value={String(data.creditosEnMora)}
              colorClass="bg-red-50 border-red-300 text-red-800" />
            <MetricCard label="Monto en Riesgo" value={fmt(data.montoEnRiesgo)}
              colorClass="bg-amber-50 border-amber-300 text-amber-800" />
          </div>

          {data.creditos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No hay créditos con ese filtro</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Asesor</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-center">Pagos</th>
                    <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                    <th className="px-4 py-3 text-right">Multas Pend.</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(c => (
                    <tr key={c.creditoId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.clienteNombre}</td>
                      <td className="px-4 py-3 text-gray-600">{c.asesorNombre}</td>
                      <td className="px-4 py-3 text-right">{fmt(c.montoCapital)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{c.pagosRealizados}/{c.pagosTotal}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(c.saldoPendiente)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{fmt(c.multasPendientes)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.enMora
                          ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">En mora</span>
                          : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Al corriente</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">TOTALES ({data.creditos.length} créditos)</td>
                    <td className="px-4 py-3 text-right">{fmt(data.montoTotalColocado)}</td>
                    <td />
                    <td className="px-4 py-3 text-right">
                      {fmt(data.creditos.reduce((s, c) => s + c.saldoPendiente, 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmt(data.creditos.reduce((s, c) => s + c.multasPendientes, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
