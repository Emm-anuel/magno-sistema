import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Download,
  ArrowLeft,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService, type CajaDiaDetalle } from '@/services/cajaService'

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

// ── Collapsible section (mobile-first) ────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
  highlight = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  highlight?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={`card ${highlight ? 'border-[#16a34a] border-2' : ''}`}
    >
      <button
        type="button"
        className="card-header w-full text-left flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <h2 className={`card-title ${highlight ? 'text-[#15803d]' : ''}`}>{title}</h2>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#6c757d] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6c757d] shrink-0" />
        )}
      </button>
      {open && <div className="card-body">{children}</div>}
    </div>
  )
}

// ── Confirmation modal ─────────────────────────────────────────────────

function ConfirmModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-[#dc2626] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-[16px] font-semibold text-[#212529]">Confirmar cierre de caja</h2>
            <p className="text-[13px] text-[#6c757d] mt-1">
              ¿Confirmas el cierre de caja? Esta acción es irreversible.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="btn btn-sm"
            onClick={onCancel}
            disabled={isPending}
          >
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Cerrando…' : 'Sí, cerrar caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Post-cierre: success view ──────────────────────────────────────────

function CajaCerradaView({
  caja,
  onExportPdf,
  exporting,
}: {
  caja: CajaDiaDetalle
  onExportPdf: () => void
  exporting: boolean
}) {
  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#15803d]">Caja cerrada correctamente</p>
          <p className="text-[11px] text-[#166534]">
            {caja.sucursalNombre} · {caja.fecha}
            {caja.cerradaPorNombre ? ` · Cerrada por ${caja.cerradaPorNombre}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary flex items-center gap-1.5"
          onClick={onExportPdf}
          disabled={exporting}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>

      {/* Summary cards */}
      <Section title="Resumen final" highlight defaultOpen>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryItem label="Apertura" value={fmtMoney(caja.montoApertura)} />
          <SummaryItem label="Ingreso carteras" value={fmtMoney(caja.ingresoCarteras)} />
          <SummaryItem label="Desembolsos" value={fmtMoney(caja.desembolsos)} />
          <SummaryItem label="Subtotal caja" value={fmtMoney(caja.subtotalCaja)} bold />
          <SummaryItem label="Monto Libres" value={fmtMoney(caja.montoLibres)} />
          <SummaryItem label="Total" value={fmtMoney(caja.total)} bold />
          <SummaryItem label="Ahorro fijo" value={fmtMoney(caja.ahorroFijo)} />
          {(caja.totalGastos ?? 0) > 0 && (
            <SummaryItem label="Gastos operativos" value={fmtMoney(caja.totalGastos)} />
          )}
          {(caja.totalNomina ?? 0) > 0 && (
            <SummaryItem label="Nómina" value={fmtMoney(caja.totalNomina)} />
          )}
          <SummaryItem label="Total Real Libres" value={fmtMoney(caja.totalRealLibres)} bold />
        </dl>
      </Section>
    </div>
  )
}

function SummaryItem({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="bg-[#f8f9fa] rounded-lg px-3 py-2">
      <dt className="text-[11px] text-[#6c757d]">{label}</dt>
      <dd className={`text-[14px] font-mono ${bold ? 'font-semibold text-[#212529]' : ''}`}>{value}</dd>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────

export default function CajaCierrePage() {
  const { usuario } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const sucursalId: number | undefined = isAdmin ? undefined : usuario?.sucursal?.id

  const [showConfirm, setShowConfirm] = useState(false)
  const [closedCaja, setClosedCaja] = useState<CajaDiaDetalle | null>(null)
  const [exporting, setExporting] = useState(false)

  // Fetch preview cierre data
  const { data: preview, isLoading, isError } = useQuery({
    queryKey: ['caja-cierre-preview', sucursalId],
    queryFn: () => cajaService.getPreviewCierre(sucursalId),
    enabled: closedCaja === null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  // Cierre mutation
  const cerrarMut = useMutation({
    mutationFn: () => cajaService.cerrar(sucursalId ? { sucursalId } : undefined),
    onSuccess: (data) => {
      setShowConfirm(false)
      setClosedCaja(data)
      queryClient.invalidateQueries({ queryKey: ['caja-estado'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado-operativa'] })
      toast.success('Caja cerrada correctamente')
    },
    onError: (err: any) => {
      setShowConfirm(false)
      toast.error(err.message ?? 'Error al cerrar la caja')
    },
  })

  async function handleExportPdf() {
    if (!closedCaja) return
    setExporting(true)
    try {
      await cajaService.exportarPdf(closedCaja.id, closedCaja.fecha)
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  // ── If just closed → show success view ──
  if (closedCaja) {
    return (
      <CajaCerradaView
        caja={closedCaja}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />
    )
  }

  return (
    <div className="space-y-5 pb-10">

      {/* Confirm modal */}
      {showConfirm && (
        <ConfirmModal
          onConfirm={() => cerrarMut.mutate()}
          onCancel={() => setShowConfirm(false)}
          isPending={cerrarMut.isPending}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-[12px] text-[#6c757d] hover:text-[#495057] mb-1"
            onClick={() => navigate('/caja')}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Caja
          </button>
          <h1 className="text-[22px] font-semibold text-[#212529]">Resumen de Cierre</h1>
          <p className="text-[13px] text-[#6c757d] mt-0.5">
            Revisa el resumen del día antes de confirmar el cierre
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger flex items-center gap-1.5"
          onClick={() => setShowConfirm(true)}
          disabled={isLoading || isError}
        >
          Cerrar Caja
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-[13px] text-[#6c757d]">Cargando resumen del día…</p>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="alert alert-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No hay una caja abierta para cerrar o no tienes permisos.
        </div>
      )}

      {/* Sections */}
      {preview && (
        <>
          {/* ── Ingresos de carteras ─────────────────────────────────── */}
          <Section title="Ingresos de Carteras" defaultOpen>
            {preview.cobrosPorAsesor.length === 0 ? (
              <p className="text-[13px] text-[#adb5bd] text-center py-3">Sin cobros registrados hoy</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="!text-center">Asesor</th>
                      <th className="!text-center">Cobros</th>
                      <th className="!text-center">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cobrosPorAsesor.map(row => (
                      <tr key={row.asesorNombre}>
                        <td className="text-center">{row.asesorNombre}</td>
                        <td className="text-center">{row.cantidadCobros}</td>
                        <td className="text-center font-mono">{fmtMoney(row.montoCobrado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 text-right text-[13px]">
              <span className="text-[#6c757d]">Total ingresos: </span>
              <span className="font-semibold font-mono">{fmtMoney(preview.totalIngresoCarteras)}</span>
            </div>
          </Section>

          {/* ── Desembolsos ──────────────────────────────────────────── */}
          <Section title="Desembolsos" defaultOpen>
            <dl className="space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <dt className="text-[#6c757d]">Créditos nuevos</dt>
                <dd className="font-mono">{fmtMoney(preview.desembolsosCreditosNuevos)}</dd>
              </div>
              <div className="flex justify-between text-[13px]">
                <dt className="text-[#6c757d]">Renovaciones</dt>
                <dd className="font-mono">{fmtMoney(preview.desembolsosRenovaciones)}</dd>
              </div>
              <div className="flex justify-between text-[13px] pt-1 border-t border-[#dee2e6]">
                <dt className="font-semibold">Total desembolsos</dt>
                <dd className="font-semibold font-mono">{fmtMoney(preview.totalDesembolsos)}</dd>
              </div>
            </dl>
          </Section>

          {/* ── Subtotal Caja ────────────────────────────────────────── */}
          <Section title="Subtotal Caja" defaultOpen highlight>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6c757d]">Apertura</span>
                <span className="font-mono">{fmtMoney(preview.montoApertura)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6c757d]">+ Ingresos carteras</span>
                <span className="font-mono">{fmtMoney(preview.totalIngresoCarteras)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6c757d]">− Desembolsos</span>
                <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalDesembolsos)}</span>
              </div>
              {preview.subtotalInversiones !== 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6c757d]">
                    {preview.subtotalInversiones >= 0 ? '+' : '−'} Inversiones
                  </span>
                  <span className={`font-mono ${preview.subtotalInversiones < 0 ? 'text-[#dc2626]' : ''}`}>
                    {fmtMoney(preview.subtotalInversiones)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#dee2e6]">
                <span className="text-[16px] font-bold text-[#15803d]">= Subtotal Caja</span>
                <span className="text-[16px] font-bold font-mono text-[#15803d]">
                  {fmtMoney(preview.subtotalCaja)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#dee2e6]">
                <span className="text-[16px] font-bold text-[#0d6efd]">= Total</span>
                <span className="text-[16px] font-bold font-mono text-[#0d6efd]">
                  {fmtMoney(preview.total)}
                </span>
              </div>
            </div>
          </Section>

          {/* ── Libres ───────────────────────────────────────────────── */}
          <Section title="Libres" defaultOpen>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6c757d]">
                  Monto Libres ({fmtPct(preview.porcentajeAhorro)} × ingresos)
                </span>
                <span className="font-mono">{fmtMoney(preview.montoLibres)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6c757d]">− Ahorro fijo</span>
                <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.ahorroFijo)}</span>
              </div>
              {preview.totalGastos > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6c757d]">− Gastos operativos</span>
                  <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalGastos)}</span>
                </div>
              )}
              {preview.totalNomina > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6c757d]">− Nómina</span>
                  <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalNomina)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-[#dee2e6]">
                <span className="font-semibold">Total Real Libres</span>
                <span className="font-semibold font-mono">{fmtMoney(preview.totalRealLibres)}</span>
              </div>
            </div>
          </Section>

          {/* ── Multas ───────────────────────────────────────────────── */}
          <Section title="Multas Cobradas" defaultOpen={(preview.totalMultasCobradas ?? 0) > 0 || (preview.totalMultasCondonadas ?? 0) > 0}>
            {/* Multas daily by asesor */}
            {preview.multasPorAsesor.length === 0 && (preview.multasCobrasRenovaciones ?? 0) === 0 ? (
              <p className="text-[13px] text-[#adb5bd] text-center py-3">Sin multas cobradas hoy</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.multasPorAsesor.map(row => (
                      <tr key={row.asesorNombre}>
                        <td className="text-[13px]">Cobros diarios — {row.asesorNombre}</td>
                        <td className="text-right font-mono">{fmtMoney(row.totalMultas)}</td>
                      </tr>
                    ))}
                    {(preview.multasCobrasRenovaciones ?? 0) > 0 && (
                      <tr>
                        <td className="text-[13px]">Cobradas en renovaciones</td>
                        <td className="text-right font-mono">{fmtMoney(preview.multasCobrasRenovaciones)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total cobrado */}
            {(preview.totalMultasCobradas + (preview.multasCobrasRenovaciones ?? 0)) > 0 && (
              <div className="mt-2 text-right text-[13px]">
                <span className="text-[#6c757d]">Total cobrado: </span>
                <span className="font-semibold font-mono">
                  {fmtMoney(preview.totalMultasCobradas + (preview.multasCobrasRenovaciones ?? 0))}
                </span>
              </div>
            )}

            {/* Condonadas — informational, not in subtotal */}
            {(preview.totalMultasCondonadas ?? 0) > 0 && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex items-center justify-between text-[13px]">
                <span className="text-red-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  Condonadas en renovaciones <span className="text-gray-400 font-normal ml-1">(informativo)</span>
                </span>
                <span className="font-semibold font-mono text-red-500">
                  −{fmtMoney(preview.totalMultasCondonadas)}
                </span>
              </div>
            )}
          </Section>

          {/* ── Pagos sin registro ──────────────────────────────────── */}
          {preview.clientesSinRegistro.length > 0 && (
            <Section
              title={`Pagos sin registro (${preview.clientesSinRegistro.length})`}
              defaultOpen
            >
              <p className="text-[13px] text-[#92400e] bg-[#fef3c7] rounded-lg px-3 py-2 mb-3">
                Estos clientes no tienen un cobro registrado hoy. Al cerrar la caja se
                marcarán automáticamente como &ldquo;no pagó&rdquo; y se les generará la
                multa correspondiente.
              </p>
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="text-right">Multa a generar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.clientesSinRegistro.map(row => (
                      <tr key={row.creditoId}>
                        <td className="text-[13px]">{row.nombreCompleto}</td>
                        <td className="text-right font-mono">{fmtMoney(row.montoMulta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-right text-[13px]">
                <span className="text-[#6c757d]">Total multas nuevas: </span>
                <span className="font-semibold font-mono">
                  {fmtMoney(preview.clientesSinRegistro.reduce((sum, r) => sum + r.montoMulta, 0))}
                </span>
              </div>
            </Section>
          )}

          {/* ── Action bar ───────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn btn-danger px-6"
              onClick={() => setShowConfirm(true)}
            >
              Cerrar Caja
            </button>
          </div>
        </>
      )}
    </div>
  )
}
