import { useState } from 'react'
import BusinessMap from '@/components/BusinessMap'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Power, FileText, User, Briefcase, Users } from 'lucide-react'
import { api, clienteService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import { ClienteModal } from './ClientesPage'
import { ESTADO_CIVIL_LABELS } from '@/types'
import type { EstadoCliente, EstadoCivil } from '@/types'
import { creditoService } from '@/services/creditoService'
import { cobrosService } from '@/services/cobrosService'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import ModalRegistrarPago from '@/components/cobros/ModalRegistrarPago'
import ClienteDocumentosSection from '@/components/clientes/ClienteDocumentosSection'
import type { CreditoResumen } from '@/types'

// ── Badge de estado ───────────────────────────────────────────────
const ESTADO_CONFIG: Record<EstadoCliente, { label: string; cls: string }> = {
  ACTIVO:      { label: 'Activo',      cls: 'badge-verde' },
  EN_MORA:     { label: 'En mora',     cls: 'badge-rojo' },
  SIN_CREDITO: { label: 'Sin crédito', cls: 'badge-amarillo' },
  INACTIVO:    { label: 'Inactivo',    cls: 'badge-gris' },
}

function EstadoBadge({ estado }: { estado: EstadoCliente }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: 'badge-gris' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

// ── Helpers de formato ────────────────────────────────────────────
function fmtMoney(v?: number | null) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(v?: string) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-[#f1f3f5] last:border-0">
      <span className="text-[11px] font-medium text-[#adb5bd] sm:w-36 shrink-0">{label}</span>
      <span className="text-[13px] text-[#212529]">{value ?? '—'}</span>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────
type Tab = 'datos' | 'referencias' | 'historial' | 'documentos'

// ── CreditoActivoCard ──────────────────────────────────────────────
function safeNC(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function asFiniteOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtC(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtCurrencyOrDash(v: unknown, minimumFractionDigits = 0): string {
  const n = asFiniteOrNull(v)
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits,
  }).format(n)
}

function fmtPagosCumplidos(realizados: unknown, total: unknown): string {
  const r = asFiniteOrNull(realizados)
  const t = asFiniteOrNull(total)
  if (r == null || t == null) return '—'
  return `${r} / ${t}`
}
function fmtD(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

function parseCoord(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

interface CreditoActivoCardProps {
  credito: CreditoResumen
  onNavigate: (path: string) => void
  puedeRegistrarCobro: boolean
  onRegistrarPago?: () => void
}

function CreditoActivoCard({ credito, onNavigate, puedeRegistrarCobro, onRegistrarPago }: CreditoActivoCardProps) {
  const monto = safeNC(credito.montoAprobado ?? credito.montoCapital)
  const pagoPeriodico = safeNC(credito.pagoPeriodico)
  const totalPagos = safeNC(credito.totalPagos ?? credito.plazoDias)
  const pagosRealizados = safeNC(credito.pagosRealizados)
  const progreso = totalPagos > 0 ? (pagosRealizados / totalPagos) * 100 : 0

  return (
    <div className="card border-l-4 border-l-[#3d6b35]">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[#3d6b35] uppercase tracking-wide">
            Crédito Activo
          </p>
          <CreditoEstadoBadge estado="ACTIVO" size="sm" />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-xs text-gray-400">Monto</span>
            <div className="font-semibold text-gray-800">{fmtC(monto)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Pago diario</span>
            <div className="font-semibold text-gray-800">{fmtC(pagoPeriodico)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Progreso</span>
            <div className="font-medium text-gray-700">
              Pago {pagosRealizados} de {totalPagos}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Vence</span>
            <div className="font-medium text-gray-700">
              {fmtD(credito.fechaVencimiento)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-[#3d6b35] transition-all"
              style={{ width: `${Math.min(100, progreso)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {pagosRealizados} de {totalPagos} pagos completados
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          {puedeRegistrarCobro && (
            <button
              type="button"
              className="btn flex-1 py-2 text-sm"
              onClick={() => onRegistrarPago ? onRegistrarPago() : onNavigate('/cobros')}
            >
              Registrar Pago
            </button>
          )}
          <button
            type="button"
            className={`btn-primary py-2 text-sm ${puedeRegistrarCobro ? 'flex-1' : 'w-full'}`}
            onClick={() => onNavigate(`/creditos/${credito.id}`)}
          >
            Ver crédito
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('datos')
  const [editOpen, setEditOpen] = useState(false)
  const [pagoModalOpen, setPagoModalOpen] = useState(false)

  const esAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const esAsesor = usuario?.rol === 'ASESOR_COBRADOR'
  const puedeAsignarAsesor =
    usuario?.rol === 'ADMINISTRADOR' ||
    usuario?.rol === 'SUPERVISOR' ||
    usuario?.rol === 'SUPERVISOR_CAMPO'
  const puedeAsignarSucursal =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const puedeRegistrarCobro =
    usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  const { data: cliente, isLoading, error } = useQuery({
    queryKey: ['cliente', usuario?.id, Number(id)],
    queryFn: () => clienteService.obtener(Number(id)),
    enabled: !!id && !!usuario?.id,
  })

  const { data: creditosData } = useQuery({
    queryKey: ['creditos-cliente', Number(id)],
    queryFn: () => creditoService.getCreditosCliente(Number(id)),
    enabled: !!id && !!usuario?.id,
  })

  const { data: ultimosCobros = [] } = useQuery({
    queryKey: ['pagos-cliente', Number(id)],
    queryFn: () => cobrosService.getPagosPorCliente(Number(id)),
    enabled: !!id && tab === 'historial',
    staleTime: 30_000,
  })

  const creditoActivo = creditosData?.find((c) => c.estado === 'ACTIVO') ?? null
  const creditoEnProceso = creditosData?.find(
    (c) => c.estado === 'SOLICITADO' || c.estado === 'APROBADO'
  ) ?? null

  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-list', usuario?.id, usuario?.rol],
    queryFn: () => api.get<{ id: number; nombre_completo: string }[]>('/clientes/asesores').then((r) => r.data),
    enabled: !!usuario?.id && usuario?.rol !== 'ASESOR_COBRADOR',
  })

  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales-list', usuario?.id],
    queryFn: () => api.get<{ id: number; nombre: string }[]>('/sucursales').then((r) => r.data),
    enabled: !!usuario?.id && usuario?.rol !== 'ASESOR_COBRADOR',
  })

  const toggleMutation = useMutation({
    mutationFn: ({ activo }: { activo: boolean }) =>
      clienteService.cambiarEstado(Number(id), activo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', usuario?.id, Number(id)] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Estado actualizado')
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al cambiar estado'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-[#adb5bd] text-[13px]">Cargando...</p>
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-[#dc2626] text-[14px]">Cliente no encontrado</p>
        <button type="button" className="btn mt-4" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      </div>
    )
  }

  const puedeEditar = !esAsesor || cliente.estado_cliente === 'SIN_CREDITO'
  const negocioLat = parseCoord(cliente.negocio_lat)
  const negocioLng = parseCoord(cliente.negocio_lng)
  const tieneUbicacionNegocio = negocioLat != null && negocioLng != null && (negocioLat !== 0 || negocioLng !== 0)

  return (
    <div className="space-y-4">
      {/* ── Encabezado ── */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/clientes')}
          className="btn btn-sm mt-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Volver</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[#212529] leading-tight">
              {cliente.nombre_completo}
            </h1>
            <EstadoBadge estado={cliente.estado_cliente} />
          </div>
          <p className="text-[13px] text-[#6c757d] mt-0.5">
            {cliente.celular}
            {cliente.asesor && <> · Asesor: {cliente.asesor.nombre_completo}</>}
            {' · '}{cliente.sucursal.nombre}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {puedeEditar && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </button>
          )}
          {esAdmin && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => toggleMutation.mutate({ activo: !cliente.activo })}
              disabled={toggleMutation.isPending}
              title={cliente.activo ? 'Desactivar' : 'Activar'}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{cliente.activo ? 'Desactivar' : 'Activar'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Card: Crédito ── */}
      {creditoActivo ? (
        <CreditoActivoCard
          credito={creditoActivo}
          onNavigate={navigate}
          puedeRegistrarCobro={puedeRegistrarCobro}
          onRegistrarPago={puedeRegistrarCobro ? () => setPagoModalOpen(true) : undefined}
        />
      ) : creditoEnProceso ? (
        <div className="card border-l-4 border-l-amber-400 p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-0.5">
              Crédito en proceso
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">
                {fmtCurrencyOrDash(creditoEnProceso.montoAprobado ?? creditoEnProceso.montoCapital)}
              </span>
              <CreditoEstadoBadge estado={creditoEnProceso.estado} size="sm" />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => navigate(`/creditos/${creditoEnProceso.id}`)}
          >
            Ver solicitud
          </button>
        </div>
      ) : (
        <div className="card bg-[#f8f9fa]">
          <div className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-medium text-[#495057]">Sin crédito activo</p>
              <p className="text-[12px] text-[#adb5bd] mt-0.5">
                Este cliente no tiene un crédito vigente.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/creditos-nuevos')}
            >
              Nueva solicitud de crédito
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="card">
        {/* Tab nav — scrollable en móvil */}
        <div className="flex overflow-x-auto border-b border-[#e9ecef]">
          {([
            { key: 'datos',        label: 'Datos Personales',    icon: User },
            { key: 'referencias',  label: 'Referencias y Aval',  icon: Users },
            { key: 'historial',    label: 'Historial de Créditos', icon: FileText },
            { key: 'documentos',   label: 'Documentos',          icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#3d6b35] text-[#3d6b35]'
                  : 'border-transparent text-[#6c757d] hover:text-[#495057]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">

          {/* ── Tab: Datos Personales ── */}
          {tab === 'datos' && (
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                  Datos Personales
                </p>
                <div>
                  <Row label="Nombre completo" value={cliente.nombre_completo} />
                  <Row label="Fecha nacimiento" value={fmtDate(cliente.fecha_nacimiento)} />
                  <Row label="Estado civil" value={ESTADO_CIVIL_LABELS[cliente.estado_civil as EstadoCivil] ?? cliente.estado_civil} />
                  <Row label="Cónyuge" value={cliente.nombre_conyuge} />
                  <Row label="Celular" value={cliente.celular} />
                  <Row label="Teléfono fijo" value={cliente.telefono_fijo} />
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                  Identificación
                </p>
                <div>
                  <Row label="INE" value={cliente.ine_numero} />
                  <Row label="CURP" value={cliente.curp} />
                  <Row label="RFC" value={cliente.rfc} />
                  <Row label="Tipo ID" value={cliente.ine_tipo} />
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                  Domicilio
                </p>
                <div>
                  <Row
                    label="Dirección"
                    value={`${cliente.dom_calle} ${cliente.dom_no_exterior}${cliente.dom_no_interior ? ' Int. ' + cliente.dom_no_interior : ''}`}
                  />
                  <Row label="Colonia" value={cliente.dom_colonia} />
                  <Row label="Municipio / Estado" value={`${cliente.dom_municipio}, ${cliente.dom_estado} CP ${cliente.dom_codigo_postal}`} />
                  <Row label="Tipo de vivienda" value={cliente.dom_tipo_vivienda} />
                  <Row label="Renta mensual" value={fmtMoney(cliente.dom_monto_renta)} />
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                  <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                  Datos del Negocio
                </p>
                <div>
                  <Row label="Negocio" value={cliente.negocio_nombre} />
                  <Row label="Giro" value={cliente.negocio_giro} />
                  <Row label="Antigüedad" value={cliente.negocio_antiguedad} />
                  <Row label="Dirección" value={
                    cliente.negocio_calle
                      ? `${cliente.negocio_calle} ${cliente.negocio_no_exterior}${cliente.negocio_no_interior ? ' Int. ' + cliente.negocio_no_interior : ''}, Col. ${cliente.negocio_colonia}, ${cliente.negocio_municipio}, ${cliente.negocio_estado} ${cliente.negocio_cp}`
                      : cliente.negocio_direccion
                  } />
                  <Row label="Tipo de local" value={cliente.negocio_tipo_local} />
                  <Row label="Renta del local" value={fmtMoney(cliente.negocio_monto_renta)} />
                  <Row label="Horarios" value={cliente.negocio_horarios} />
                  <Row label="Ingresos semanales" value={fmtMoney(cliente.ingresos_semanales)} />
                  <Row label="Gastos semanales" value={fmtMoney(cliente.gastos_semanales)} />
                </div>
                {tieneUbicacionNegocio && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                      Ubicación del negocio
                    </p>
                    <BusinessMap
                      lat={negocioLat}
                      lng={negocioLng}
                      onChange={() => {}}
                      readOnly
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Referencias y Aval ── */}
          {tab === 'referencias' && (
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                  Referencia 1
                </p>
                <div>
                  <Row label="Nombre" value={cliente.ref1_nombre} />
                  <Row label="Teléfono" value={cliente.ref1_telefono} />
                  <Row label="Parentesco" value={cliente.ref1_parentesco} />
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                  Referencia 2
                </p>
                <div>
                  <Row label="Nombre" value={cliente.ref2_nombre} />
                  <Row label="Teléfono" value={cliente.ref2_telefono} />
                  <Row label="Parentesco" value={cliente.ref2_parentesco} />
                </div>
              </div>
              {(cliente.aval_nombre || cliente.aval_telefono) && (
                <div>
                  <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
                    Aval
                  </p>
                  <div>
                    <Row label="Nombre" value={cliente.aval_nombre} />
                    <Row label="Teléfono" value={cliente.aval_telefono} />
                    <Row label="Dirección" value={cliente.aval_direccion} />
                    <Row label="Identificación" value={cliente.aval_identificacion} />
                  </div>
                </div>
              )}
              {!cliente.aval_nombre && !cliente.aval_telefono && (
                <p className="text-[13px] text-[#adb5bd]">Sin aval registrado.</p>
              )}
            </div>
          )}

          {/* ── Tab: Historial de Créditos ── */}
          {tab === 'historial' && (
            <div>
              {!creditosData || creditosData.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-[#dee2e6] mx-auto mb-2" />
                  <p className="text-[13px] text-[#adb5bd]">Sin historial de créditos anteriores.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Fecha inicio</th>
                        <th>Fecha de pago</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Pagos cumplidos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditosData.map((c) => (
                        <tr key={c.id}>
                          <td>
                            {c.fechaInicio
                              ? new Date(c.fechaInicio).toLocaleDateString('es-MX', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td>
                            {c.fechaVencimiento
                              ? new Date(c.fechaVencimiento).toLocaleDateString('es-MX', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td>
                            {fmtCurrencyOrDash(c.montoAprobado ?? c.montoCapital, 2)}
                          </td>
                          <td>
                            <CreditoEstadoBadge
                              estado={c.estado}
                              size="sm"
                            />
                          </td>
                          <td>
                            {fmtPagosCumplidos(c.pagosRealizados, c.totalPagos ?? c.plazoDias)}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => navigate(`/creditos/${c.id}`)}
                              className="btn btn-sm text-xs"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Últimos cobros ── */}
              {ultimosCobros.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide">
                      Últimos cobros
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm text-xs"
                      onClick={() => navigate('/historial')}
                    >
                      Ver historial completo
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="tabla text-[12px]">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Pago #</th>
                          <th className="text-right">Monto</th>
                          <th>Estado</th>
                          <th>Asesor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ultimosCobros.slice(0, 10).map((p) => {
                          const estado = p.razonNoPago ? 'NO_PAGADO' : p.esCompleto ? 'PAGADO' : 'PARCIAL'
                          return (
                            <tr key={p.id}>
                              <td className="text-[#6c757d] whitespace-nowrap">
                                {new Date(p.fechaPago + 'T12:00:00').toLocaleDateString('es-MX', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </td>
                              <td className="text-[#6c757d]">#{p.numeroPago}</td>
                              <td className={`text-right font-semibold ${
                                estado === 'NO_PAGADO' ? 'text-[#dc2626]'
                                : estado === 'PAGADO'  ? 'text-[#2d6a4f]'
                                : 'text-[#f59e0b]'
                              }`}>
                                {estado === 'NO_PAGADO' ? '—' : fmtMoney(p.montoRecibido)}
                              </td>
                              <td>
                                <span className={`badge ${
                                  estado === 'NO_PAGADO' ? 'badge-rojo'
                                  : estado === 'PAGADO'  ? 'badge-verde'
                                  : 'badge-amarillo'
                                }`}>
                                  {estado === 'NO_PAGADO' ? 'No pagó' : estado === 'PAGADO' ? 'Pagado' : 'Parcial'}
                                </span>
                              </td>
                              <td className="text-[#6c757d]">
                                {p.registradoPor?.nombreCompleto ?? '—'}
                                {p.createdAt && (
                                  <span className="text-[10px] text-[#adb5bd]">
                                    {' · '}Reg: {fmtDateTime(p.createdAt)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Documentos ── */}
          {tab === 'documentos' && (
            <ClienteDocumentosSection
              clienteId={Number(id)}
              canDelete={esAdmin}
            />
          )}
        </div>
      </div>

      {editOpen && (
        <ClienteModal
          cliente={cliente}
          sucursales={sucursales}
          asesores={asesores}
          puedeAsignarAsesor={puedeAsignarAsesor}
          puedeAsignarSucursal={puedeAsignarSucursal}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            qc.invalidateQueries({ queryKey: ['cliente', usuario?.id, Number(id)] })
            qc.invalidateQueries({ queryKey: ['clientes'] })
          }}
        />
      )}

      {pagoModalOpen && creditoActivo && (
        <ModalRegistrarPago
          creditoId={creditoActivo.id}
          pagoPeriodico={creditoActivo.pagoPeriodico}
          nombreCliente={cliente.nombre_completo}
          fecha={new Date().toISOString().slice(0, 10)}
          onClose={() => setPagoModalOpen(false)}
          onSuccess={() => {
            setPagoModalOpen(false)
            qc.invalidateQueries({ queryKey: ['creditos-cliente', Number(id)] })
          }}
        />
      )}
    </div>
  )
}
