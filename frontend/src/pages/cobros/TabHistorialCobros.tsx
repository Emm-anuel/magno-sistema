import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { cobrosService } from '@/services/cobrosService'
import { useAuthStore } from '@/hooks/useAuthStore'
import ModalModificarPago from '@/components/cobros/ModalModificarPago'
import TipoPagoBadge from '@/components/TipoPagoBadge'
import type { AbonoCorrienteHistorialDTO, PagoCobroDTO, TipoPago } from '@/types'
import { api } from '@/services/api'
import { formatLocalDate, todayLocalStr } from '@/utils/date'

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function todayStr() {
  return todayLocalStr()
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatLocalDate(d)
}

function weekStartStr() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return formatLocalDate(d)
}

function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type PresetFecha = 'hoy' | 'ayer' | 'semana' | 'mes' | 'rango'

const PRESETS: { key: PresetFecha; label: string }[] = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'ayer',   label: 'Ayer' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: 'rango',  label: 'Rango personalizado' },
]

function getPresetDates(preset: PresetFecha): { desde: string; hasta: string } {
  const hoy = todayStr()
  switch (preset) {
    case 'hoy':    return { desde: hoy,             hasta: hoy }
    case 'ayer':   return { desde: yesterdayStr(),   hasta: yesterdayStr() }
    case 'semana': return { desde: weekStartStr(),   hasta: hoy }
    case 'mes':    return { desde: monthStartStr(),  hasta: hoy }
    case 'rango':  return { desde: hoy,              hasta: hoy }
  }
}

function estadoFromPago(p: PagoCobroDTO): 'PAGADO' | 'PARCIAL' | 'NO_PAGADO' | 'PENDIENTE' {
  if (p.esPendiente) return 'PENDIENTE'
  if (p.razonNoPago) return 'NO_PAGADO'
  if (p.esCompleto)  return 'PAGADO'
  return 'PARCIAL'
}

function estadoFromAbono(a: AbonoCorrienteHistorialDTO): 'PAGADO' | 'PARCIAL' {
  return a.diasParciales > 0 ? 'PARCIAL' : 'PAGADO'
}

