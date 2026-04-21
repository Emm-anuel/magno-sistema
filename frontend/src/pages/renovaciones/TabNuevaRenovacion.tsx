import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Search,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  Clock,
} from 'lucide-react'
import { clienteService } from '@/services/api'
import { renovacionService } from '@/services/renovacionService'
import { creditoService } from '@/services/creditoService'
import MultiFileUpload from '@/components/MultiFileUpload'
import ProcessingOverlay from '@/components/ProcessingOverlay'
import type { ClienteResumen, RenovacionCalculo, CreditoDetalle, ListoRenovarItem } from '@/types'

type Step = 1 | 2

function Stepper({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Datos de la renovación' },
    { n: 2 as Step, label: 'Confirmación' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={[
            'flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-colors',
            current === s.n ? 'bg-[#3d6b35] text-white'
              : current > s.n ? 'bg-green-200 text-green-800'
              : 'bg-gray-200 text-gray-500',
          ].join(' ')}>
            {current > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
          </div>
          <span className={`text-sm hidden sm:inline ${current === s.n ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

interface Props {
  initialCliente?: ClienteResumen | null
  onClearInitial?: () => void
}

export default function TabNuevaRenovacion({ initialCliente, onClearInitial }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(1)

  // Client search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<ClienteResumen[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteResumen | null>(null)
  const [creditoActivo, setCreditoActivo] = useState<CreditoDetalle | null>(null)
  const [creditoLoading, setCreditoLoading] = useState(false)

  // Form state
  const [montoStr, setMontoStr] = useState('')
  const [tipoPago, setTipoPago] = useState<'DIARIO' | 'SEMANAL'>('DIARIO')
  const [garantiaDescripcion, setGarantiaDescripcion] = useState('')
  const [evidenciaUrls, setEvidenciaUrls] = useState<string[]>([])
  const [videoEntregaUrl, setVideoEntregaUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Calculation
  const [calculo, setCalculo] = useState<RenovacionCalculo | null>(null)
  const [calculoLoading, setCalculoLoading] = useState(false)
  const calcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Client search ──────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await clienteService.listar({ buscar: searchQuery, size: 8 })
        setSearchResults(res.content)
        setSearchOpen(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSelectCliente(c: ClienteResumen) {
    setClienteSeleccionado(c)
    setSearchQuery('')
    setSearchOpen(false)
    setCreditoActivo(null)
    setCalculo(null)
    setMontoStr('')

    if (!c.tiene_credito_activo) return

    setCreditoLoading(true)
    try {
      const creditos = await creditoService.getCreditosCliente(c.id)
      const activo = creditos.find((cr) => cr.estado === 'ACTIVO')
      if (activo) {
        const detalle = await creditoService.obtener(activo.id)
        setCreditoActivo(detalle)
      }
    } catch {
      toast.error('Error al cargar el crédito activo')
    } finally {
      setCreditoLoading(false)
    }
  }

  useEffect(() => {
    if (initialCliente && !clienteSeleccionado) {
      handleSelectCliente(initialCliente)
      onClearInitial?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCliente])

  // ── Monto / calculo ────────────────────────────────────────────

  function handleMontoChange(val: string) {
    const clean = val.replace(/[^0-9.]/g, '')
    setMontoStr(clean)
    setCalculo(null)

    if (calcDebounceRef.current) clearTimeout(calcDebounceRef.current)
    if (!creditoActivo) return

    const num = parseFloat(clean)
    if (!clean || isNaN(num) || num < 1000 || num > 50000) {
      setCalculoLoading(false)
      return
    }

    setCalculoLoading(true)
    calcDebounceRef.current = setTimeout(async () => {
      try {
        const result = await renovacionService.calcular(creditoActivo.id, num)
        setCalculo(result)
      } catch (err: any) {
        toast.error(err?.message ?? 'Error al calcular')
        setCalculo(null)
      } finally {
        setCalculoLoading(false)
      }
    }, 500)
  }

  // ── Validation ─────────────────────────────────────────────────

  const monto = parseFloat(montoStr)
  const montoValido = !isNaN(monto) && monto >= 1000 && monto <= 50000
  const elegible = creditoActivo?.estadisticas?.elegibleRenovacion === true
  const canContinue =
    clienteSeleccionado != null &&
    creditoActivo != null &&
    elegible &&
    montoValido &&
    calculo != null

  // ── Submit ─────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: () =>
      renovacionService.crear({
        creditoAnteriorId: creditoActivo!.id,
        montoNuevo: monto,
        tipoPago,
        garantiaDescripcion: garantiaDescripcion.trim() || undefined,
        evidenciaUrls,
        videoEntregaUrl: videoEntregaUrl.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Solicitud enviada — pendiente de aprobación del gerente')
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      queryClient.setQueriesData<ListoRenovarItem[]>({ queryKey: ['listos-renovar'] }, (old) => {
        if (!old) return old
        return old.filter((item) => item.creditoId !== creditoActivo?.id)
      })
      queryClient.invalidateQueries({ queryKey: ['listos-renovar'] })
      navigate('/renovaciones')
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al enviar la solicitud')
    },
  })

  // ── Step 1 ─────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="w-full">
        <Stepper current={1} />
        <div className="card p-6 space-y-6 w-full">

          {/* Buscar cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>

            {clienteSeleccionado ? (
              <div className={[
                'rounded-xl border p-3 flex items-start justify-between gap-3',
                creditoActivo && elegible ? 'border-green-300 bg-green-50'
                  : creditoActivo && !elegible ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-200 bg-gray-50',
              ].join(' ')}>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-semibold text-gray-800">{clienteSeleccionado.nombre_completo}</span>
                  </div>
                  <div className="text-sm text-gray-500 pl-5">📱 {clienteSeleccionado.celular}</div>
                  {creditoLoading && (
                    <div className="text-xs text-gray-400 pl-5">Cargando crédito activo...</div>
                  )}
                  {creditoActivo && (
                    <div className="text-xs pl-5 space-y-0.5">
                      <div className="text-gray-600">
                        Crédito activo: {fmt(creditoActivo.montoCapital)} — pago {fmt(creditoActivo.pagoPeriodico)}/día
                      </div>
                      <div className={elegible ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                        {elegible ? '✓ Elegible para renovación' : `⚠ Aún no elegible (${creditoActivo.estadisticas.pagosRealizados} pagos realizados)`}
                      </div>
                    </div>
                  )}
                  {!creditoActivo && !creditoLoading && (
                    <div className="text-xs text-red-600 pl-5">Sin crédito activo — no se puede renovar</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClienteSeleccionado(null)
                    setCreditoActivo(null)
                    setCalculo(null)
                    setMontoStr('')
                  }}
                  className="text-xs text-gray-500 underline hover:text-gray-700 flex-shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-9 w-full"
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#3d6b35] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectCliente(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-800">{c.nombre_completo}</div>
                        <div className="text-xs text-gray-500">
                          {c.celular} · {c.negocio_nombre}
                          {c.tiene_credito_activo && (
                            <span className="ml-1 text-green-600">• Crédito activo</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchOpen && searchResults.length === 0 && !searchLoading && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
                    No se encontraron clientes
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Monto nuevo */}
          {creditoActivo && elegible && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto del Crédito Nuevo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">$</span>
                <input
                  type="number"
                  min={1000}
                  max={50000}
                  step={500}
                  placeholder="Ej: 10000"
                  value={montoStr}
                  onChange={(e) => handleMontoChange(e.target.value)}
                  className="input pl-7 w-full"
                />
              </div>
              {montoStr && !montoValido && (
                <p className="text-xs text-red-500 mt-1">El monto debe estar entre $1,000 y $50,000</p>
              )}
              {/* Resumen de cálculo */}
              {calculoLoading && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 animate-pulse h-32" />
              )}
              {calculo && !calculoLoading && (
                <div className="mt-3 rounded-xl border border-[#3d6b35]/20 bg-green-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-[#3d6b35] uppercase tracking-wide">Resumen de la renovación</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {[
                      ['Crédito anterior', fmt(calculo.montoAnterior)],
                      ['Crédito nuevo', fmt(calculo.montoNuevo)],
                      ['Pagos restantes', `${calculo.pagosRestantes} × ${fmt(calculo.pagoPeriodicoAnterior)} = ${fmt(calculo.montoPagosRestantes)}`],
                      ['Multas pendientes', fmt(calculo.multasPendientes)],
                      ['Pago adelantado nuevo', fmt(calculo.pagoAdelantadoNuevo)],
                      ['Pago diario nuevo', fmt(calculo.pagoPeriodicoNuevo)],
                      ['Plazo nuevo', `${calculo.plazoDiasNuevo} días`],
                    ].map(([label, value]) => (
                      <div key={label} className="contents">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-800 text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#3d6b35]/20 pt-2 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">Monto a Entregar</span>
                    <span className={`text-lg font-bold ${calculo.montoDesembolso >= 0 ? 'text-[#3d6b35]' : 'text-red-600'}`}>
                      {fmt(calculo.montoDesembolso)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forma de pago */}
          {creditoActivo && elegible && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de Pago <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-6">
                {(['DIARIO', 'SEMANAL'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPago"
                      value={v}
                      checked={tipoPago === v}
                      onChange={() => setTipoPago(v)}
                      className="w-4 h-4 accent-[#3d6b35]"
                    />
                    <span className="text-sm">{v === 'DIARIO' ? 'Diario' : 'Semanal'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Garantía */}
          {creditoActivo && elegible && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Garantía Material{' '}
                <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={garantiaDescripcion}
                onChange={(e) => setGarantiaDescripcion(e.target.value)}
                rows={2}
                placeholder="Describe el objeto dado en garantía (solo para créditos grandes)"
                className="input w-full resize-none"
              />
            </div>
          )}

          {/* Evidencias */}
          {creditoActivo && elegible && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evidencias{' '}
                <span className="text-xs text-gray-400 font-normal">(fotos/videos del negocio, opcional)</span>
              </label>
              <MultiFileUpload
                value={evidenciaUrls}
                onChange={setEvidenciaUrls}
                folder={`renovaciones/${clienteSeleccionado?.id ?? 'cliente'}`}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                label="Arrastra fotos/videos o haz clic para seleccionar"
              />
            </div>
          )}

          {/* Continuar */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Confirmación ────────────────────────────────────────

  return (
    <div className="w-full">
      <Stepper current={2} />
      <div className="space-y-4">

        {/* Aviso: flujo de aprobación */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-0.5">La solicitud quedará en revisión</p>
            <p className="text-blue-700">
              El Gerente de Sucursal recibirá esta solicitud y la aprobará o rechazará.
              El crédito anterior permanece activo hasta que sea aprobada.
            </p>
          </div>
        </div>

        {/* Cliente y crédito anterior */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cliente</h3>
          <div className="space-y-1 text-sm">
            <div className="font-medium text-gray-800">{clienteSeleccionado?.nombre_completo}</div>
            <div className="text-gray-500">📱 {clienteSeleccionado?.celular}</div>
            <div className="text-gray-500">
              Crédito anterior: {fmt(creditoActivo?.montoCapital)} — {creditoActivo?.plazoDias} días
            </div>
          </div>
        </div>

        {/* Resumen financiero */}
        {calculo && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen financiero</h3>
            <div className="space-y-1.5 text-sm">
              {[
                ['Crédito nuevo', fmt(calculo.montoNuevo)],
                ['Plazo', `${calculo.plazoDiasNuevo} días`],
                ['Tasa', `${(calculo.tasaNueva * 100).toFixed(0)}%`],
                ['Cargo financiero', fmt(calculo.cargoFinancieroNuevo)],
                ['Total a pagar', fmt(calculo.totalAPagarNuevo)],
                ['Pago diario', fmt(calculo.pagoPeriodicoNuevo)],
                ['— Pagos restantes ant.', `–${fmt(calculo.montoPagosRestantes)}`],
                ['— Multas pendientes', `–${fmt(calculo.multasPendientes)}`],
                ['— Pago adelantado', `–${fmt(calculo.pagoAdelantadoNuevo)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Monto a Entregar</span>
                <span className="text-[#3d6b35] text-base">{fmt(calculo.montoDesembolso)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Detalles operativos */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Detalles operativos</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Forma de pago</span>
              <span className="font-medium">{tipoPago}</span>
            </div>
            {garantiaDescripcion.trim() && (
              <div className="flex justify-between">
                <span className="text-gray-500">Garantía</span>
                <span className="font-medium text-right max-w-[60%]">{garantiaDescripcion}</span>
              </div>
            )}
          </div>
        </div>

        {/* Video de entrega */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Video de Entrega{' '}
            <span className="text-xs text-gray-400 font-normal">(opcional)</span>
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video de entrega
            </label>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setVideoEntregaUrl(file.name)
                }
              }}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">Graba o sube el video de entrega del efectivo</p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn flex items-center gap-2 justify-center py-3"
          >
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <button
            type="button"
            onClick={async () => {
              setIsProcessing(true)
              try {
                await mutation.mutateAsync()
              } finally {
                setIsProcessing(false)
              }
            }}
            disabled={mutation.isPending || isProcessing}
            className="btn-primary flex items-center gap-2 justify-center flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending || isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Enviar Solicitud de Renovación
              </>
            )}
          </button>
        </div>
      </div>

      <ProcessingOverlay
        visible={mutation.isPending || isProcessing}
        title="Enviando solicitud"
        message="Estamos registrando la solicitud de renovación. El gerente la revisará en breve."
      />
    </div>
  )
}
