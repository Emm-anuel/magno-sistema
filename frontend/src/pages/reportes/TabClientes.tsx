import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import MetricCard from '@/components/reportes/MetricCard'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import ExportExcelButton from '@/components/reportes/ExportExcelButton'
import { reporteService, type ReporteClientes } from '@/services/reporteService'

const ESTADOS = ['TODOS', 'ACTIVO', 'EN_MORA', 'SIN_CREDITO', 'INACTIVO'] as const
type EstadoFiltro = typeof ESTADOS[number]

const ESTADO_LABELS: Record<EstadoFiltro, string> = {
  TODOS: 'Todos',
  ACTIVO: 'Activo',
  EN_MORA: 'En mora',
  SIN_CREDITO: 'Sin crédito',
  INACTIVO: 'Inactivo',
}

const PAGE_SIZE = 50

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case 'ACTIVO':
      return <span className={`${BASE} bg-emerald-100 text-emerald-800`}>Activo</span>
    case 'EN_MORA':
      return <span className={`${BASE} bg-red-100 text-red-800`}>En mora</span>
    case 'SIN_CREDITO':
      return <span className={`${BASE} bg-gray-100 text-gray-700`}>Sin crédito</span>
    case 'INACTIVO':
      return <span className={`${BASE} bg-zinc-200 text-zinc-600`}>Inactivo</span>
    default:
      return <span className={`${BASE} bg-gray-100 text-gray-600`}>{estado}</span>
  }
}

function fmtFecha(s: string) {
  if (!s || s === '—') return '—'

  const fechaMx = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const fecha = fechaMx
    ? new Date(Number(fechaMx[3]), Number(fechaMx[2]) - 1, Number(fechaMx[1]), 12)
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s)

  if (Number.isNaN(fecha.getTime())) return '—'

  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface Props { sucursalId: number | null }

export default function TabClientes({ sucursalId }: Props) {
  const [estado, setEstado] = useState<EstadoFiltro>('TODOS')
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [data, setData] = useState<ReporteClientes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [lastFilters, setLastFilters] = useState<{ estado: EstadoFiltro; asesorId?: number } | null>(null)

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
    setPage(0)
    setLastFilters(null)
  }, [sucursalId])

  async function generar(nuevoEstado?: EstadoFiltro, overrideAsesor?: number | null) {
    if (!sucursalId) return
    const est = nuevoEstado ?? estado
    const asesor = overrideAsesor !== undefined ? (overrideAsesor ?? undefined) : asesorId
    setLoading(true)
    try {
      const result = await reporteService.getClientes(sucursalId, asesor, est)
      setData(result)
      setPage(0)
      setLastFilters({ estado: est, asesorId: asesor })
    } finally {
      setLoading(false)
    }
  }

  function handleEstado(est: EstadoFiltro) {
    setEstado(est)
    generar(est)
  }

  function handleAsesor(id?: number) {
    setAsesorId(id)
    generar(undefined, id ?? null)
  }

  const paginated = useMemo(() => {
    if (!data) return []
    const start = page * PAGE_SIZE
    return data.clientes.slice(start, start + PAGE_SIZE)
  }, [data, page])

  const totalPages = data ? Math.ceil(data.clientes.length / PAGE_SIZE) : 0

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
                <option key={a.id} value={a.id}>{a.nombre_completo}</option>
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
          <div className="flex gap-2">
            <ExportPdfButton
              onExport={() => reporteService.exportClientesPdf(
                sucursalId!,
                lastFilters?.asesorId,
                lastFilters?.estado ?? estado,
              )}
              disabled={loading || !lastFilters}
            />
            <ExportExcelButton
              onExport={() => reporteService.exportClientesExcel(
                sucursalId!,
                lastFilters?.asesorId,
                lastFilters?.estado ?? estado,
              )}
              disabled={loading || !lastFilters}
            />
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Total Clientes" value={String(data.total)}
              colorClass="bg-gray-50 border-gray-300 text-gray-800" />
            <MetricCard label="Activos" value={String(data.totalActivos)}
              colorClass="bg-emerald-50 border-emerald-300 text-emerald-800" />
            <MetricCard label="En Mora" value={String(data.totalEnMora)}
              colorClass="bg-red-50 border-red-300 text-red-800" />
            <MetricCard label="Sin Crédito" value={String(data.totalSinCredito)}
              colorClass="bg-amber-50 border-amber-300 text-amber-800" />
            <MetricCard label="Inactivos" value={String(data.totalInactivos)}
              colorClass="bg-zinc-50 border-zinc-300 text-zinc-700" />
          </div>

          {data.clientes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No hay clientes con ese filtro</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left w-[90px]">No.</th>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Celular</th>
                    <th className="px-4 py-3 text-left">CURP</th>
                    <th className="px-4 py-3 text-left">Negocio</th>
                    <th className="px-4 py-3 text-left">Asesor</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-left">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                        {c.numeroCliente ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium">{c.nombreCompleto}</td>
                      <td className="px-4 py-3 text-gray-600">{c.celular}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.curp}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.negocioNombre ?? <span className="text-gray-400">—</span>}
                        {c.negocioGiro && (
                          <span className="ml-1 text-xs text-gray-400">({c.negocioGiro})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.asesorNombre}</td>
                      <td className="px-4 py-3 text-center">
                        <EstadoBadge estado={c.estadoCliente} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {fmtFecha(c.fechaAlta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                  <tr>
                    <td colSpan={6} className="px-4 py-3">TOTAL ({data.clientes.length} clientes)</td>
                    <td className="px-4 py-3 text-center text-xs">
                      {data.totalActivos} activos · {data.totalEnMora} mora
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
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
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
