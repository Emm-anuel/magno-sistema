import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { dashboardService } from '@/services/dashboardService'
import { useAuthStore } from '@/hooks/useAuthStore'
import SucursalSelector from '@/components/reportes/SucursalSelector'
import { formatLocalDate, todayLocalStr } from '@/utils/date'

type RangeMode = 'hoy' | 'semana' | 'mes' | 'custom'

function noopOnChange() {
  // no-op: la sucursal es fija para roles no admin (modo readonly)
}

function dateFromStr(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

function weekRange(dateStr: string) {
  const base = dateFromStr(dateStr)
  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(base)
  start.setDate(base.getDate() + diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { desde: formatLocalDate(start), hasta: formatLocalDate(end) }
}

function monthRange(dateStr: string) {
  const base = dateFromStr(dateStr)
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  return { desde: formatLocalDate(start), hasta: formatLocalDate(end) }
}

function fmtMoney(value?: number | null) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
}

function fmtPct(value?: number | null) {
  if (value == null) return '—'
  return `${(Number(value) * 100).toFixed(0)}%`
}

function mapEstadoLabel(estado?: string | null) {
  switch (estado) {
    case 'PAGADO': return 'Pagado'
    case 'ADELANTADO': return 'Adelantado'
    case 'PARCIAL': return 'Parcial'
    case 'NO_PAGADO': return 'No pagado'
    case 'PENDIENTE': return 'Pendiente'
    default: return '—'
  }
}

export default function DashboardPage() {
  const { usuario } = useAuthStore()

  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const isSupervisor = usuario?.rol === 'SUPERVISOR'
  const isSupervisorCampo = usuario?.rol === 'SUPERVISOR_CAMPO'
  const isAsesor = usuario?.rol === 'ASESOR_COBRADOR'

  const today = todayLocalStr()
  const [rangeMode, setRangeMode] = useState<RangeMode>('hoy')
  const [customDesde, setCustomDesde] = useState(today)
  const [customHasta, setCustomHasta] = useState(today)

  const [sucursalId, setSucursalId] = useState<number | null>(
    isAdmin ? null : (usuario?.sucursal?.id ?? null),
  )
  const [asesorId, setAsesorId] = useState<number | undefined>(
    isAsesor ? usuario?.id : undefined,
  )

  useEffect(() => {
    if (!isAdmin) {
      setSucursalId(usuario?.sucursal?.id ?? null)
    }
  }, [isAdmin, usuario?.sucursal?.id])

  useEffect(() => {
    if (isAsesor) {
      setAsesorId(usuario?.id)
    }
  }, [isAsesor, usuario?.id])

  useEffect(() => {
    if (isAdmin) {
      setAsesorId(undefined)
    }
  }, [sucursalId, isAdmin])

  const { desde, hasta } = useMemo(() => {
    switch (rangeMode) {
      case 'semana':
        return weekRange(today)
      case 'mes':
        return monthRange(today)
      case 'custom':
        return { desde: customDesde, hasta: customHasta }
      case 'hoy':
      default:
        return { desde: today, hasta: today }
    }
  }, [rangeMode, today, customDesde, customHasta])

  const rangeLabel = useMemo(() => {
    switch (rangeMode) {
      case 'semana': return 'Semana'
      case 'mes': return 'Mes'
      case 'custom': return 'Periodo'
      default: return 'Hoy'
    }
  }, [rangeMode])

  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-dashboard', sucursalId],
    queryFn: () =>
      api.get<{ id: number; nombre_completo: string }[]>(
        '/clientes/asesores',
        { params: isAdmin && sucursalId ? { sucursalId } : undefined },
      ).then((r) => r.data),
    enabled: (isAdmin || isSupervisor || isSupervisorCampo) && (!!sucursalId || !isAdmin),
    staleTime: 60_000,
  })

  const canChooseAsesor = isAdmin || isSupervisor || isSupervisorCampo
  const canChooseSucursal = isAdmin

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', sucursalId, asesorId, desde, hasta],
    queryFn: () => dashboardService.getDashboard({
      sucursalId: sucursalId ?? undefined,
      asesorId,
      desde,
      hasta,
    }),
    enabled: !!usuario?.id && !!desde && !!hasta && (!isAdmin || !!sucursalId),
    staleTime: 30_000,
  })

  const kpis = data?.kpis
  const cobrosPendientes = data?.cobrosPendientes ?? []
  const renovaciones = data?.renovaciones ?? []
  const ingresoPorAsesor = data?.ingresoPorAsesor ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-[12px] text-gray-500">
            {rangeLabel} · {desde} a {hasta}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canChooseSucursal ? (
            <SucursalSelector
              sucursalId={sucursalId}
              onChange={setSucursalId}
            />
          ) : (
            <SucursalSelector
              sucursalId={sucursalId}
              onChange={noopOnChange}
              readonly
              readonlyNombre={usuario?.sucursal?.nombre}
            />
          )}

          {canChooseAsesor && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Asesor:</label>
              <select
                value={asesorId ?? ''}
                onChange={(e) => setAsesorId(e.target.value ? Number(e.target.value) : undefined)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={isAdmin && !sucursalId}
              >
                <option value="">Todos los asesores</option>
                {asesores.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${rangeMode === 'hoy' ? 'btn-primary' : ''}`}
          onClick={() => setRangeMode('hoy')}
        >
          Hoy
        </button>
        <button
          type="button"
          className={`btn btn-sm ${rangeMode === 'semana' ? 'btn-primary' : ''}`}
          onClick={() => setRangeMode('semana')}
        >
          Semana
        </button>
        <button
          type="button"
          className={`btn btn-sm ${rangeMode === 'mes' ? 'btn-primary' : ''}`}
          onClick={() => setRangeMode('mes')}
        >
          Mes
        </button>
        <button
          type="button"
          className={`btn btn-sm ${rangeMode === 'custom' ? 'btn-primary' : ''}`}
          onClick={() => setRangeMode('custom')}
        >
          Personalizado
        </button>

        {rangeMode === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input text-[13px] py-[5px]"
              value={customDesde}
              onChange={(e) => setCustomDesde(e.target.value)}
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              className="input text-[13px] py-[5px]"
              value={customHasta}
              onChange={(e) => setCustomHasta(e.target.value)}
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="card p-8 text-center text-[#adb5bd] text-[13px]">
          Cargando datos del dashboard...
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── Métricas ── */}
          <div className={`grid grid-cols-2 gap-3 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
            <div className="metric-card">
              <p className="metric-label">Total cobrado</p>
              <p className="metric-val text-[#2d6a4f]">{fmtMoney(kpis?.totalCobrado ?? kpis?.cobros)}</p>
              <p className="metric-sub">Ruta + abonos</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Pagos de ruta</p>
              <p className="metric-val">{fmtMoney(kpis?.pagosRuta)}</p>
              <p className="metric-sub">Pagos normales</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Abonos adeudo</p>
              <p className="metric-val text-[#2563eb]">{fmtMoney(kpis?.abonosAdeudo)}</p>
              <p className="metric-sub">Recuperado</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Créditos activos</p>
              <p className="metric-val">{kpis?.creditosActivos ?? '—'}</p>
              <p className="metric-sub">Cartera vigente</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Multas {rangeLabel.toLowerCase()}</p>
              <p className="metric-val text-[#dc2626]">{fmtMoney(kpis?.multas)}</p>
              <p className="metric-sub">
                Ruta {fmtMoney(kpis?.multasRuta)} / Abonos {fmtMoney(kpis?.multasAbonos)}
              </p>
            </div>
            {isAdmin && (
              <div className="metric-card">
                <p className="metric-label">Apartado</p>
                <p className="metric-val text-[#f59e0b]">{fmtMoney(kpis?.montoAhorro)}</p>
                <p className="metric-sub">{fmtPct(kpis?.porcentajeAhorro)} del ingreso</p>
              </div>
            )}
            <div className="metric-card">
              <p className="metric-label">Desembolsos {rangeLabel.toLowerCase()}</p>
              <p className="metric-val">{fmtMoney(kpis?.desembolsos)}</p>
              <p className="metric-sub">Créditos y renovaciones</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">En mora</p>
              <p className="metric-val text-[#dc2626]">{kpis?.creditosEnMora ?? '—'}</p>
              <p className="metric-sub">Clientes en atraso</p>
            </div>
          </div>

          {/* ── Dos tablas en grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
            {/* Cobros pendientes */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Cobros pendientes hoy</span>
              </div>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Asesor</th>
                    <th>Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrosPendientes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-[#adb5bd] py-6 text-[13px]">
                        Sin datos por ahora
                      </td>
                    </tr>
                  ) : (
                    cobrosPendientes.map((item) => (
                      <tr key={item.creditoId}>
                        <td>{item.clienteNombre}</td>
                        <td>{item.asesorNombre}</td>
                        <td>{fmtMoney(item.montoEsperado)}</td>
                        <td>{mapEstadoLabel(item.estado)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Renovaciones */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Renovaciones del periodo</span>
              </div>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cr. Nuevo</th>
                    <th>Desembolso</th>
                  </tr>
                </thead>
                <tbody>
                  {renovaciones.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-[#adb5bd] py-6 text-[13px]">
                        Sin datos por ahora
                      </td>
                    </tr>
                  ) : (
                    renovaciones.map((item) => (
                      <tr key={item.renovacionId}>
                        <td>{item.clienteNombre}</td>
                        <td>{fmtMoney(item.creditoNuevo)}</td>
                        <td>{fmtMoney(item.montoDesembolso)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Tabla ingreso por asesor (full width) ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Ingreso por Asesor — {rangeLabel}</span>
            </div>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Pagos ruta</th>
                  <th>Abonos</th>
                  <th>Total cobrado</th>
                  <th>Desembolsos</th>
                  <th>Multas</th>
                  <th>Clientes</th>
                </tr>
              </thead>
              <tbody>
                {ingresoPorAsesor.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-[#adb5bd] py-6 text-[13px]">
                      Sin datos por ahora
                    </td>
                  </tr>
                ) : (
                  ingresoPorAsesor.map((item) => (
                    <tr key={item.asesorId}>
                      <td>{item.asesorNombre}</td>
                      <td>{fmtMoney(item.pagosRuta)}</td>
                      <td>{fmtMoney(item.abonosAdeudo)}</td>
                      <td>{fmtMoney(item.totalCobrado ?? item.ingresoCarteras)}</td>
                      <td>{fmtMoney(item.desembolsos)}</td>
                      <td>{fmtMoney(item.multas)}</td>
                      <td>{item.clientesActivos}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
