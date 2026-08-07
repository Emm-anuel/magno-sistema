import { useMemo, useState } from 'react'
import type { AbonoCorrienteDTO, CalendarioPagoDetalle, MultaCobroDTO, PagoCobroDTO } from '@/types'
import {
  agruparFilas,
  construirFilasCalendario,
  resumirFilas,
  type FilaCalendario,
  type GrupoFilas,
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

const LEYENDA = [
  { label: 'Pagado', bg: '#dcfce7', text: '#15803d' },
  { label: 'Abono cubrió atraso', bg: '#dbeafe', text: '#1d4ed8' },
  { label: 'Pago parcial', bg: '#fef3c7', text: '#92400e' },
  { label: 'Atrasado / no pagó', bg: '#fee2e2', text: '#b91c1c' },
  { label: 'Multa condonada', bg: '#f3e8ff', text: '#7e22ce' },
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

function explicacionFila(fila: FilaCalendario): string | null {
  if (fila.clasificacion === 'LIMPIO' || fila.clasificacion === 'PENDIENTE') return null

  if (fila.clasificacion === 'VENCIDO') {
    return 'No se ha registrado el cobro de este día.'
  }

  if (fila.clasificacion === 'NO_PAGO') {
    let texto = 'El cliente no pagó este día.'
    if (fila.multa?.condonada) {
      texto += ` La multa de ${fmtMoney(fila.multa.monto)} fue condonada por ${fila.multa.condonadaPorNombre ?? 'un supervisor'}${
        fila.multa.fechaCondonacion ? ` el ${fmtDate(fila.multa.fechaCondonacion)}` : ''
      }${fila.multa.motivoCondonacion ? ` — "${fila.multa.motivoCondonacion}"` : ''}.`
    } else if (fila.multa && !fila.multa.cubiertaConAbono) {
      texto += ` Tiene una multa pendiente de ${fmtMoney(fila.multa.monto)}.`
    }
    return texto
  }

  if (fila.clasificacion === 'PARCIAL_DIRECTO') {
    return `Pagó ${fmtMoney(fila.montoRecibido)} de ${fmtMoney(fila.montoEsperado)} esperados ese día.`
  }

  if (fila.clasificacion === 'ABONO') {
    const cobertura = fila.abono?.coberturas.find((c) => c.numeroPago === fila.numeroPago) ?? null
    const partes = [`cuota ${fmtMoney(cobertura?.montoCuota ?? fila.montoEsperado)}`]
    if (cobertura && Number(cobertura.montoMulta) > 0) partes.push(`multa ${fmtMoney(cobertura.montoMulta)}`)
    return `Abono #${fila.abono?.abonoId ?? ''}: cubrió ${partes.join(' + ')} = ${fmtMoney(fila.montoRecibido)}.`
  }

  if (fila.clasificacion === 'RENOVACION') {
    let texto = 'Este pago no fue cobrado día a día: se saldó al aprobar una renovación de este crédito.'
    if (fila.multa?.condonada) {
      texto += ` La multa de ${fmtMoney(fila.multa.monto)} también fue condonada.`
    } else if (fila.multa) {
      texto += ` Incluye una multa de ${fmtMoney(fila.multa.monto)} descontada del desembolso.`
    }
    return texto
  }

  return null
}

function FilaRow({
  fila,
  esAdminSupervisor,
  onVerPago,
  onModificarPago,
  onVerAbono,
}: {
  fila: FilaCalendario
  esAdminSupervisor: boolean
  onVerPago: (pago: PagoCobroDTO) => void
  onModificarPago: (pago: PagoCobroDTO) => void
  onVerAbono: (abono: AbonoCorrienteDTO) => void
}) {
  const base = estiloClasificacion(fila)
  const estilo = fila.multa?.condonada ? { bg: '#f3e8ff', text: '#7e22ce', label: `${base.label} — multa condonada` } : base
  const explicacion = explicacionFila(fila)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2.5 px-3 bg-white border border-[#e5e7eb] rounded-md shadow-sm hover:border-[#cbd5e1] hover:bg-[#fcfcfd] transition-colors">
      <div className="sm:w-32 shrink-0 text-sm">
        <div className="font-medium text-[#212529]">{fmtDate(fila.fechaProgramada)}</div>
        <div className="text-[11px] text-gray-400">pago #{fila.numeroPago}</div>
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: estilo.bg, color: estilo.text }}
        >
          {estilo.label}
        </span>
        {explicacion && <p className="text-[12px] text-gray-600 mt-1 leading-relaxed max-w-xl">{explicacion}</p>}
      </div>
      <div className="sm:w-28 shrink-0 text-sm font-mono sm:text-right">
        {fila.montoRecibido != null ? fmtMoney(fila.montoRecibido) : <span className="text-gray-400">—</span>}
      </div>
      <div className="sm:w-44 shrink-0 flex flex-wrap sm:justify-end gap-1.5 sm:pl-3 sm:border-l sm:border-[#e5e7eb]">
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
      </div>
    </div>
  )
}