export default function TabHistorialCobros() {
  const { usuario } = useAuthStore()
  const navigate = useNavigate()

  const esAdminSupervisor =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const [preset, setPreset] = useState<PresetFecha>('hoy')
  const [fechaDesde, setFechaDesde] = useState(todayStr())
  const [fechaHasta, setFechaHasta] = useState(todayStr())
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO'>('')
  const [asesorFiltro, setAsesorFiltro] = useState<number | undefined>(undefined)
  const [buscar, setBuscar] = useState('')
  const [page, setPage] = useState(0)
  const [pagoEditar, setPagoEditar] = useState<PagoCobroDTO | null>(null)

  function applyPreset(p: PresetFecha) {
    setPreset(p)
    if (p !== 'rango') {
      const { desde, hasta } = getPresetDates(p)
      setFechaDesde(desde)
      setFechaHasta(hasta)
    }
    setPage(0)
  }

  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-list'],
    queryFn: () =>
      api.get<{ id: number; nombre_completo: string }[]>('/clientes/asesores').then((r) => r.data),
    enabled: esAdminSupervisor,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['historial-cobros', fechaDesde, fechaHasta, asesorFiltro, page],
    queryFn: () =>
      cobrosService.getHistorial({
        fechaDesde,
        fechaHasta,
        asesorId: asesorFiltro,
        page,
        size: 50,
      }),
    staleTime: 30_000,
  })

  const { data: abonosAdeudo = [], isLoading: isLoadingAbonos } = useQuery({
    queryKey: ['historial-abonos-corriente', fechaDesde, fechaHasta, asesorFiltro],
    queryFn: () =>
      cobrosService.getHistorialAbonos({
        fechaDesde,
        fechaHasta,
        asesorId: asesorFiltro,
      }),
    staleTime: 30_000,
  })

  const pagos = useMemo(() => data?.content ?? [], [data?.content])
  const totalPages = data?.totalPages ?? data?.total_pages ?? 1

  const filtrados = useMemo(() => {
    return pagos.filter((p) => {
      if (buscar.trim()) {
        const q = buscar.toLowerCase()
        if (!p.cliente.nombreCompleto.toLowerCase().includes(q)) return false
      }
      if (estadoFiltro && estadoFromPago(p) !== estadoFiltro) return false
      return true
    })
  }, [pagos, buscar, estadoFiltro])

  const abonosFiltrados = useMemo(() => {
    return abonosAdeudo.filter((a) => {
      if (buscar.trim()) {
        const q = buscar.toLowerCase()
        if (!a.cliente.nombreCompleto.toLowerCase().includes(q)) return false
      }
      if (estadoFiltro === 'NO_PAGADO') return false
      if (estadoFiltro && estadoFromAbono(a) !== estadoFiltro) return false
      return true
    })
  }, [abonosAdeudo, buscar, estadoFiltro])

  const totalCobradoPagos = filtrados.reduce((sum, p) => sum + (p.esPendiente ? 0 : Number(p.montoRecibido ?? 0)), 0)
  const totalCobradoAbonos = abonosFiltrados.reduce((sum, a) => sum + Number(a.montoDistribuido ?? 0), 0)
  const totalCobrado = totalCobradoPagos + totalCobradoAbonos
  const totalMultasPagos = filtrados.reduce((sum, p) => sum + (p.esPendiente ? 0 : Number(p.multaAplicada ?? 0)), 0)
  const totalMultasAbonos = abonosFiltrados.reduce((sum, a) => sum + Number(a.montoMulta ?? 0), 0)
  const totalMultas  = totalMultasPagos + totalMultasAbonos

  return (
    <>
      {/* ── Filtros ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                preset === key
                  ? 'bg-[#3d6b35] text-white border-[#3d6b35]'
                  : 'bg-white text-[#495057] border-[#dee2e6] hover:border-[#adb5bd]'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Buscar cliente..."
            className="input text-[13px] py-[5px] ml-auto w-full sm:w-48"
            value={buscar}
            onChange={(e) => { setBuscar(e.target.value); setPage(0) }}
          />
        </div>

        {preset === 'rango' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#6c757d] whitespace-nowrap">Desde</label>
              <input
                type="date"
                className="input text-[13px] py-[5px]"
                value={fechaDesde}
                max={fechaHasta}
                onChange={(e) => { setFechaDesde(e.target.value); setPage(0) }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#6c757d] whitespace-nowrap">Hasta</label>
              <input
                type="date"
                className="input text-[13px] py-[5px]"
                value={fechaHasta}
                min={fechaDesde}
                max={todayStr()}
                onChange={(e) => { setFechaHasta(e.target.value); setPage(0) }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input text-[13px] py-[5px] w-auto"
            value={estadoFiltro}
            onChange={(e) => { setEstadoFiltro(e.target.value as '' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO'); setPage(0) }}
          >
            <option value="">Todos los estados</option>
            <option value="PAGADO">Pagado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="NO_PAGADO">No pagó</option>
          </select>

          {esAdminSupervisor && (
            <select
              className="input text-[13px] py-[5px] w-auto"
              value={asesorFiltro ?? ''}
              onChange={(e) => { setAsesorFiltro(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
            >
              <option value="">Todos los asesores</option>
              {asesores.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre_completo}</option>
              ))}
            </select>
          )}

          <button type="button" className="btn btn-sm ml-auto" disabled title="Próximamente">
            Exportar
          </button>
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#212529]">{filtrados.length + abonosFiltrados.length}</div>
          <div className="text-[11px] text-[#6c757d]">En esta página</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#16a34a]">{fmtMoney(totalCobrado)}</div>
          <div className="text-[11px] text-[#6c757d]">Total cobrado</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${totalMultas > 0 ? 'text-[#dc2626]' : 'text-[#212529]'}`}>
            {fmtMoney(totalMultas)}
          </div>
          <div className="text-[11px] text-[#6c757d]">Multas aplicadas</div>
        </div>
      </div>

      {/* Abonos de adeudo */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#212529]">Abonos de adeudo</h3>
          {abonosFiltrados.length > 0 && (
            <span className="text-[11px] text-[#6c757d]">
              {abonosFiltrados.length} registro{abonosFiltrados.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {isLoadingAbonos ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-6">Cargando abonos...</p>
        ) : abonosFiltrados.length === 0 ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-6 bg-[#f8f9fa] rounded-lg">
            Sin abonos de adeudo en el periodo.
          </p>
        ) : (
          <>
            <div className="lg:hidden space-y-3">
              {abonosFiltrados.map((a) => {
                const estado = estadoFromAbono(a)
                return (
                  <div key={a.abonoId} className="card p-4 border-l-4 border-l-[#d97706]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#212529] truncate">
                          {a.cliente.nombreCompleto}
                        </p>
                        <p className="text-[12px] text-[#6c757d] mt-0.5">
                          Abono adeudo - {fmtDate(a.fecha)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge ${estado === 'PAGADO' ? 'badge-verde' : 'badge-amarillo'}`}>
                            {estado === 'PAGADO' ? 'Cubierto' : 'Parcial'}
                          </span>
                          <span className="text-[11px] text-[#6c757d]">
                            {a.diasCubiertos} cubierto{a.diasCubiertos === 1 ? '' : 's'}
                            {a.diasParciales > 0 ? `, ${a.diasParciales} parcial` : ''}
                          </span>
                        </div>
                        <p className="text-[13px] font-semibold mt-1 text-[#212529]">
                          {fmtMoney(a.montoDistribuido)}
                          {Number(a.montoMulta ?? 0) > 0 && (
                            <span className="text-[12px] font-normal text-[#dc2626]">
                              {' '}incl. {fmtMoney(a.montoMulta)} multa
                            </span>
                          )}
                        </p>
                        {a.registradoPor && (
                          <p className="text-[11px] text-[#adb5bd] mt-0.5">
                            Registrado por: {a.registradoPor.nombreCompleto}
                          </p>
                        )}
                        {a.createdAt && (
                          <p className="text-[10px] text-[#adb5bd] mt-0.5">
                            Fecha y hora: {fmtDateTime(a.createdAt)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm text-xs shrink-0"
                        onClick={() => navigate(`/creditos/${a.creditoId}`)}
                      >
                        Ver credito
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden lg:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Tipo</th>
                      <th>Dias</th>
                      <th className="text-right">Recibido</th>
                      <th className="text-right">Multa</th>
                      <th>Estado</th>
                      <th>Fecha cobro</th>
                      <th>Fecha y hora de registro</th>
                      <th>Registrado por</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {abonosFiltrados.map((a) => {
                      const estado = estadoFromAbono(a)
                      return (
                        <tr key={a.abonoId}>
                          <td className="font-medium">{a.cliente.nombreCompleto}</td>
                          <td className="text-[#6c757d]">Abono adeudo</td>
                          <td className="text-[#6c757d]">
                            {a.diasCubiertos} cubierto{a.diasCubiertos === 1 ? '' : 's'}
                            {a.diasParciales > 0 ? `, ${a.diasParciales} parcial` : ''}
                          </td>
                          <td className="text-right font-semibold text-[#2d6a4f]">{fmtMoney(a.montoDistribuido)}</td>
                          <td className="text-right text-[#dc2626]">{Number(a.montoMulta ?? 0) > 0 ? fmtMoney(a.montoMulta) : '—'}</td>
                          <td>
                            <span className={`badge ${estado === 'PAGADO' ? 'badge-verde' : 'badge-amarillo'}`}>
                              {estado === 'PAGADO' ? 'Cubierto' : 'Parcial'}
                            </span>
                          </td>
                          <td className="text-[#6c757d] whitespace-nowrap">{fmtDate(a.fecha)}</td>
                          <td className="text-[12px] text-[#adb5bd] whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                          <td className="text-[12px] text-[#adb5bd]">{a.registradoPor?.nombreCompleto ?? '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm text-xs"
                              onClick={() => navigate(`/creditos/${a.creditoId}`)}
                            >
                              Ver credito
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Mobile: cards ── */}
      <div className="lg:hidden space-y-3">
        {isLoading && (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando...</p>
        )}
        {!isLoading && filtrados.length === 0 && (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Sin registros en el período.</p>
        )}
        {filtrados.map((p) => {
          const estado = estadoFromPago(p)
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#212529] truncate">
                    {p.cliente.nombreCompleto}
                  </p>
                  <p className="text-[12px] text-[#6c757d] mt-0.5">
                    Pago #{p.numeroPago} · {fmtDate(p.fechaPago)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <TipoPagoBadge tipo={p.tipoPago as TipoPago} size="sm" />
                    <span className={`badge ${
                      estado === 'NO_PAGADO'  ? 'badge-rojo'
                      : estado === 'PAGADO'   ? 'badge-verde'
                      : estado === 'PENDIENTE'? 'badge-gris'
                      : 'badge-amarillo'
                    }`}>
                      {estado === 'NO_PAGADO' ? 'No pagó'
                        : estado === 'PAGADO'   ? 'Pagado'
                        : estado === 'PENDIENTE'? 'Sin registrar'
                        : 'Parcial'}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold mt-1 text-[#212529]">
                    {estado === 'NO_PAGADO' || estado === 'PENDIENTE' ? '—' : fmtMoney(p.montoRecibido)}
                    <span className="text-[12px] font-normal text-[#6c757d]">
                      {' / '}{fmtMoney(p.montoEsperado)}
                    </span>
                  </p>
                  {p.razonNoPago && (
                    <p className="text-[11px] text-[#6c757d] italic mt-0.5">{p.razonNoPago}</p>
                  )}
                  {p.registradoPor && (
                    <p className="text-[11px] text-[#adb5bd] mt-0.5">
                      Asesor: {p.registradoPor.nombreCompleto}
                    </p>
                  )}
                  {p.createdAt && (
                    <p className="text-[10px] text-[#adb5bd] mt-0.5">
                      Fecha y hora: {fmtDateTime(p.createdAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm text-xs"
                    onClick={() => navigate(`/clientes/${p.cliente.id}`)}
                  >
                    Ver cliente
                  </button>
                  {esAdminSupervisor && !p.esPendiente && (
                    <button
                      type="button"
                      className="btn btn-sm text-xs"
                      onClick={() => setPagoEditar(p)}
                    >
                      Modificar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop: tabla ── */}
      <div className="hidden lg:block card overflow-hidden">
        {isLoading ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Sin registros en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pago #</th>
                  <th className="text-right">Esperado</th>
                  <th className="text-right">Recibido</th>
                  <th className="text-right">Diferencia</th>
                  <th>Forma de Pago</th>
                  <th>Estado</th>
                  <th>Fecha cobro</th>
                  <th>Fecha y hora de registro</th>
                  <th>Registrado por</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const estado = estadoFromPago(p)
                  const diferencia = Number(p.montoRecibido) - Number(p.montoEsperado)
                  const difNeg = diferencia < -0.01
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.cliente.nombreCompleto}</td>
                      <td className="text-[#6c757d]">#{p.numeroPago}</td>
                      <td className="text-right text-[#6c757d]">{fmtMoney(p.montoEsperado)}</td>
                      <td className={`text-right font-semibold ${
                        estado === 'NO_PAGADO'  ? 'text-[#dc2626]'
                        : estado === 'PAGADO'   ? 'text-[#2d6a4f]'
                        : estado === 'PENDIENTE'? 'text-[#6c757d]'
                        : 'text-[#f59e0b]'
                      }`}>
                        {estado === 'NO_PAGADO' || estado === 'PENDIENTE' ? '—' : fmtMoney(p.montoRecibido)}
                      </td>
                      <td className={`text-right font-semibold ${difNeg ? 'text-[#dc2626]' : 'text-[#6c757d]'}`}>
                        {estado === 'NO_PAGADO' || estado === 'PENDIENTE' ? '—' : (difNeg ? '-' : '') + fmtMoney(Math.abs(diferencia))}
                      </td>
                      <td>
                        <TipoPagoBadge tipo={p.tipoPago as TipoPago} size="sm" />
                      </td>
                      <td>
                        <span className={`badge ${
                          estado === 'NO_PAGADO'  ? 'badge-rojo'
                          : estado === 'PAGADO'   ? 'badge-verde'
                          : estado === 'PENDIENTE'? 'badge-gris'
                          : 'badge-amarillo'
                        }`}>
                          {estado === 'NO_PAGADO' ? 'No pagó'
                            : estado === 'PAGADO'   ? 'Pagado'
                            : estado === 'PENDIENTE'? 'Sin registrar'
                            : 'Parcial'}
                        </span>
                      </td>
                      <td className="text-[#6c757d] whitespace-nowrap">{fmtDate(p.fechaPago)}</td>
                      <td className="text-[12px] text-[#adb5bd] whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                      <td className="text-[12px] text-[#adb5bd]">
                        {p.registradoPor?.nombreCompleto ?? '—'}
                        {p.modificadoPor && (
                          <span className="block text-[10px] italic">
                            Mod: {p.modificadoPor.nombreCompleto}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="btn btn-sm text-xs"
                            onClick={() => navigate(`/clientes/${p.cliente.id}`)}
                          >
                            Ver cliente
                          </button>
                          {esAdminSupervisor && !p.esPendiente && (
                            <button
                              type="button"
                              className="btn btn-sm text-xs"
                              onClick={() => setPagoEditar(p)}
                            >
                              Modificar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            className="btn btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="text-[12px] text-[#6c757d]">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── Modal modificar ── */}
      {pagoEditar && (
        <ModalModificarPago
          pago={pagoEditar}
          onClose={() => setPagoEditar(null)}
          onSuccess={() => setPagoEditar(null)}
        />
      )}
    </>
  )
}
