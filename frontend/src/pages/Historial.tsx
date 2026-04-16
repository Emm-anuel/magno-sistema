import { useState, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import { api } from '@/services/api'
import type { CalendarioPagoDetalle } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDateLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  return `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short',
  })
}

// ── Payment cell ──────────────────────────────────────────────────────

interface CellProps {
  pago: CalendarioPagoDetalle | undefined
  isHoy: boolean
  selectedDate: string
}

function PaymentCell({ pago, isHoy, selectedDate }: CellProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const borderCls = isHoy ? 'ring-2 ring-inset ring-blue-500' : ''

  if (!pago) {
    return (
      <td className={`text-center p-0.5 ${borderCls}`}>
        <span className="block w-7 h-7 mx-auto" />
      </td>
    )
  }

  let symbol = '·'
  let cls = 'bg-gray-50 text-gray-400'
  const isPast = pago.fechaProgramada.slice(0, 10) < selectedDate

  switch (pago.estado as string) {
    case 'PAGADO':
      symbol = '✓'; cls = 'bg-green-100 text-green-700 font-bold'; break
    case 'ADELANTADO':
      symbol = 'A'; cls = 'bg-green-50 text-green-600 font-semibold'; break
    case 'PARCIAL':
      symbol = '$'; cls = 'bg-amber-100 text-amber-700 font-semibold'; break
    case 'NO_PAGADO':
      symbol = '✗'; cls = 'bg-red-100 text-red-700 font-bold'; break
    case 'INHABILL':
    case 'INHABIL':
      symbol = '—'; cls = 'bg-gray-100 text-gray-400'; break
    case 'PENDIENTE':
    default:
      symbol = '·'
      cls = isPast ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-400'
  }

  const hasTooltip = pago.estado === 'NO_PAGADO'

  return (
    <td className={`text-center p-0.5 ${borderCls}`}>
      <div className="relative">
        <span
          className={`block w-7 h-7 mx-auto rounded flex items-center justify-center text-[11px] cursor-default select-none ${cls}`}
          onMouseEnter={() => hasTooltip && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {symbol}
        </span>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap pointer-events-none">
            No pagó
          </div>
        )}
      </div>
    </td>
  )
}

// ── Main component ────────────────────────────────────────────────────

export default function Historial() {
  const { usuario } = useAuthStore()

  const esAdminSupervisor =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const esRestringido =
    usuario?.rol === 'ASESOR_COBRADOR' || usuario?.rol === 'SUPERVISOR_CAMPO'

  const [fecha, setFecha] = useState(todayStr())
  const [asesorId, setAsesorId] = useState<number | undefined>(
    esRestringido ? (usuario?.id ?? undefined) : undefined
  )

  // Lista de asesores para admin/supervisor
  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-list'],
    queryFn: () =>
      api
        .get<{ id: number; nombre_completo: string }[]>('/clientes/asesores')
        .then((r) => r.data),
    enabled: esAdminSupervisor,
    staleTime: 60_000,
  })

  const asesorNombre = esRestringido
    ? usuario?.nombre_completo
    : asesores.find((a) => a.id === asesorId)?.nombre_completo

  // Ruta del día → lista de clientes con numeroPagoHoy
  const { data: rutaDia, isLoading: isLoadingRuta } = useQuery({
    queryKey: ['ruta-dia', asesorId, fecha],
    queryFn: () => cobrosService.getRutaDia({ asesorId, fecha }),
    enabled: !!asesorId,
    staleTime: 30_000,
  })

  const clientes = rutaDia?.clientes ?? []

  // Fetch full credit detail (with calendar) for each client in parallel
  const creditoQueries = useQueries({
    queries: clientes.map((c) => ({
      queryKey: ['credito', c.creditoId] as const,
      queryFn: () => creditoService.obtener(c.creditoId),
      staleTime: 30_000,
      enabled: !!asesorId && clientes.length > 0,
    })),
  })

  const isLoadingCreditos = creditoQueries.some((q) => q.isLoading)
  const isLoading = isLoadingRuta || isLoadingCreditos

  // Max payment columns (25 or 30)
  const maxPagos = useMemo(() => {
    if (clientes.length === 0) return 25
    return Math.max(...clientes.map((c) => c.totalPagos ?? 25))
  }, [clientes])

  const resumen = rutaDia?.resumen

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-bold text-[#212529]">Historial de Pago</h1>

      {/* ── Filtros: asesor + fecha ── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {esAdminSupervisor ? (
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#6c757d] whitespace-nowrap font-medium">
                Asesor
              </label>
              <select
                className="input text-[13px] py-[5px]"
                value={asesorId ?? ''}
                onChange={(e) =>
                  setAsesorId(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">— Seleccionar asesor —</option>
                {asesores.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#6c757d] font-medium">Asesor:</span>
              <span className="text-[13px] font-semibold text-[#212529]">{asesorNombre}</span>
            </div>
          )}

          {/* Navegación de fecha */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              className="btn btn-sm p-1.5"
              onClick={() => setFecha(addDays(fecha, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              className="input text-[13px] py-[5px] w-40"
              value={fecha}
              max={todayStr()}
              onChange={(e) => setFecha(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm p-1.5"
              onClick={() => setFecha(addDays(fecha, 1))}
              disabled={fecha >= todayStr()}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Placeholder when no asesor selected ── */}
      {!asesorId && (
        <div className="card p-8 text-center text-[#adb5bd] text-[14px]">
          Selecciona un asesor para ver su historial de pago.
        </div>
      )}

      {/* ── Content when asesor is selected ── */}
      {asesorId && (
        <>
          {/* Report header */}
          <div className="card p-4 space-y-3">
            <div>
              <p className="text-[14px] font-bold text-[#212529]">{asesorNombre}</p>
              <p className="text-[12px] text-[#6c757d] capitalize">{fmtDateLabel(fecha)}</p>
            </div>

            {resumen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-[13px] font-bold text-[#212529]">
                    {fmtMoney(resumen.totalCaja)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Caja</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-[13px] font-bold text-[#212529]">
                    {fmtMoney(resumen.totalRuta)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Ruta</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div
                    className={`text-[13px] font-bold ${
                      resumen.noPagaron > 0 ? 'text-[#dc2626]' : 'text-[#212529]'
                    }`}
                  >
                    {resumen.noPagaron}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">No pagaron</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div
                    className={`text-[13px] font-bold ${
                      resumen.totalMultasCobradas > 0 ? 'text-[#dc2626]' : 'text-[#212529]'
                    }`}
                  >
                    {fmtMoney(resumen.totalMultasCobradas)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Multas</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-[13px] font-bold text-[#16a34a]">
                    {fmtMoney(resumen.totalCaja + resumen.totalRuta)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Total cobrado</div>
                </div>
              </div>
            )}
          </div>

          {/* Control table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <p className="text-[#adb5bd] text-[13px] text-center py-10">
                Cargando tabla...
              </p>
            ) : clientes.length === 0 ? (
              <p className="text-[#adb5bd] text-[13px] text-center py-10">
                Sin clientes activos para este asesor en esta fecha.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-[12px] border-collapse w-full">
                  <thead>
                    <tr className="bg-[#f8f9fa] text-[#6c757d]">
                      <th className="sticky left-0 z-20 bg-[#f8f9fa] text-left px-3 py-2 border-b border-r border-[#e9ecef] whitespace-nowrap min-w-[160px]">
                        Cliente
                      </th>
                      <th className="text-right px-2 py-2 border-b border-[#e9ecef] whitespace-nowrap">
                        Pago/día
                      </th>
                      {Array.from({ length: maxPagos }, (_, i) => i + 1).map((n) => (
                        <th
                          key={n}
                          className="text-center px-0 py-2 border-b border-[#e9ecef] w-8 min-w-[2rem]"
                        >
                          {n}
                        </th>
                      ))}
                      <th className="text-center px-2 py-2 border-b border-[#e9ecef] whitespace-nowrap">
                        Venc.
                      </th>
                      <th className="text-center px-2 py-2 border-b border-[#e9ecef]">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cliente, idx) => {
                      const creditoQuery = creditoQueries[idx]
                      const credito = creditoQuery?.data
                      const calendario: CalendarioPagoDetalle[] =
                        credito?.calendario ?? []

                      // Map numeroPago → CalendarioPagoDetalle
                      const calMap = new Map(
                        calendario.map((p) => [p.numeroPago, p])
                      )

                      return (
                        <tr
                          key={cliente.clienteId}
                          className="hover:bg-[#f8f9fa] border-b border-[#f1f3f5]"
                        >
                          {/* Sticky first column */}
                          <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-[#e9ecef] shadow-[1px_0_0_#e9ecef]">
                            <div className="font-medium text-[#212529] truncate max-w-[148px]">
                              {cliente.nombreCompleto}
                            </div>
                            <div className="text-[10px] text-[#adb5bd]">{cliente.celular}</div>
                          </td>

                          <td className="text-right px-2 py-2 font-semibold text-[#212529] whitespace-nowrap">
                            {fmtMoney(cliente.pagoPeriodico)}
                          </td>

                          {Array.from({ length: maxPagos }, (_, i) => i + 1).map((n) => (
                            <PaymentCell
                              key={n}
                              pago={calMap.get(n)}
                              isHoy={n === (cliente.numeroPagoHoy ?? -1)}
                              selectedDate={fecha}
                            />
                          ))}

                          <td className="text-center px-2 py-2 text-[#6c757d] whitespace-nowrap">
                            {fmtDateShort(credito?.fechaVencimiento)}
                          </td>
                          <td className="text-center px-2 py-2">
                            <span
                              className={`badge text-[10px] ${
                                credito?.estado === 'ACTIVO'
                                  ? 'badge-verde'
                                  : credito?.estado === 'PAGADO'
                                  ? 'badge-azul'
                                  : 'badge-gris'
                              }`}
                            >
                              {credito?.estado ?? '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
