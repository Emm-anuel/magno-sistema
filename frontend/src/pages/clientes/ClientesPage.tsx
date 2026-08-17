import { useState, useCallback, useRef, useEffect } from 'react'
import BusinessMap from '@/components/BusinessMap'
import FileUpload from '@/components/FileUpload'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Power, X, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { api, clienteService, fileService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useCajaOperativa } from '@/hooks/useCajaOperativa'
import CajaOperativaBanner from '@/components/caja/CajaOperativaBanner'
import SucursalSelector from '@/components/SucursalSelector'
import { useSucursalScope } from '@/hooks/useSucursalScope'
import ProcessingOverlay from '@/components/ProcessingOverlay'
import { normalizePhone, optionalPhoneSchema, requiredPhoneSchema, sanitizePhoneInput } from '@/utils/phone'
import { curpSchema, normalizeCurp, normalizeRfc, optionalRfcSchema, sanitizeCurpInput, sanitizeRfcInput } from '@/utils/identifiers'
import type {
  EstadoCliente,
  ClienteCoincidencia, ClienteResumen,
  ClienteDetalle, ClienteCreateRequest, ClienteUpdateRequest,
} from '@/types'

// ── Badge de estado ───────────────────────────────────────────────
const ESTADO_CONFIG: Record<EstadoCliente, { label: string; cls: string }> = {
  ACTIVO:      { label: 'Activo',       cls: 'badge-verde' },
  EN_MORA:     { label: 'En mora',      cls: 'badge-rojo' },
  SIN_CREDITO: { label: 'Sin crédito',  cls: 'badge-amarillo' },
  INACTIVO:    { label: 'Inactivo',     cls: 'badge-gris' },
}

function EstadoBadge({ estado }: { estado: EstadoCliente }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: 'badge-gris' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

// ── Esquema de validación ─────────────────────────────────────────
const requiredNumberSchema = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? undefined : value,
  z.coerce.number({ required_error: 'Requerido', invalid_type_error: 'Requerido' }),
)

const clienteSchema = z.object({
  nombre:              z.string().min(1, 'Requerido'),
  apellido_paterno:    z.string().min(1, 'Requerido'),
  apellido_materno:    z.string().optional(),
  fecha_nacimiento:    z.string().min(1, 'Requerido'),
  estado_civil:        z.enum(['SOLTERO', 'CASADO', 'UNION_LIBRE'] as const),
  nombre_conyuge:      z.string().optional(),
  telefono_fijo:       optionalPhoneSchema,
  celular:             requiredPhoneSchema,
  ine_tipo:            z.string().min(1, 'Requerido'),
  ine_numero:          z.string().min(1, 'Requerido'),
  curp:                curpSchema,
  rfc:                 optionalRfcSchema,
  dom_calle:           z.string().min(1, 'Requerido'),
  dom_no_exterior:     z.string().min(1, 'Requerido'),
  dom_no_interior:     z.string().optional(),
  dom_colonia:         z.string().min(1, 'Requerido'),
  dom_municipio:       z.string().min(1, 'Requerido'),
  dom_estado:          z.string().min(1, 'Requerido'),
  dom_codigo_postal:   z.string().min(4, 'Requerido'),
  dom_tipo_vivienda:   z.string().min(1, 'Requerido'),
  dom_monto_renta:     z.coerce.number().optional(),
  negocio_nombre:         z.string().min(1, 'Requerido'),
  negocio_giro:           z.string().min(1, 'Requerido'),
  negocio_antiguedad:     z.string().min(1, 'Requerido'),
  negocio_direccion:      z.string().optional(),
  negocio_calle:          z.string().min(1, 'Requerido'),
  negocio_no_exterior:    z.string().min(1, 'Requerido'),
  negocio_no_interior:    z.string().optional(),
  negocio_colonia:        z.string().min(1, 'Requerido'),
  negocio_municipio:      z.string().min(1, 'Requerido'),
  negocio_estado:         z.string().min(1, 'Requerido'),
  negocio_cp:             z.string().min(4, 'Requerido'),
  negocio_tipo_local:  z.string().min(1, 'Requerido'),
  negocio_monto_renta: z.coerce.number().optional(),
  negocio_horarios:    z.string().optional(),
  negocio_lat:         z.coerce.number().optional(),
  negocio_lng:         z.coerce.number().optional(),
  ingresos_semanales:  requiredNumberSchema,
  gastos_semanales:    z.coerce.number().optional(),
  gastos_renta:        z.coerce.number().optional(),
  gastos_otros:        z.coerce.number().optional(),
  ref1_nombre:         z.string().min(1, 'Requerido'),
  ref1_telefono:       requiredPhoneSchema,
  ref1_parentesco:     z.string().min(1, 'Requerido'),
  ref2_nombre:         z.string().min(1, 'Requerido'),
  ref2_telefono:       requiredPhoneSchema,
  ref2_parentesco:     z.string().min(1, 'Requerido'),
  aval_nombre:         z.string().optional(),
  aval_telefono:       optionalPhoneSchema,
  aval_direccion:      z.string().optional(),
  aval_identificacion: z.string().optional(),
  asesor_id:           z.coerce.number().optional(),
  // Solo ADMINISTRADOR elige sucursal en el formulario. Para los demas
  // roles el backend la fuerza a partir del JWT, por lo que no debe bloquear
  // el submit un campo que ni siquiera se muestra.
  sucursal_id:         z.coerce.number().optional(),
})

type ClienteForm = z.infer<typeof clienteSchema>

const CLIENTE_FIELD_LABELS: Partial<Record<keyof ClienteForm, string>> = {
  nombre: 'Nombre(s)',
  apellido_paterno: 'Apellido paterno',
  fecha_nacimiento: 'Fecha de nacimiento',
  estado_civil: 'Estado civil',
  telefono_fijo: 'Telefono fijo',
  celular: 'Celular',
  ine_numero: 'No. de INE',
  curp: 'CURP',
  rfc: 'RFC',
  dom_calle: 'Domicilio - Calle',
  dom_no_exterior: 'Domicilio - No. exterior',
  dom_colonia: 'Domicilio - Colonia',
  dom_municipio: 'Domicilio - Municipio',
  dom_estado: 'Domicilio - Estado',
  dom_codigo_postal: 'Domicilio - C.P.',
  negocio_nombre: 'Nombre del negocio',
  negocio_giro: 'Giro',
  negocio_antiguedad: 'Antiguedad del negocio',
  negocio_calle: 'Direccion del negocio - Calle',
  negocio_no_exterior: 'Direccion del negocio - No. exterior',
  negocio_colonia: 'Direccion del negocio - Colonia',
  negocio_municipio: 'Direccion del negocio - Municipio',
  negocio_estado: 'Direccion del negocio - Estado',
  negocio_cp: 'Direccion del negocio - C.P.',
  ref1_nombre: 'Referencia 1 - Nombre',
  ref1_telefono: 'Referencia 1 - Telefono',
  ref1_parentesco: 'Referencia 1 - Parentesco',
  ref2_nombre: 'Referencia 2 - Nombre',
  ref2_telefono: 'Referencia 2 - Telefono',
  ref2_parentesco: 'Referencia 2 - Parentesco',
  aval_telefono: 'Aval - Telefono',
  sucursal_id: 'Sucursal',
}