function GrupoRow({ grupo, abierto, onToggle }: { grupo: GrupoFilas; abierto: boolean; onToggle: () => void }) {
  const label = grupo.clasificacion === 'RENOVACION' ? 'saldados por renovación' : 'pagos a tiempo'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={abierto}
      className="w-full flex items-center gap-2 py-2.5 px-3 text-left text-[13px] text-gray-500 italic bg-white hover:bg-[#f8f9fa] border border-[#e5e7eb] rounded-md shadow-sm transition-colors"
    >
      <span className="text-gray-400 not-italic">{abierto ? '▾' : '▸'}</span>
      <span>
        ✓ {grupo.filas.length} {label} · {fmtDate(grupo.fechaInicio)}–{fmtDate(grupo.fechaFin)} · {fmtMoney(grupo.montoTotal)}
      </span>
    </button>
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
}: CalendarioPagosProps) {
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())

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
  const filasOGrupos = useMemo(() => agruparFilas(filas), [filas])
  const resumen = useMemo(() => resumirFilas(filas), [filas])

  function claveGrupo(grupo: GrupoFilas): string {
    return `${grupo.clasificacion}-${grupo.fechaInicio}-${grupo.fechaFin}`
  }

  function toggleGrupo(clave: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(clave)) next.delete(clave)
      else next.add(clave)
      return next
    })
  }

  let mostroDivisorPendientes = false

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

      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2 space-y-2">
        {filasOGrupos.map((item) => {
          const primeraFila = item.tipo === 'fila' ? item.fila : item.filas[0]
          const esPrimerPendiente = !mostroDivisorPendientes && primeraFila.clasificacion === 'PENDIENTE'
          if (esPrimerPendiente) mostroDivisorPendientes = true

          const key = item.tipo === 'fila' ? `fila-${item.fila.id}` : `grupo-${claveGrupo(item)}`

          return (
            <div key={key} className="space-y-2">
              {esPrimerPendiente && (
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-[#dbe2ea]">
                  Próximos pagos
                </div>
              )}
              {item.tipo === 'grupo' ? (
                <>
                  <GrupoRow
                    grupo={item}
                    abierto={gruposAbiertos.has(claveGrupo(item))}
                    onToggle={() => toggleGrupo(claveGrupo(item))}
                  />
                  {gruposAbiertos.has(claveGrupo(item)) && (
                    <div className="space-y-2 pl-2 sm:pl-4 border-l-2 border-[#dbe2ea]">
                      {item.filas.map((fila) => (
                        <FilaRow
                          key={fila.id}
                          fila={fila}
                          esAdminSupervisor={esAdminSupervisor}
                          onVerPago={onVerPago}
                          onModificarPago={onModificarPago}
                          onVerAbono={onVerAbono}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <FilaRow
                  fila={item.fila}
                  esAdminSupervisor={esAdminSupervisor}
                  onVerPago={onVerPago}
                  onModificarPago={onModificarPago}
                  onVerAbono={onVerAbono}
                />
              )}
            </div>
          )
        })}
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
