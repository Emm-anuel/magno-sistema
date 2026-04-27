import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReportePorAsesor, type AsesorResumen } from '@/services/reporteService'

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

function AsesorCard({ a }: { a: AsesorResumen }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{a.asesorNombre}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="p-4 bg-emerald-50 border-r border-gray-100">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">
            Cobranza del período
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Cobros registrados</dt>
              <dd className="font-medium">{a.cobrosRegistrados}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Monto cobrado</dt>
              <dd className="font-semibold text-emerald-700">{fmt(a.montoCobrado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Multas cobradas</dt>
              <dd className="font-medium">{fmt(a.multasCobradas)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Pagos incompletos</dt>
              <dd className={a.pagosIncompletos > 0 ? 'font-medium text-amber-700' : 'font-medium'}>
                {a.pagosIncompletos}
              </dd>
            </div>
          </dl>
        </div>
        <div className="p-4 bg-blue-50">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
            Cartera activa
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Clientes activos</dt>
              <dd className="font-medium">{a.clientesActivos}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Monto colocado</dt>
              <dd className="font-semibold text-blue-700">{fmt(a.montoTotalColocado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Clientes en mora</dt>
              <dd className={a.clientesEnMora > 0 ? 'font-medium text-red-700' : 'font-medium'}>
                {a.clientesEnMora}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Monto en riesgo</dt>
              <dd className={a.montoEnRiesgo > 0 ? 'font-medium text-red-700' : 'font-medium'}>
                {fmt(a.montoEnRiesgo)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

interface Props { sucursalId: number | null }

export default function TabPorAsesor({ sucursalId }: Props) {
  const { desde: d0, hasta: h0 } = mesActual()
  const [desde, setDesde] = useState(d0)
  const [hasta, setHasta] = useState(h0)
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [data, setData] = useState<ReportePorAsesor | null>(null)
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
      const result = await reporteService.getPorAsesor(sucursalId, desde, hasta, asesorId)
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
          <ExportPdfButton
            onExport={() => reporteService.exportPorAsesorPdf(
              sucursalId!,
              lastFilters?.desde ?? desde,
              lastFilters?.hasta ?? hasta,
              lastFilters?.asesorId ?? asesorId,
            )}
            disabled={!data || loading || !lastFilters}
          />
        )}
      </div>

      {generated && data && (
        <>
          <div className="space-y-4">
            {data.asesores.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No hay asesores con datos en ese período</div>
            ) : (
              data.asesores.map(a => <AsesorCard key={a.asesorId} a={a} />)
            )}
          </div>

          {data.asesores.length > 0 && (
            <div className="rounded-lg bg-emerald-100 border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-900">
              <span className="mr-4">Total cobros: {data.totalCobrosRegistrados}</span>
              <span className="mr-4">Total cobrado: {fmt(data.totalMontoCobrado)}</span>
              <span className="mr-4">Total multas: {fmt(data.totalMultasCobradas)}</span>
              <span className="mr-4">Clientes activos: {data.totalClientesActivos}</span>
              <span>En mora: {data.totalClientesEnMora}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
