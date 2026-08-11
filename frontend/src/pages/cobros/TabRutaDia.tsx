import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, RefreshCw } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'
import { useAuthStore } from '@/hooks/useAuthStore'
import EstadoCobroBadge from '@/components/cobros/EstadoCobroBadge'
import MultaBadge from '@/components/cobros/MultaBadge'
import TipoPagoBadge from '@/components/TipoPagoBadge'
import ModalRegistrarPago from '@/components/cobros/ModalRegistrarPago'
import ModalModificarPago from '@/components/cobros/ModalModificarPago'
import ModalPagarAdeudo from '@/components/cobros/ModalPagarAdeudo'
import type { ClienteRuta, PagoCobroDTO, TipoPago } from '@/types'
import { todayLocalStr } from '@/utils/date'

function fmtMoney(v: number) {
  return `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
}

function todayStr() {
  return todayLocalStr()
}

interface Props {
  asesorId?: number
  fecha: string
}

export default function TabRutaDia({ asesorId, fecha }: Props) {
  const usuario = useAuthStore((s) => s.usuario)
  const [buscar, setBuscar] = useState('')
  const [pagoModal, setPagoModal] = useState<ClienteRuta | null>(null)
  const [pagoEditar, setPagoEditar] = useState<PagoCobroDTO | null>(null)
  const [abonoModal, setAbonoModal] = useState<ClienteRuta | null>(null)
  const esFechaHistorica = fecha !== todayStr()
  const puedeRegistrarHistorico = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const esAdminSupervisor = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  // ── Query: ruta del día (auto-refresh cada 30s) ───────────────────
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ruta-dia', asesorId, fecha],
    queryFn: () =>
      cobrosService.getRutaDia({
        asesorId,
        fecha,
      }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const clientes = data?.clientes ?? []
  const resumen = data?.resumen

  // ── Filtrado por búsqueda ─────────────────────────────────────────
  const filtrados = buscar.trim()
    ? clientes.filter(
        (c) =>
          c.nombreCompleto.toLowerCase().includes(buscar.toLowerCase()) ||
          c.negocioNombre?.toLowerCase().includes(buscar.toLowerCase()) ||
          c.celular.includes(buscar),
      )
    : clientes

  const puedeCobrar = (c: ClienteRuta) =>
    c.estadoHoy === 'SIN_REGISTRO'
    && (!esFechaHistorica || puedeRegistrarHistorico)

  const puedeModificar = (c: ClienteRuta) =>
    c.estadoHoy !== 'SIN_REGISTRO'
    && !!c.pagoIdHoy
    && esAdminSupervisor

  const abrirAccionCobro = async (c: ClienteRuta) => {
    if (puedeCobrar(c)) {
      setPagoModal(c)
      return
    }

    if (!puedeModificar(c) || !c.pagoIdHoy) return

    try {
      const hist = await cobrosService.getHistorial({
        clienteId: c.clienteId,
        fechaDesde: fecha,
        fechaHasta: fecha,
        page: 0,
        size: 100,
      })
      const pago = (hist.content ?? []).find((p) => p.id === c.pagoIdHoy)
      if (!pago) {
        throw new Error('Pago no encontrado para edición')
      }
      setPagoEditar(pago)
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo cargar el pago para editar')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#adb5bd] text-[13px]">Cargando ruta del día...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-[#dc2626] text-[14px] mb-4">Error al cargar la ruta del día.</p>
        <button type="button" className="btn" onClick={() => refetch()}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ── Métricas ─────────────────────────────────────────────── */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="metric-card">
            <p className="metric-label">Sin registrar</p>
            <p className="metric-val text-[#2563eb]">{resumen.sinRegistrar}</p>
            <p className="metric-sub">de {resumen.totalClientes} clientes</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">No pagaron</p>
            <p className="metric-val text-[#dc2626]">{resumen.noPagaron}</p>
            <p className="metric-sub">con multa aplicada</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Multas cobradas</p>
            <p className="metric-val">{fmtMoney(resumen.totalMultasCobradas ?? 0)}</p>
            <p className="metric-sub">del día</p>
          </div>
        </div>
      )}

      {/* ── Barra de búsqueda + refresh ───────────────────────────── */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
          <input
            type="text"
            className="input pl-8"
            placeholder="Buscar cliente o negocio..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => refetch()}
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {esFechaHistorica && !puedeRegistrarHistorico && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Vista histórica: para fechas anteriores solo se muestran registros. Para ajustar pagos usa la pestaña Historial de Cobros.
        </div>
      )}

      {filtrados.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#adb5bd] text-[13px]">
            {buscar ? 'Sin resultados para la búsqueda.' : 'No hay clientes en la ruta de hoy.'}
          </p>
        </div>
      )}

      {/* ── Mobile: cards ────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        {filtrados.map((c) => (
          <ClienteCard
            key={c.clienteId}
            cliente={c}
            puedeRegistrar={puedeCobrar(c) || puedeModificar(c)}
            onCobrar={() => void abrirAccionCobro(c)}
            onPagarAdeudo={() => setAbonoModal(c)}
            esFechaHistorica={esFechaHistorica}
          />
        ))}
      </div>

      {/* ── Desktop: tabla ────────────────────────────────────────── */}
      <div className="hidden lg:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Negocio</th>
                <th className="text-right">Pago período</th>
                <th>Forma de Pago</th>
                <th className="text-right">Multas</th>
                <th># Pago</th>
                <th>Estado</th>
                <th>Razón</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <ClienteRow
                  key={c.clienteId}
                  cliente={c}
                  puedeRegistrar={puedeCobrar(c) || puedeModificar(c)}
                  onCobrar={() => void abrirAccionCobro(c)}
                  onPagarAdeudo={() => setAbonoModal(c)}
                  esFechaHistorica={esFechaHistorica}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal registrar pago ───────────────────────────────────── */}
      {pagoModal && (
        <ModalRegistrarPago
          creditoId={pagoModal.creditoId}
          pagoPeriodico={pagoModal.pagoPeriodico}
          nombreCliente={pagoModal.nombreCompleto}
          fecha={fecha}
          numeroPagoHoy={pagoModal.numeroPagoHoy}
          onClose={() => setPagoModal(null)}
          onSuccess={() => setPagoModal(null)}
        />
      )}

      {pagoEditar && (
        <ModalModificarPago
          pago={pagoEditar}
          onClose={() => setPagoEditar(null)}
          onSuccess={() => setPagoEditar(null)}
        />
      )}

      {abonoModal && (
        <ModalPagarAdeudo
          creditoId={abonoModal.creditoId}
          nombreCliente={abonoModal.nombreCompleto}
          modo={abonoModal.tieneAdeudoPendiente ? 'adeudo' : 'futuro'}
          onClose={() => setAbonoModal(null)}
          onSuccess={() => setAbonoModal(null)}
        />
      )}
    </>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────

function ClienteCard({
  cliente: c,
  puedeRegistrar,
  onCobrar,
  onPagarAdeudo,
  esFechaHistorica,
}: {
  cliente: ClienteRuta
  puedeRegistrar: boolean
  onCobrar: () => void
  onPagarAdeudo: () => void
  esFechaHistorica: boolean
}) {
  const puedePagarAdeudo = c.tieneAdeudoPendiente && !esFechaHistorica
  const puedeAbonarFuturo = !c.tieneAdeudoPendiente
    && !esFechaHistorica
    && (c.estadoHoy === 'PAGADO' || c.estadoHoy === 'INHABIL' || c.estadoHoy === 'INHABILL')
  const puedeRegistrarCorriente = puedeRegistrar

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-[#212529] truncate">
              {c.nombreCompleto}
            </span>
            <EstadoCobroBadge estado={c.estadoHoy} size="sm" />
            <TipoPagoBadge tipo={c.tipoPago as TipoPago} size="sm" />
          </div>
          <p className="text-[12px] text-[#6c757d] mt-0.5">{c.negocioNombre || c.celular}</p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#212529]">
              {fmtMoney(c.pagoPeriodico)}
              <span className="font-normal text-[#adb5bd]">/{c.tipoPago === 'SEMANAL' ? 'semana' : 'día'}</span>
            </span>
            {c.numeroPagoHoy && (
              <span className="text-[11px] text-[#6c757d]">Pago #{c.numeroPagoHoy}/{c.totalPagos}</span>
            )}
            <MultaBadge monto={c.multasPendientes} />
          </div>

          {c.razonNoPago && (
            <p className="text-[11px] text-[#dc2626] mt-1 italic">
              &ldquo;{c.razonNoPago}&rdquo;
            </p>
          )}
          {c.montoRecibidoHoy != null && (
            <p className="text-[12px] text-[#2d6a4f] font-medium mt-1">
              Recibido: {fmtMoney(c.montoRecibidoHoy)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {puedeRegistrarCorriente && (
            <button
              type="button"
              onClick={onCobrar}
              className="btn-primary py-3 px-4 text-[13px] min-w-[80px]"
            >
              {c.estadoHoy === 'SIN_REGISTRO' ? 'Cobrar' : 'Modificar'}
            </button>
          )}
          {puedePagarAdeudo && (
            <button
              type="button"
              onClick={onPagarAdeudo}
              className="py-2.5 px-4 rounded-lg border-2 border-[#d97706] bg-[#d97706] text-white text-[13px] font-semibold hover:bg-[#b45309] min-w-[80px]"
            >
              Pagar adeudo
            </button>
          )}
          {puedeAbonarFuturo && (
            <button
              type="button"
              onClick={onPagarAdeudo}
              className="py-2.5 px-4 rounded-lg border-2 border-blue-600 text-blue-700 text-[13px] font-semibold hover:bg-blue-50 min-w-[80px]"
            >
              Adelantar pagos
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ClienteRow({
  cliente: c,
  puedeRegistrar,
  onCobrar,
  onPagarAdeudo,
  esFechaHistorica,
}: {
  cliente: ClienteRuta
  puedeRegistrar: boolean
  onCobrar: () => void
  onPagarAdeudo: () => void
  esFechaHistorica: boolean
}) {
  const puedePagarAdeudo = c.tieneAdeudoPendiente && !esFechaHistorica
  const puedeAbonarFuturo = !c.tieneAdeudoPendiente
    && !esFechaHistorica
    && (c.estadoHoy === 'PAGADO' || c.estadoHoy === 'INHABIL' || c.estadoHoy === 'INHABILL')
  const puedeRegistrarCorriente = puedeRegistrar

  return (
    <tr>
      <td>
        <span className="font-medium text-[#212529]">{c.nombreCompleto}</span>
        <br />
        <span className="text-[11px] text-[#adb5bd]">{c.celular}</span>
      </td>
      <td className="text-[#6c757d]">{c.negocioNombre ?? '—'}</td>
      <td className="text-right font-semibold">{fmtMoney(c.pagoPeriodico)}</td>
      <td>
        <TipoPagoBadge tipo={c.tipoPago as TipoPago} size="sm" />
      </td>
      <td className="text-right">
        <MultaBadge monto={c.multasPendientes} />
      </td>
      <td className="text-[#6c757d]">
        {c.numeroPagoHoy ? `#${c.numeroPagoHoy}/${c.totalPagos}` : '—'}
      </td>
      <td>
        <EstadoCobroBadge estado={c.estadoHoy} size="sm" />
      </td>
      <td className="text-[12px] text-[#dc2626] italic max-w-[160px] truncate">
        {c.razonNoPago ?? ''}
      </td>
      <td>
        <div className="flex gap-2">
          {puedeRegistrarCorriente && (
            <button type="button" onClick={onCobrar} className="btn btn-sm">
              {c.estadoHoy === 'SIN_REGISTRO' ? 'Cobrar' : 'Modificar'}
            </button>
          )}
          {puedePagarAdeudo && (
            <button
              type="button"
              onClick={onPagarAdeudo}
              className="btn btn-sm border-[#d97706] text-[#d97706] hover:bg-[#fef3c7]"
            >
              Pagar adeudo
            </button>
          )}
          {puedeAbonarFuturo && (
            <button
              type="button"
              onClick={onPagarAdeudo}
              className="btn btn-sm border-blue-600 text-blue-700 hover:bg-blue-50"
            >
              Adelantar pagos
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