function getFirstClienteFormError(formErrors: FieldErrors<ClienteForm>) {
  const entry = Object.entries(formErrors)[0]
  if (!entry) return null

  const [field, error] = entry as [keyof ClienteForm, { message?: unknown }]
  return {
    field,
    label: CLIENTE_FIELD_LABELS[field] ?? String(field).replace(/_/g, ' '),
    message: typeof error?.message === 'string' ? error.message : 'Valor invalido',
  }
}

// ── Helper ─────────────────────────────────────────────────────────
function initials(name: string) {
  if (!name?.trim()) return 'CL'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function duplicateSearchParams(data: Partial<ClienteForm>) {
  const celular = data.celular?.replace(/\D/g, '')
  const curp = data.curp ? normalizeCurp(data.curp) : undefined
  const ineNumero = data.ine_numero?.trim().toUpperCase()
  return {
    nombre: data.nombre?.trim() || undefined,
    apellidoPaterno: data.apellido_paterno?.trim() || undefined,
    fechaNacimiento: data.fecha_nacimiento || undefined,
    celular: celular?.length === 10 ? celular : undefined,
    curp: curp?.length === 18 ? curp : undefined,
    ineNumero: ineNumero && ineNumero.length >= 6 ? ineNumero : undefined,
  }
}

type AvailabilityStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'error'

// ── Componente principal ──────────────────────────────────────────
export default function ClientesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { usuario } = useAuthStore()
  const { bannerVariant, horaLimite, bloqueado } = useCajaOperativa()
  const { opciones: sucursalScopeOpciones, sucursalId: sucursalScopeId, setSucursalId: setSucursalScopeId } = useSucursalScope()

  const [buscar, setBuscar] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoCliente | ''>('')
  const [filtroAsesor, setFiltroAsesor] = useState<number | ''>('')
  const [filtroSucursal, setFiltroSucursal] = useState<number | ''>('')
  const [pagina, setPagina] = useState(0)
  const [modal, setModal] = useState<{ open: boolean; cliente: ClienteDetalle | null }>({
    open: false, cliente: null,
  })
  const [returnToPath, setReturnToPath] = useState<string | null>(null)

  const esAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const esAsesor = usuario?.rol === 'ASESOR_COBRADOR'
  const puedeCrear = true // todos los roles pueden crear clientes
  const puedeAsignarAsesor =
    usuario?.rol === 'ADMINISTRADOR' ||
    usuario?.rol === 'SUPERVISOR' ||
    usuario?.rol === 'SUPERVISOR_CAMPO'
  // Solo el Gerente General (ADMINISTRADOR) gestiona múltiples sucursales.
  // El Gerente de Sucursal (SUPERVISOR) siempre opera dentro de su propia sucursal.
  const puedeAsignarSucursal = usuario?.rol === 'ADMINISTRADOR'

  const { data, isLoading, error } = useQuery({
    queryKey: ['clientes', usuario?.id, usuario?.rol, sucursalScopeId, { buscar, filtroEstado, filtroAsesor, filtroSucursal, pagina }],
    queryFn: () => clienteService.listar({
      buscar:      buscar || undefined,
      estado:      filtroEstado || undefined,
      asesorId:    filtroAsesor || undefined,
      sucursalId:  filtroSucursal || sucursalScopeId || undefined,
      page: pagina,
      size: 20,
    }),
    enabled: !!usuario?.id,
    staleTime: 30_000,
  })

  const puedeVerAsesores = usuario?.rol !== 'ASESOR_COBRADOR'

  const { data: asesores } = useQuery({
    queryKey: ['asesores-list', usuario?.id, usuario?.rol],
    queryFn: () => api.get<{ id: number; nombre_completo: string }[]>('/clientes/asesores')
      .then((r) => r.data),
    enabled: puedeVerAsesores && !!usuario?.id,
  })

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales-list', usuario?.id],
    queryFn: () => api.get<{ id: number; nombre: string }[]>('/sucursales').then((r) => r.data),
    enabled: usuario?.rol === 'ADMINISTRADOR',
  })

  const qc = useQueryClient()
  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      clienteService.cambiarEstado(id, activo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Estado actualizado')
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al cambiar estado'),
  })

  const clientes = data?.content ?? []
  const totalPages = data?.total_pages ?? 0
  const totalElements = data?.total_elements ?? 0

  // Métricas sencillas
  const activos     = clientes.filter((c) => c.estado_cliente === 'ACTIVO').length
  const enMora      = clientes.filter((c) => c.estado_cliente === 'EN_MORA').length
  const sinCredito  = clientes.filter((c) => c.estado_cliente === 'SIN_CREDITO').length

  const openModal = async (cliente: ClienteResumen) => {
    const puedeEditarCliente = !esAsesor || cliente.estado_cliente === 'SIN_CREDITO'
    if (!puedeEditarCliente) return

    try {
      setReturnToPath(null)
      const detalle = await clienteService.obtener(cliente.id)
      setModal({ open: true, cliente: detalle })
    } catch {
      toast.error('Error al cargar datos del cliente')
    }
  }

  useEffect(() => {
    const state = location.state as { editClienteId?: number; returnToPath?: string } | null
    const editClienteId = state?.editClienteId

    if (!editClienteId) return

    setReturnToPath(state?.returnToPath ?? null)

    clienteService
      .obtener(editClienteId)
      .then((detalle) => setModal({ open: true, cliente: detalle }))
      .catch(() => toast.error('Error al cargar datos del cliente'))
      .finally(() => {
        navigate('/clientes', { replace: true, state: null })
      })
  }, [location.state, navigate])

  const canEditCliente = (estadoCliente: EstadoCliente) =>
    !esAsesor || estadoCliente === 'SIN_CREDITO'

  return (
    <div>
      <CajaOperativaBanner variant={bannerVariant} horaLimite={horaLimite} />
      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="metric-card">
          <p className="metric-label">Total clientes</p>
          <p className="metric-val">{totalElements}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Activos con crédito</p>
          <p className="metric-val text-[#16a34a]">{activos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">En mora</p>
          <p className="metric-val text-[#dc2626]">{enMora}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Sin crédito activo</p>
          <p className="metric-val text-[#f59e0b]">{sinCredito}</p>
        </div>
      </div>

      {/* ── Tabla / lista ── */}
      <div className="card">
        <div className="card-header flex-wrap gap-2">
          <span className="card-title">Clientes</span>
          {puedeCrear && (
            <button
              className="btn-primary"
              onClick={() => setModal({ open: true, cliente: null })}
              disabled={bloqueado}
              title={bloqueado ? 'La caja está cerrada' : undefined}
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="px-[18px] py-3 border-b border-[#e9ecef] flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
            <input
              type="search"
              placeholder="Nombre, No. cliente, celular, CURP..."
              value={buscar}
              onChange={(e) => { setBuscar(e.target.value); setPagina(0) }}
              className="input pl-8 max-w-xs"
            />
          </div>
          <select
            className="input w-auto"
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value as EstadoCliente | ''); setPagina(0) }}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="EN_MORA">En mora</option>
            <option value="SIN_CREDITO">Sin crédito</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
          {puedeVerAsesores && (
            <select
              className="input w-auto"
              value={filtroAsesor}
              onChange={(e) => { setFiltroAsesor(e.target.value ? Number(e.target.value) : ''); setPagina(0) }}
            >
              <option value="">Todos los asesores</option>
              {(asesores ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.nombre_completo}</option>
              ))}
            </select>
          )}
          {usuario?.rol === 'ADMINISTRADOR' && (
            <select
              className="input w-auto"
              value={filtroSucursal}
              onChange={(e) => { setFiltroSucursal(e.target.value ? Number(e.target.value) : ''); setPagina(0) }}
            >
              <option value="">Todas las sucursales</option>
              {(sucursales ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
          <SucursalSelector
            opciones={sucursalScopeOpciones}
            value={sucursalScopeId}
            onChange={(id) => { setSucursalScopeId(id); setPagina(0) }}
          />
        </div>

        {isLoading ? (
          <p className="text-center text-[#adb5bd] py-10 text-[13px]">Cargando...</p>
        ) : error ? (
          <p className="text-center text-[#dc2626] py-10 text-[13px]">
            Error al cargar clientes: {(error as any).message ?? 'Error de conexión'}
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="w-[90px]">No.</th>
                    <th>Cliente</th>
                    <th>Negocio</th>
                    <th>Asesor</th>
                    <th>Sucursal</th>
                    <th className="text-center">Crédito</th>
                    <th className="text-center">Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-[#adb5bd] py-8">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    clientes.map((c) => (
                      <tr key={c.id}>
                        <td className="font-mono text-[13px] text-[#495057]">
                          {c.numero_cliente ?? <span className="text-[#adb5bd]">—</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#dcfce7] flex items-center justify-center text-[11px] font-semibold text-[#166534] shrink-0">
                              {initials(c.nombre_completo)}
                            </div>
                            <div>
                              <p className="font-medium text-[#212529]">{c.nombre_completo}</p>
                              <p className="text-[11px] text-[#adb5bd]">{c.celular}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-[13px] text-[#212529]">{c.negocio_nombre}</p>
                          <p className="text-[11px] text-[#adb5bd]">{c.negocio_giro}</p>
                        </td>
                        <td className="text-[13px] text-[#495057]">
                          {c.asesor?.nombre_completo ?? <span className="text-[#adb5bd]">—</span>}
                        </td>
                        <td className="text-[13px] text-[#495057]">{c.sucursal.nombre}</td>
                        <td className="text-center">
                          {c.tiene_credito_activo ? (
                            <span className="text-[#16a34a] font-semibold text-[13px]">✓</span>
                          ) : (
                            <span className="text-[#adb5bd] text-[12px]">—</span>
                          )}
                        </td>
                        <td className="text-center">
                          <EstadoBadge estado={c.estado_cliente} />
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="btn btn-sm"
                              onClick={() => navigate(`/clientes/${c.id}`)}
                              title="Ver detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </button>
                            {puedeCrear && canEditCliente(c.estado_cliente) && (
                              <button
                                className="btn btn-sm"
                                onClick={() => openModal(c)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                            )}
                            {esAdmin && (
                              <button
                                className="btn btn-sm"
                                onClick={() => toggleMutation.mutate({ id: c.id, activo: !c.activo })}
                                title={c.activo ? 'Desactivar' : 'Activar'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#e9ecef]">
              {clientes.length === 0 ? (
                <p className="text-center text-[#adb5bd] py-8 text-[13px]">Sin resultados</p>
              ) : (
                clientes.map((c) => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center text-[13px] font-semibold text-[#166534] shrink-0">
                        {initials(c.nombre_completo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#212529] text-[14px]">{c.nombre_completo}</p>
                        <p className="text-[12px] text-[#6c757d] mt-0.5">
                          {c.celular} · {c.negocio_nombre}
                        </p>
                        <div className="mt-1.5">
                          <EstadoBadge estado={c.estado_cliente} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        className="btn btn-sm flex-1 justify-center py-2.5"
                        onClick={() => navigate(`/clientes/${c.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </button>
                      {puedeCrear && canEditCliente(c.estado_cliente) && (
                        <button
                          className="btn btn-sm flex-1 justify-center py-2.5"
                          onClick={() => openModal(c)}
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-[18px] py-3 border-t border-[#e9ecef]">
                <p className="text-[12px] text-[#adb5bd]">
                  Página {pagina + 1} de {totalPages} · {totalElements} clientes
                </p>
                <div className="flex gap-1">
                  <button
                    className="btn btn-sm"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={pagina >= totalPages - 1}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <ClienteModal
          cliente={modal.cliente}
          sucursales={sucursales ?? []}
          asesores={asesores ?? []}
          puedeAsignarAsesor={puedeAsignarAsesor}
          puedeAsignarSucursal={puedeAsignarSucursal}
          sucursalScopeId={sucursalScopeId}
          onUseExisting={(match) => {
            setModal({ open: false, cliente: null })
            navigate(`/clientes/${match.id}`)
          }}
          onClose={() => {
            setModal({ open: false, cliente: null })
            if (returnToPath) {
              const destination = returnToPath
              setReturnToPath(null)
              navigate(destination)
            }
          }}
          onSaved={() => {
            setModal({ open: false, cliente: null })
            qc.invalidateQueries({ queryKey: ['clientes'] })
            if (returnToPath) {
              const destination = returnToPath
              setReturnToPath(null)
              navigate(destination)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Modal de Alta / Edición ───────────────────────────────────────
interface ModalProps {
  cliente: ClienteDetalle | null
  sucursales: { id: number; nombre: string }[]
  asesores: { id: number; nombre_completo: string }[]
  puedeAsignarAsesor: boolean
  puedeAsignarSucursal: boolean
  sucursalScopeId?: number
  onUseExisting?: (cliente: ClienteCoincidencia) => void
  onClose: () => void
  onSaved: () => void
}

export function ClienteModal({ cliente, sucursales, asesores, puedeAsignarAsesor, puedeAsignarSucursal, sucursalScopeId, onUseExisting, onClose, onSaved }: ModalProps) {
  const isEdit = !!cliente
  const { usuario: authUsuario } = useAuthStore()
  const formRef = useRef<HTMLFormElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [avalOpen, setAvalOpen] = useState(!!cliente?.aval_nombre)
  const [mapLat, setMapLat] = useState<number | null>(
    cliente?.negocio_lat != null ? Number(cliente.negocio_lat) : null
  )
  const [mapLng, setMapLng] = useState<number | null>(
    cliente?.negocio_lng != null ? Number(cliente.negocio_lng) : null
  )
  const [curpStatus, setCurpStatus] = useState<AvailabilityStatus>('idle')
  const [celularStatus, setCelularStatus] = useState<AvailabilityStatus>('idle')
  const [duplicateMatches, setDuplicateMatches] = useState<ClienteCoincidencia[]>([])
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [duplicateCheckError, setDuplicateCheckError] = useState<string | null>(null)
  const curpTimeout = useRef<ReturnType<typeof setTimeout>>()
  const celularTimeout = useRef<ReturnType<typeof setTimeout>>()
  const curpCheckVersion = useRef(0)
  const celularCheckVersion = useRef(0)
  const [docIneFrente, setDocIneFrente] = useState<File | null>(null)
  const [docIneReverso, setDocIneReverso] = useState<File | null>(null)
  const [docComprobante, setDocComprobante] = useState<File | null>(null)
  const [docIneFrenteBusy, setDocIneFrenteBusy] = useState(false)
  const [docIneReversoBusy, setDocIneReversoBusy] = useState(false)
  const [docComprobanteBusy, setDocComprobanteBusy] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema) as any,
    defaultValues: cliente ? {
      nombre:              cliente.nombre,
      apellido_paterno:    cliente.apellido_paterno,
      apellido_materno:    cliente.apellido_materno ?? '',
      fecha_nacimiento:    cliente.fecha_nacimiento?.split('T')[0] ?? '',
      estado_civil:        cliente.estado_civil,
      nombre_conyuge:      cliente.nombre_conyuge ?? '',
      telefono_fijo:       cliente.telefono_fijo ?? '',
      celular:             cliente.celular,
      ine_tipo:            cliente.ine_tipo ?? '',
      ine_numero:          cliente.ine_numero,
      curp:                cliente.curp,
      rfc:                 cliente.rfc ?? '',
      dom_calle:           cliente.dom_calle,
      dom_no_exterior:     cliente.dom_no_exterior,
      dom_no_interior:     cliente.dom_no_interior ?? '',
      dom_colonia:         cliente.dom_colonia,
      dom_municipio:       cliente.dom_municipio,
      dom_estado:          cliente.dom_estado,
      dom_codigo_postal:   cliente.dom_codigo_postal,
      dom_tipo_vivienda:   cliente.dom_tipo_vivienda ?? '',
      dom_monto_renta:     cliente.dom_monto_renta,
      negocio_nombre:         cliente.negocio_nombre,
      negocio_giro:           cliente.negocio_giro,
      negocio_antiguedad:     cliente.negocio_antiguedad,
      negocio_direccion:      cliente.negocio_direccion ?? '',
      negocio_calle:          cliente.negocio_calle ?? '',
      negocio_no_exterior:    cliente.negocio_no_exterior ?? '',
      negocio_no_interior:    cliente.negocio_no_interior ?? '',
      negocio_colonia:        cliente.negocio_colonia ?? '',
      negocio_municipio:      cliente.negocio_municipio ?? '',
      negocio_estado:         cliente.negocio_estado ?? '',
      negocio_cp:             cliente.negocio_cp ?? '',
      negocio_tipo_local:  cliente.negocio_tipo_local ?? '',
      negocio_monto_renta: cliente.negocio_monto_renta,
      negocio_horarios:    cliente.negocio_horarios ?? '',
      ingresos_semanales:  cliente.ingresos_semanales,
      ref1_nombre:         cliente.ref1_nombre,
      ref1_telefono:       cliente.ref1_telefono,
      ref1_parentesco:     cliente.ref1_parentesco,
      ref2_nombre:         cliente.ref2_nombre,
      ref2_telefono:       cliente.ref2_telefono,
      ref2_parentesco:     cliente.ref2_parentesco,
      aval_nombre:         cliente.aval_nombre ?? '',
      aval_telefono:       cliente.aval_telefono ?? '',
      aval_direccion:      cliente.aval_direccion ?? '',
      aval_identificacion: cliente.aval_identificacion ?? '',
      asesor_id:           cliente.asesor?.id,
      sucursal_id:         cliente.sucursal.id,
    } : {
      // Para create mode: prioriza la sucursal actualmente seleccionada (Supervisor con
      // múltiples sucursales asignadas); si no aplica, cae a la sucursal del usuario.
      sucursal_id: sucursalScopeId ?? authUsuario?.sucursal?.id ?? 0,
    },
  })

  const domTipoVivienda = watch('dom_tipo_vivienda')
  const duplicateNombre = watch('nombre')
  const duplicateApellido = watch('apellido_paterno')
  const duplicateFechaNacimiento = watch('fecha_nacimiento')
  const duplicateCelular = watch('celular')
  const duplicateCurp = watch('curp')
  const duplicateIne = watch('ine_numero')

  useEffect(() => {
    if (isEdit) return

    const params = duplicateSearchParams({
      nombre: duplicateNombre,
      apellido_paterno: duplicateApellido,
      fecha_nacimiento: duplicateFechaNacimiento,
      celular: duplicateCelular,
      curp: duplicateCurp,
      ine_numero: duplicateIne,
    })
    const hasIdentity = Boolean(
      params.celular || params.curp || params.ineNumero
      || (params.nombre && params.apellidoPaterno && params.fechaNacimiento),
    )

    setDuplicateMatches([])
    setDuplicateCheckError(null)
    if (!hasIdentity) {
      setCheckingDuplicates(false)
      return
    }

    let cancelled = false
    setCheckingDuplicates(true)
    const timeout = setTimeout(() => {
      clienteService.buscarPosiblesDuplicados(params)
        .then((matches) => {
          if (!cancelled) setDuplicateMatches(matches)
        })
        .catch(() => {
          if (!cancelled) {
            setDuplicateCheckError(
              'No se pudo verificar si el cliente ya está registrado. La validación se repetirá al guardar.',
            )
          }
        })
        .finally(() => {
          if (!cancelled) setCheckingDuplicates(false)
        })
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [isEdit, duplicateNombre, duplicateApellido, duplicateFechaNacimiento,
    duplicateCelular, duplicateCurp, duplicateIne])

  const createMutation = useMutation({
    mutationFn: (data: ClienteCreateRequest) => clienteService.crear(data),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClienteUpdateRequest }) =>
      clienteService.actualizar(id, data),
    onSuccess: () => { toast.success('Cliente actualizado'); onSaved() },
    onError: (e: any) => {
      const msg = e.message ?? e.error ?? 'Error al actualizar'
      toast.error(msg, { duration: 5000 })
    },
  })

  const isPending = createMutation.isPending || editMutation.isPending
  const hasPendingDocumentProcessing = !isEdit && (
    docIneFrenteBusy ||
    docIneReversoBusy ||
    docComprobanteBusy
  )

  const initialMapLat = cliente?.negocio_lat != null ? Number(cliente.negocio_lat) : null
  const initialMapLng = cliente?.negocio_lng != null ? Number(cliente.negocio_lng) : null
  const hasUnsavedChanges = isDirty
    || docIneFrente !== null
    || docIneReverso !== null
    || docComprobante !== null
    || mapLat !== initialMapLat
    || mapLng !== initialMapLng

  const requestClose = () => {
    if (isProcessing || isPending || hasPendingDocumentProcessing) {
      toast.error('Espera a que termine el proceso antes de cerrar')
      return
    }
    if (hasUnsavedChanges && !window.confirm('Hay información sin guardar. ¿Deseas cerrar y descartarla?')) {
      return
    }
    onClose()
  }

  const canUseExisting = (match: ClienteCoincidencia) => {
    if (authUsuario?.rol === 'ADMINISTRADOR') return true
    if (authUsuario?.rol === 'ASESOR_COBRADOR') return match.asesor_id === authUsuario.id
    const allowedBranches = new Set([
      authUsuario?.sucursal?.id,
      ...(authUsuario?.sucursales_adicionales?.map((s) => s.id) ?? []),
    ])
    return allowedBranches.has(match.sucursal_id)
  }

  const checkCurp = useCallback((curp: string) => {
    clearTimeout(curpTimeout.current)
    const version = ++curpCheckVersion.current
    if (curp.length !== 18) { setCurpStatus('idle'); return }
    if (isEdit && curp === cliente?.curp) { setCurpStatus('ok'); return }
    setCurpStatus('checking')
    curpTimeout.current = setTimeout(async () => {
      try {
        const ok = await clienteService.verificarCurp(curp, isEdit ? cliente!.id : undefined)
        if (version === curpCheckVersion.current) setCurpStatus(ok ? 'ok' : 'taken')
      } catch {
        if (version === curpCheckVersion.current) setCurpStatus('error')
      }
    }, 400)
  }, [isEdit, cliente])

  const checkCelular = useCallback((celular: string) => {
    clearTimeout(celularTimeout.current)
    const version = ++celularCheckVersion.current
    if (celular.length !== 10) { setCelularStatus('idle'); return }
    if (isEdit && celular === cliente?.celular) { setCelularStatus('ok'); return }
    setCelularStatus('checking')
    celularTimeout.current = setTimeout(async () => {
      try {
        const ok = await clienteService.verificarCelular(celular, isEdit ? cliente!.id : undefined)
        if (version === celularCheckVersion.current) setCelularStatus(ok ? 'ok' : 'taken')
      } catch {
        if (version === celularCheckVersion.current) setCelularStatus('error')
      }
    }, 400)
  }, [isEdit, cliente])

  const onSubmit = async (data: ClienteForm) => {
    setFormSubmitted(true)
    if (puedeAsignarSucursal && !data.sucursal_id) {
      setError('sucursal_id', { type: 'manual', message: 'Requerido' }, { shouldFocus: true })
      toast.error('Selecciona la sucursal del cliente')
      return
    }
    if (!isEdit) {
      setDuplicateCheckError(null)
      setCheckingDuplicates(true)
      try {
        const matches = await clienteService.buscarPosiblesDuplicados(duplicateSearchParams(data))
        setDuplicateMatches(matches)
        if (matches.length > 0) {
          toast.error('El cliente ya está registrado. Utiliza el registro existente.')
          return
        }
      } catch {
        const message = 'No se pudo comprobar previamente si el cliente está duplicado. El servidor lo validará al guardar.'
        setDuplicateCheckError(message)
        toast.error(message)
      } finally {
        setCheckingDuplicates(false)
      }
    }
    if (curpStatus === 'taken') { toast.error('El CURP ya está registrado'); return }
    if (celularStatus === 'taken') { toast.error('El celular ya está registrado'); return }

    if (!isEdit && (mapLat === null || mapLng === null)) {
      toast.error('La ubicación del negocio es obligatoria')
      return
    }

    if (hasPendingDocumentProcessing) {
      toast.error('Espera a que terminen de procesarse los documentos')
      return
    }

    if (!isEdit && (!docIneFrente || !docIneReverso || !docComprobante)) {
      toast.error('Selecciona los tres documentos: INE frente, INE reverso y comprobante de domicilio')
      return
    }

    const payload: ClienteCreateRequest = {
      ...data,
      fecha_nacimiento:    data.fecha_nacimiento,
      dom_monto_renta:     data.dom_monto_renta     || undefined,
      negocio_monto_renta: data.negocio_monto_renta || undefined,
      ingresos_semanales:  data.ingresos_semanales,
      gastos_semanales:    data.gastos_semanales     || undefined,
      gastos_renta:        data.gastos_renta         || undefined,
      gastos_otros:        data.gastos_otros         || undefined,
      asesor_id:    puedeAsignarAsesor    ? (data.asesor_id || undefined)    : authUsuario?.id,
      sucursal_id:  puedeAsignarSucursal  ? data.sucursal_id                 : (sucursalScopeId ?? authUsuario?.sucursal?.id),
      negocio_lat:  mapLat ?? undefined,
      negocio_lng:  mapLng ?? undefined,
    }

    setIsProcessing(true)

    try {
      if (isEdit) {
        await editMutation.mutateAsync({ id: cliente!.id, data: payload })
      } else {
        const nuevoCliente = await createMutation.mutateAsync(payload)
        setUploadingDocuments(true)

        const documentos = [
          { tipo: 'INE_FRENTE', etiqueta: 'INE frente', archivo: docIneFrente! },
          { tipo: 'INE_REVERSO', etiqueta: 'INE reverso', archivo: docIneReverso! },
          { tipo: 'COMPROBANTE_DOMICILIO', etiqueta: 'comprobante de domicilio', archivo: docComprobante! },
        ] as const

        const resultados = await Promise.allSettled(
          documentos.map(async ({ tipo, archivo }) => {
            const folder = `clientes-documentos/${nuevoCliente.id}/${tipo}`
            const url = await fileService.upload(archivo, folder)
            await clienteService.agregarDocumento(nuevoCliente.id, tipo, url, archivo.name)
          }),
        )
        const documentosFallidos: string[] = resultados.flatMap((resultado, index) =>
          resultado.status === 'rejected' ? [documentos[index].etiqueta] : [],
        )

        if (documentosFallidos.length === 0) {
          toast.success('Cliente creado')
        } else {
          toast.error(
            `Cliente creado. No se pudieron guardar: ${documentosFallidos.join(', ')}. Agrégalos desde la pestaña Documentos.`,
            { duration: 8000 },
          )
        }
        setUploadingDocuments(false)
        onSaved()
      }
    } catch (e: any) {
      if (!isEdit) {
        const msg = e.message ?? e.error ?? 'Error al crear cliente'
        toast.error(msg, { duration: 5000 })
      }
    } finally {
      setUploadingDocuments(false)
      setIsProcessing(false)
    }
  }

  const firstFormError = getFirstClienteFormError(errors)

  const onInvalidSubmit = (formErrors: FieldErrors<ClienteForm>) => {
    const firstError = getFirstClienteFormError(formErrors)
    if (!firstError) {
      toast.error('No se pudo validar la informacion del cliente.')
      return
    }

    toast.error(`Revisa "${firstError.label}": ${firstError.message}`)
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>(`[name="${firstError.field}"]`)
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field?.focus({ preventScroll: true })
    })
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/45 flex items-start justify-center overflow-y-auto py-4 px-2"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] my-auto">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#3d6b35]" />
            <h3 className="font-semibold text-[15px] text-[#212529]">
              {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
          </div>
          <button type="button" onClick={requestClose} className="text-[#adb5bd] hover:text-[#495057] p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}>
          <div className="px-5 py-4 space-y-5 max-h-[75vh] overflow-y-auto">

            {firstFormError && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[12px] text-red-800" role="alert">
                <span className="font-semibold">Campo pendiente:</span>{' '}
                {firstFormError.label} - {firstFormError.message}
              </div>
            )}

            {/* ── SECCIÓN 1: Datos del Solicitante ── */}
            <section>
              <p className="sec-title">Datos del Solicitante</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Nombre(s) *" error={errors.nombre?.message}>
                  <input {...register('nombre')} className={`input ${errors.nombre ? 'input-error' : ''}`} placeholder="Nombre(s)" />
                </Field>
                <Field label="Apellido Paterno *" error={errors.apellido_paterno?.message}>
                  <input {...register('apellido_paterno')} className={`input ${errors.apellido_paterno ? 'input-error' : ''}`} placeholder="Apellido paterno" />
                </Field>
                <Field label="Apellido Materno" error={errors.apellido_materno?.message}>
                  <input {...register('apellido_materno')} className="input" placeholder="Apellido materno" />
                </Field>
                <Field label="Fecha de Nacimiento *" error={errors.fecha_nacimiento?.message}>
                  <input {...register('fecha_nacimiento')} type="date" className={`input ${errors.fecha_nacimiento ? 'input-error' : ''}`} />
                </Field>
                <Field label="Celular *" error={errors.celular?.message}>
                  <div className="relative">
                    <input
                      {...register('celular', {
                        setValueAs: normalizePhone,
                        onChange: (e) => checkCelular(normalizePhone(e.target.value)),
                      })}
                      className={`input pr-7 ${errors.celular || celularStatus === 'taken' ? 'input-error' : ''}`}
                      placeholder="10 dígitos"
                      inputMode="numeric"
                      onInput={sanitizePhoneInput}
                    />
                    <StatusIcon status={celularStatus} />
                  </div>
                  {celularStatus === 'taken' && <p className="text-[#dc2626] text-[11px] mt-0.5">Celular ya registrado</p>}
                  {celularStatus === 'error' && (
                    <p className="text-amber-700 text-[11px] mt-0.5">
                      No se pudo verificar el celular ahora; se volverá a validar al guardar.
                    </p>
                  )}
                </Field>
                <Field label="Teléfono fijo" error={errors.telefono_fijo?.message}>
                  <input
                    {...register('telefono_fijo', { setValueAs: normalizePhone })}
                    className={`input ${errors.telefono_fijo ? 'input-error' : ''}`}
                    placeholder="10 dígitos (opcional)"
                    inputMode="numeric"
                    onInput={sanitizePhoneInput}
                  />
                </Field>
                <Field label="Estado Civil *" error={errors.estado_civil?.message}>
                  <select {...register('estado_civil')} className={`input ${errors.estado_civil ? 'input-error' : ''}`}>
                    <option value="">Seleccionar</option>
                    <option value="SOLTERO">Soltero(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="UNION_LIBRE">Unión libre</option>
                  </select>
                </Field>
                <Field label="Nombre del cónyuge">
                  <input {...register('nombre_conyuge')} className="input" placeholder="Si aplica" />
                </Field>
              </div>
            </section>

            {/* ── SECCIÓN 2: Identificación ── */}
            <section>
              <p className="sec-title">Identificación</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="No. de INE *" error={errors.ine_numero?.message}>
                  <input {...register('ine_numero')} className={`input ${errors.ine_numero ? 'input-error' : ''}`} placeholder="Número de INE" />
                </Field>
                <Field label="CURP *" error={errors.curp?.message}>
                  <div className="relative">
                    <input
                      {...register('curp', {
                        setValueAs: normalizeCurp,
                        onChange: (e) => checkCurp(normalizeCurp(e.target.value)),
                      })}
                      className={`input pr-7 uppercase ${errors.curp || curpStatus === 'taken' ? 'input-error' : ''}`}
                      placeholder="18 caracteres"
                      inputMode="text"
                      onInput={sanitizeCurpInput}
                    />
                    <StatusIcon status={curpStatus} />
                  </div>
                  {curpStatus === 'taken' && <p className="text-[#dc2626] text-[11px] mt-0.5">CURP ya registrada</p>}
                  {curpStatus === 'error' && (
                    <p className="text-amber-700 text-[11px] mt-0.5">
                      No se pudo verificar la CURP ahora; se volverá a validar al guardar.
                    </p>
                  )}
                </Field>
                <Field label="RFC" error={errors.rfc?.message}>
                  <input
                    {...register('rfc', { setValueAs: normalizeRfc })}
                    className={`input uppercase ${errors.rfc ? 'input-error' : ''}`}
                    placeholder="12 o 13 caracteres (opcional)"
                    inputMode="text"
                    onInput={sanitizeRfcInput}
                  />
                </Field>
                <Field label="Tipo de identificación *" error={errors.ine_tipo?.message}>
                  <input {...register('ine_tipo')} className={`input ${errors.ine_tipo ? 'input-error' : ''}`} placeholder="INE, pasaporte..." />
                </Field>
              </div>
            </section>

            {!isEdit && checkingDuplicates && duplicateMatches.length === 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
                Verificando si el cliente ya está registrado...
              </div>
            )}

            {!isEdit && duplicateCheckError && duplicateMatches.length === 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-800" role="alert">
                {duplicateCheckError}
              </div>
            )}

            {!isEdit && duplicateMatches.length > 0 && (
              <div className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 space-y-3" role="alert">
                <div>
                  <p className="text-[14px] font-semibold text-red-800">Este cliente ya podría estar registrado</p>
                  <p className="text-[12px] text-red-700 mt-1">
                    No se puede crear otro registro. Revisa la coincidencia y utiliza el cliente existente.
                  </p>
                </div>
                {duplicateMatches.map((match) => (
                  <div key={match.id} className="rounded-md border border-red-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0 text-[12px] text-gray-700">
                      <p className="font-semibold text-[13px] text-gray-900">
                        {match.nombre_completo} {match.numero_cliente ? `· ${match.numero_cliente}` : ''}
                      </p>
                      <p>{match.celular} · {match.sucursal_nombre}</p>
                      <p>Asesor: {match.asesor_nombre ?? 'Sin asignar'}</p>
                      <p>
                        {match.activo ? 'Cliente activo' : 'Cliente inactivo'}
                        {match.tiene_credito_activo ? ' · Tiene crédito activo' : ' · Sin crédito activo'}
                      </p>
                      <p className="text-red-700 mt-1">
                        Coincide en: {match.coincidencias.join(', ')}
                      </p>
                    </div>
                    {canUseExisting(match) && onUseExisting ? (
                      <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => onUseExisting(match)}>
                        Usar cliente registrado
                      </button>
                    ) : (
                      <p className="text-[11px] text-amber-800 sm:max-w-[190px]">
                        Pertenece a otra cartera. Contacta a un supervisor para utilizar o reasignar el registro.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── SECCIÓN 3: Domicilio ── */}
            <section>
              <p className="sec-title">Domicilio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Calle *" error={errors.dom_calle?.message}>
                  <input {...register('dom_calle')} className={`input ${errors.dom_calle ? 'input-error' : ''}`} placeholder="Nombre de la calle" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="No. Exterior *" error={errors.dom_no_exterior?.message}>
                    <input {...register('dom_no_exterior')} className={`input ${errors.dom_no_exterior ? 'input-error' : ''}`} placeholder="Ext." />
                  </Field>
                  <Field label="No. Interior">
                    <input {...register('dom_no_interior')} className="input" placeholder="Int." />
                  </Field>
                </div>
                <Field label="Colonia *" error={errors.dom_colonia?.message}>
                  <input {...register('dom_colonia')} className={`input ${errors.dom_colonia ? 'input-error' : ''}`} placeholder="Colonia" />
                </Field>
                <Field label="Municipio *" error={errors.dom_municipio?.message}>
                  <input {...register('dom_municipio')} className={`input ${errors.dom_municipio ? 'input-error' : ''}`} placeholder="Municipio / Alcaldía" />
                </Field>
                <Field label="Estado *" error={errors.dom_estado?.message}>
                  <input {...register('dom_estado')} className={`input ${errors.dom_estado ? 'input-error' : ''}`} placeholder="Estado" />
                </Field>
                <Field label="C.P. *" error={errors.dom_codigo_postal?.message}>
                  <input {...register('dom_codigo_postal')} className={`input ${errors.dom_codigo_postal ? 'input-error' : ''}`} placeholder="00000" maxLength={5} />
                </Field>
                <Field label="Tipo de vivienda *" error={errors.dom_tipo_vivienda?.message}>
                  <select {...register('dom_tipo_vivienda')} className={`input ${errors.dom_tipo_vivienda ? 'input-error' : ''}`}>
                    <option value="">Seleccionar</option>
                    <option value="PROPIA">Propia</option>
                    <option value="RENTADA">Rentada</option>
                  </select>
                </Field>
                {domTipoVivienda === 'RENTADA' && (
                  <Field label="Monto de renta">
                    <input {...register('dom_monto_renta')} type="number" className="input" placeholder="$ al mes" />
                  </Field>
                )}
              </div>
            </section>

            {/* ── SECCIÓN 4: Datos del Negocio ── */}
            <section>
              <p className="sec-title">Datos del Negocio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Nombre del Negocio *" error={errors.negocio_nombre?.message}>
                  <input {...register('negocio_nombre')} className={`input ${errors.negocio_nombre ? 'input-error' : ''}`} placeholder="Nombre del negocio" />
                </Field>
                <Field label="Giro *" error={errors.negocio_giro?.message}>
                  <input {...register('negocio_giro')} className={`input ${errors.negocio_giro ? 'input-error' : ''}`} placeholder="Tipo de negocio" />
                </Field>
                <Field label="Antigüedad *" error={errors.negocio_antiguedad?.message}>
                  <input {...register('negocio_antiguedad')} className={`input ${errors.negocio_antiguedad ? 'input-error' : ''}`} placeholder="Ej. 3 años" />
                </Field>
              </div>

              {/* Dirección del negocio — obligatoria y en campos separados */}
              <p className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide mt-4 mb-2">
                Dirección del Negocio
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Calle *" error={errors.negocio_calle?.message}>
                  <input {...register('negocio_calle')} className={`input ${errors.negocio_calle ? 'input-error' : ''}`} placeholder="Nombre de la calle" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="No. Exterior *" error={errors.negocio_no_exterior?.message}>
                    <input {...register('negocio_no_exterior')} className={`input ${errors.negocio_no_exterior ? 'input-error' : ''}`} placeholder="Ext." />
                  </Field>
                  <Field label="No. Interior">
                    <input {...register('negocio_no_interior')} className="input" placeholder="Int." />
                  </Field>
                </div>
                <Field label="Colonia *" error={errors.negocio_colonia?.message}>
                  <input {...register('negocio_colonia')} className={`input ${errors.negocio_colonia ? 'input-error' : ''}`} placeholder="Colonia" />
                </Field>
                <Field label="Municipio *" error={errors.negocio_municipio?.message}>
                  <input {...register('negocio_municipio')} className={`input ${errors.negocio_municipio ? 'input-error' : ''}`} placeholder="Municipio / Alcaldía" />
                </Field>
                <Field label="Estado *" error={errors.negocio_estado?.message}>
                  <input {...register('negocio_estado')} className={`input ${errors.negocio_estado ? 'input-error' : ''}`} placeholder="Estado" />
                </Field>
                <Field label="C.P. *" error={errors.negocio_cp?.message}>
                  <input {...register('negocio_cp')} className={`input ${errors.negocio_cp ? 'input-error' : ''}`} placeholder="00000" maxLength={5} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                <Field label="Tipo de local *" error={errors.negocio_tipo_local?.message}>
                  <select {...register('negocio_tipo_local')} className={`input ${errors.negocio_tipo_local ? 'input-error' : ''}`}>
                    <option value="">Seleccionar</option>
                    <option value="PROPIO">Propio</option>
                    <option value="RENTADO">Rentado</option>
                  </select>
                </Field>
                <Field label="Monto de renta del negocio">
                  <input {...register('negocio_monto_renta')} type="number" className="input" placeholder="$ al mes" />
                </Field>
                <Field label="Horarios">
                  <input {...register('negocio_horarios')} className="input" placeholder="Ej. Lun-Vie 9-18h" />
                </Field>
                <Field label="Ingresos semanales *" error={errors.ingresos_semanales?.message}>
                  <input {...register('ingresos_semanales')} type="number" className={`input ${errors.ingresos_semanales ? 'input-error' : ''}`} placeholder="$ estimado" />
                </Field>
              </div>

              {/* ── Ubicación del negocio ── */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide mb-2">
                  Ubicación del negocio{!isEdit ? ' *' : ' (opcional)'}
                </p>
                <BusinessMap
                  lat={mapLat}
                  lng={mapLng}
                  onChange={(lat, lng) => {
                    setMapLat(lat === 0 && lng === 0 ? null : lat)
                    setMapLng(lat === 0 && lng === 0 ? null : lng)
                  }}
                />
                {!isEdit && formSubmitted && (mapLat === null || mapLng === null) && (
                  <p className="text-[#dc2626] text-[11px] mt-1">Marca la ubicación del negocio en el mapa</p>
                )}
              </div>
            </section>

            {/* ── SECCIÓN: Documentos (solo creación) ── */}
            {!isEdit && (
              <section>
                <p className="sec-title">Documentos</p>
                <p className="text-[12px] text-[#6c757d] mb-3">
                  Los tres documentos son obligatorios. Primero se validará y creará al cliente;
                  después se subirán los archivos seleccionados.
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[12px] font-medium text-[#495057] mb-1.5">INE — Frente *</p>
                    <FileUpload
                      accept="image/*,.pdf"
                      compress
                      deferUpload
                      label="Foto del frente del INE"
                      onFileReady={setDocIneFrente}
                      onBusyChange={setDocIneFrenteBusy}
                    />
                    {formSubmitted && !docIneFrente && (
                      <p className="text-[#dc2626] text-[11px] mt-0.5">Requerido</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[#495057] mb-1.5">INE — Reverso *</p>
                    <FileUpload
                      accept="image/*,.pdf"
                      compress
                      deferUpload
                      label="Foto del reverso del INE"
                      onFileReady={setDocIneReverso}
                      onBusyChange={setDocIneReversoBusy}
                    />
                    {formSubmitted && !docIneReverso && (
                      <p className="text-[#dc2626] text-[11px] mt-0.5">Requerido</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[#495057] mb-1.5">Comprobante de domicilio *</p>
                    <FileUpload
                      accept="image/*,.pdf"
                      compress
                      deferUpload
                      label="Foto o PDF del comprobante de domicilio"
                      onFileReady={setDocComprobante}
                      onBusyChange={setDocComprobanteBusy}
                    />
                    {formSubmitted && !docComprobante && (
                      <p className="text-[#dc2626] text-[11px] mt-0.5">Requerido</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ── SECCIÓN 5: Referencias Personales ── */}
            <section>
              <p className="sec-title">Referencias Personales</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Ref. 1 — Nombre *" error={errors.ref1_nombre?.message}>
                    <input {...register('ref1_nombre')} className={`input ${errors.ref1_nombre ? 'input-error' : ''}`} placeholder="Nombre" />
                  </Field>
                  <Field label="Teléfono *" error={errors.ref1_telefono?.message}>
                    <input {...register('ref1_telefono', { setValueAs: normalizePhone })} className={`input ${errors.ref1_telefono ? 'input-error' : ''}`} placeholder="10 dígitos" inputMode="numeric" onInput={sanitizePhoneInput} />
                  </Field>
                  <Field label="Parentesco *" error={errors.ref1_parentesco?.message}>
                    <input {...register('ref1_parentesco')} className={`input ${errors.ref1_parentesco ? 'input-error' : ''}`} placeholder="Familiar, amigo..." />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Ref. 2 — Nombre *" error={errors.ref2_nombre?.message}>
                    <input {...register('ref2_nombre')} className={`input ${errors.ref2_nombre ? 'input-error' : ''}`} placeholder="Nombre" />
                  </Field>
                  <Field label="Teléfono *" error={errors.ref2_telefono?.message}>
                    <input {...register('ref2_telefono', { setValueAs: normalizePhone })} className={`input ${errors.ref2_telefono ? 'input-error' : ''}`} placeholder="10 dígitos" inputMode="numeric" onInput={sanitizePhoneInput} />
                  </Field>
                  <Field label="Parentesco *" error={errors.ref2_parentesco?.message}>
                    <input {...register('ref2_parentesco')} className={`input ${errors.ref2_parentesco ? 'input-error' : ''}`} placeholder="Familiar, amigo..." />
                  </Field>
                </div>
              </div>
            </section>

            {/* ── SECCIÓN AVAL (colapsable) ── */}
            <section>
              <button
                type="button"
                onClick={() => setAvalOpen((v) => !v)}
                className="flex items-center gap-2 text-[13px] font-medium text-[#3d6b35] hover:text-[#2d5229] transition-colors"
              >
                <span className="text-[16px]">{avalOpen ? '▾' : '▸'}</span>
                {avalOpen ? 'Ocultar aval' : 'Agregar aval (opcional)'}
              </button>
              {avalOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Field label="Nombre del aval">
                    <input {...register('aval_nombre')} className="input" placeholder="Nombre completo" />
                  </Field>
                  <Field label="Teléfono" error={errors.aval_telefono?.message}>
                    <input {...register('aval_telefono', { setValueAs: normalizePhone })} className={`input ${errors.aval_telefono ? 'input-error' : ''}`} placeholder="10 dígitos (opcional)" inputMode="numeric" onInput={sanitizePhoneInput} />
                  </Field>
                  <Field label="Dirección">
                    <input {...register('aval_direccion')} className="input" placeholder="Dirección completa" />
                  </Field>
                  <Field label="No. de identificación">
                    <input {...register('aval_identificacion')} className="input" placeholder="INE, CURP..." />
                  </Field>
                </div>
              )}
            </section>

            {/* ── ASIGNACIÓN ── */}
            {(puedeAsignarAsesor || puedeAsignarSucursal) && (
              <section>
                <p className="sec-title">Asignación</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {puedeAsignarAsesor && (
                    <Field label="Asesor" error={errors.asesor_id?.message}>
                      <select {...register('asesor_id')} className="input">
                        <option value="">Sin asignar</option>
                        {asesores.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {puedeAsignarSucursal && (
                    <Field label="Sucursal *" error={errors.sucursal_id?.message}>
                      <select {...register('sucursal_id')} className={`input ${errors.sucursal_id ? 'input-error' : ''}`}>
                        <option value="">Seleccionar sucursal</option>
                        {sucursales.map((s) => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={requestClose} className="btn">Cancelar</button>
            <button type="submit" disabled={isPending || isProcessing || hasPendingDocumentProcessing || checkingDuplicates || duplicateMatches.length > 0 || curpStatus === 'taken' || celularStatus === 'taken'} className="btn-primary">
              {checkingDuplicates ? 'Verificando cliente...' : hasPendingDocumentProcessing ? 'Procesando documentos...' : isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>

      <ProcessingOverlay
        visible={isProcessing || isPending}
        title={uploadingDocuments ? 'Guardando documentos' : isEdit ? 'Actualizando cliente' : 'Creando cliente'}
        message={uploadingDocuments
          ? 'El cliente ya fue creado. Estamos subiendo y asociando sus documentos.'
          : 'Estamos validando y guardando la información. Los documentos todavía no se han enviado.'}
      />
    </div>
  )
}

// ── Field helper ──────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#495057] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[#dc2626] text-[11px] mt-0.5">{error}</p>}
    </div>
  )
}

// ── Status icon para CURP/celular ─────────────────────────────────
function StatusIcon({ status }: { status: AvailabilityStatus }) {
  if (status === 'idle') return null
  return (
    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px]">
      {status === 'checking' && <span className="text-[#adb5bd]">⟳</span>}
      {status === 'ok'       && <span className="text-[#16a34a]">✓</span>}
      {status === 'taken'    && <span className="text-[#dc2626]">✗</span>}
      {status === 'error'    && <span className="text-amber-600">!</span>}
    </span>
  )
}
