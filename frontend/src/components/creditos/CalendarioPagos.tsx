import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { AbonoCorrienteDTO, CalendarioPagoDetalle, MultaCobroDTO, PagoCobroDTO } from '@/types'
import {
  construirFilasCalendario,
  resumirFilas,
  type FilaCalendario,
} from '@/utils/calendarioPagos'

function fmtMoney(v?: number | null): string {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function toLocalDateInput(v: string): string {
  const value = v.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
}

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  return new Date(toLocalDateInput(v)).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtDateTime(iso: string | null | undefined): string {
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

const LEYENDA = [
  { label: 'Pagado', bg: '#dcfce7', text: '#15803d' },
  { label: 'Abono cubrió atraso', bg: '#dbeafe', text: '#1d4ed8' },
  { label: 'Pago parcial', bg: '#fef3c7', text: '#92400e' },
  { label: 'Atrasado / no pagó', bg: '#fee2e2', text: '#b91c1c' },
  { label: 'Cubierto por renovación', bg: '#ede9fe', text: '#6d28d9' },
  { label: 'Pendiente (futuro)', bg: '#f1f5f9', text: '#475569' },
]

function estiloClasificacion(fila: FilaCalendario): { bg: string; text: string; label: string } {
  switch (fila.clasificacion) {
    case 'LIMPIO':
      return { bg: '#dcfce7', text: '#15803d', label: fila.estadoOriginal === 'ADELANTADO' ? 'Adelantado' : 'Pagado' }
    case 'ABONO':
      return {
        bg: '#dbeafe',
        text: '#1d4ed8',
        label: fila.estadoOriginal === 'RECUPERADO_PARCIAL' ? 'Abono parcial' : 'Abono',
      }
    case 'PARCIAL_DIRECTO':
      return { bg: '#fef3c7', text: '#92400e', label: 'Pago parcial' }
    case 'NO_PAGO':
      return { bg: '#fee2e2', text: '#b91c1c', label: 'No pagó' }
    case 'VENCIDO':
      return { bg: '#fee2e2', text: '#b91c1c', label: 'Vencido' }
    case 'RENOVACION':
      return { bg: '#ede9fe', text: '#6d28d9', label: 'Saldado por renovación' }
    case 'PENDIENTE':
    default:
      return { bg: '#f1f5f9', text: '#475569', label: 'Pendiente' }
  }
}

/** Nota corta de una línea — solo cuando aporta algo que el badge no dice ya. */
function notaFila(fila: FilaCalendario): string | null {
  if (fila.clasificacion === 'PARCIAL_DIRECTO') {
    return `Recibido ${fmtMoney(fila.montoRecibido)} de ${fmtMoney(fila.montoEsperado)}`
  }
  if (fila.clasificacion === 'ABONO' && fila.abono) {
    return `Cubierto con abono #${fila.abono.abonoId}`
  }
  if (fila.pagoRegistrado?.razonNoPago) {
    return fila.pagoRegistrado.razonNoPago
  }
  return null
}

interface FilaMultaInfo {
  pendiente: boolean
  monto: number
  condonada: boolean
}

function multaDelDia(fecha: string, multas: MultaCobroDTO[]): FilaMultaInfo | null {
  const delDia = multas.filter((m) => m.fecha?.slice(0, 10) === fecha)
  if (delDia.length === 0) return null
  const monto = delDia.reduce((sum, m) => sum + Number(m.monto ?? 0), 0)
  const pendiente = delDia.some((m) => !m.cobrada && !m.condonada)
  const condonada = delDia.every((m) => m.condonada)
  return { pendiente, monto, condonada }
}

function FilaRow({
  fila,
  multaInfo,
  esAdminSupervisor,
  onVerPago,
  onModificarPago,
  onVerAbono,
  onPagarMulta,
}: {
  fila: FilaCalendario
  multaInfo: FilaMultaInfo | null
  esAdminSupervisor: boolean
  onVerPago: (pago: PagoCobroDTO) => void
  onModificarPago: (pago: PagoCobroDTO) => void
  onVerAbono: (abono: AbonoCorrienteDTO) => void
  onPagarMulta?: () => void
}) {
  const estilo = estiloClasificacion(fila)
  const nota = notaFila(fila)
  const esPendiente = fila.clasificacion === 'PENDIENTE'
  const fechaHoraRegistro = fila.pagoRegistrado?.createdAt ?? fila.abono?.createdAt

  return (
    <div className="grid grid-cols-[2.5rem_5.5rem_1fr] sm:grid-cols-[3rem_6rem_5rem_1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 border-b border-[#f1f3f5] last:border-0">
      <span className="text-[12px] font-semibold text-[#adb5bd] tabular-nums">#{fila.numeroPago}</span>
      <span className="text-[12px] text-[#495057]">{fmtDate(fila.fechaProgramada)}</span>
      <span className="hidden sm:block text-[13px] font-mono text-[#212529] text-right sm:text-left">
        {esPendiente ? fmtMoney(fila.montoEsperado) : fmtMoney(fila.montoRecibido ?? fila.montoEsperado)}
      </span>

      <div className="col-span-3 sm:col-span-1 flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: estilo.bg, color: estilo.text }}
        >
          {estilo.label}
        </span>
        <span className="sm:hidden text-[12px] font-mono text-[#212529]">
          {esPendiente ? fmtMoney(fila.montoEsperado) : fmtMoney(fila.montoRecibido ?? fila.montoEsperado)}
        </span>
        {multaInfo && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={
              multaInfo.condonada
                ? { background: '#f3e8ff', color: '#7e22ce' }
                : multaInfo.pendiente
                  ? { background: '#fef3c7', color: '#92400e' }
                  : { background: '#f1f5f9', color: '#64748b' }
            }
          >
            <AlertTriangle className="w-3 h-3" />
            {multaInfo.condonada ? 'Multa condonada' : 'Multa'} {fmtMoney(multaInfo.monto)}
          </span>
        )}
        {nota && <span className="text-[11px] text-gray-500">{nota}</span>}
        {fechaHoraRegistro && (
          <span className="text-[10px] text-gray-400">· {fmtDateTime(fechaHoraRegistro)}</span>
        )}
      </div>

      <div className="col-span-3 sm:col-span-1 flex flex-wrap gap-1.5 sm:justify-end">
        {fila.pagoRegistrado && (
          <button type="button" className="btn btn-sm text-xs py-0.5 px-2" onClick={() => onVerPago(fila.pagoRegistrado!)}>
            Ver pago
          </button>
        )}
        {fila.pagoRegistrado && esAdminSupervisor && (
          <button
            type="button"
            className="btn btn-sm text-xs py-0.5 px-2"
            onClick={() => onModificarPago(fila.pagoRegistrado!)}
          >
            Modificar
          </button>
        )}
        {fila.abono && (
          <button
            type="button"
            className="btn btn-sm text-xs py-0.5 px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={() => onVerAbono(fila.abono!)}
          >
            Ver abono
          </button>
        )}
        {multaInfo?.pendiente && onPagarMulta && (
          <button
            type="button"
            className="btn btn-sm text-xs py-0.5 px-2 text-[#dc2626] border-[#fecaca] hover:bg-red-50"
            onClick={onPagarMulta}
          >
            Cubrir multa
          </button>
        )}
      </div>
    </div>
  )
}

export interface CalendarioPagosProps {
  calendario: CalendarioPagoDetalle[]
  pagosHistorial: PagoCobroDTO[]
  abonosCredito: AbonoCorrienteDTO[]
  multas: MultaCobroDTO[]
  hoyIso: string
  liquidadoPorRenovacion: boolean
  esAdminSupervisor: boolean
  onVerPago: (pago: PagoCobroDTO) => void
  onModificarPago: (pago: PagoCobroDTO) => void
  onVerAbono: (abono: AbonoCorrienteDTO) => void
  onPagarMulta?: () => void
}

export default function CalendarioPagos({
  calendario,
  pagosHistorial,
  abonosCredito,
  multas,
  hoyIso,
  liquidadoPorRenovacion,
  esAdminSupervisor,
  onVerPago,
  onModificarPago,
  onVerAbono,
  onPagarMulta,
}: CalendarioPagosProps) {
  const filas = useMemo(
    () =>
      construirFilasCalendario({
        calendario,
        pagosHistorial,
        abonosCredito,
        multas,
        hoyIso,
        liquidadoPorRenovacion,
      }),
    [calendario, pagosHistorial, abonosCredito, multas, hoyIso, liquidadoPorRenovacion],
  )
  const resumen = useMemo(() => resumirFilas(filas), [filas])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LEYENDA.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: chip.bg, color: chip.text }}
          >
            {chip.label}
          </span>
        ))}
      </div>

      {/* Tabla / lista — una fila por día, como el control de pagos en papel */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="hidden sm:grid grid-cols-[3rem_6rem_5rem_1fr_auto] gap-x-3 px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f8fafc] border-b border-[#e2e8f0]">
          <div>No.</div>
          <div>Fecha</div>
          <div>Monto</div>
          <div>Estado</div>
          <div className="text-right">Acciones</div>
        </div>
        {filas.map((fila) => (
          <FilaRow
            key={fila.id}
            fila={fila}
            multaInfo={multaDelDia(fila.fechaProgramada, multas)}
            esAdminSupervisor={esAdminSupervisor}
            onVerPago={onVerPago}
            onModificarPago={onModificarPago}
            onVerAbono={onVerAbono}
            onPagarMulta={onPagarMulta}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#16a34a]">{resumen.pagadosCount}</div>
          <div className="text-[11px] text-gray-500">Pagados</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-amber-600">{resumen.parcialesCount}</div>
          <div className="text-[11px] text-gray-500">Parciales</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${resumen.noPagaronCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
            {resumen.noPagaronCount}
          </div>
          <div className="text-[11px] text-gray-500">No pagaron</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${resumen.vencidosCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
            {resumen.vencidosCount}
          </div>
          <div className="text-[11px] text-gray-500">Vencidos</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#212529]">{resumen.pendientesCount}</div>
          <div className="text-[11px] text-gray-500">Pendientes</div>
        </div>
        {resumen.multasCondonadasMonto > 0 && (
          <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-purple-700">{fmtMoney(resumen.multasCondonadasMonto)}</div>
            <div className="text-[11px] text-gray-500">Multas condonadas</div>
          </div>
        )}
      </div>
    </div>
  )
}
