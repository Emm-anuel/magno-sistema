import { useState, useCallback, useRef, useEffect } from 'react'
import BusinessMap from '@/components/BusinessMap'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Pencil, Power, X, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { api, clienteService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useCajaOperativa } from '@/hooks/useCajaOperativa'
import CajaOperativaBanner from '@/components/caja/CajaOperativaBanner'
import ProcessingOverlay from '@/components/ProcessingOverlay'
import type {
  EstadoCliente,
  ClienteResumen,
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
const clienteSchema = z.object({
  nombre:              z.string().min(1, 'Requerido'),
  apellido_paterno:    z.string().min(1, 'Requerido'),
  apellido_materno:    z.string().optional(),
  fecha_nacimiento:    z.string().min(1, 'Requerido'),
  estado_civil:        z.enum(['SOLTERO', 'CASADO', 'UNION_LIBRE'] as const),
  nombre_conyuge:      z.string().optional(),
  telefono_fijo:       z.string().optional(),
  celular:             z.string().regex(/^\d{10}$/, '10 dígitos'),
  ine_tipo:            z.string().optional(),
  ine_numero:          z.string().min(1, 'Requerido'),
  curp:                z.string().length(18, 'Exactamente 18 caracteres'),
  rfc:                 z.string().optional(),
  dom_calle:           z.string().min(1, 'Requerido'),
  dom_no_exterior:     z.string().min(1, 'Requerido'),
  dom_no_interior:     z.string().optional(),
  dom_colonia:         z.string().min(1, 'Requerido'),
  dom_municipio:       z.string().min(1, 'Requerido'),
  dom_estado:          z.string().min(1, 'Requerido'),
  dom_codigo_postal:   z.string().min(4, 'Requerido'),
  dom_tipo_vivienda:   z.string().optional(),
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
  negocio_tipo_local:  z.string().optional(),
  negocio_monto_renta: z.coerce.number().optional(),
  negocio_horarios:    z.string().optional(),
  negocio_lat:         z.coerce.number().optional(),
  negocio_lng:         z.coerce.number().optional(),
  ingresos_semanales:  z.coerce.number().optional(),
  gastos_semanales:    z.coerce.number().optional(),
  gastos_renta:        z.coerce.number().optional(),
  gastos_otros:        z.coerce.number().optional(),
  ref1_nombre:         z.string().min(1, 'Requerido'),
  ref1_telefono:       z.string().min(10, 'Mínimo 10 dígitos'),
  ref1_parentesco:     z.string().min(1, 'Requerido'),
  ref2_nombre:         z.string().min(1, 'Requerido'),
  ref2_telefono:       z.string().min(10, 'Mínimo 10 dígitos'),
  ref2_parentesco:     z.string().min(1, 'Requerido'),
  aval_nombre:         z.string().optional(),
  aval_telefono:       z.string().optional(),
  aval_direccion:      z.string().optional(),
  aval_identificacion: z.string().optional(),
  asesor_id:           z.coerce.number().optional(),
  sucursal_id:         z.coerce.number().min(1, 'Requerido'),
})

type ClienteForm = z.infer<typeof clienteSchema>

// ── Helper ─────────────────────────────────────────────────────────
function initials(name: string) {
  if (!name?.trim()) return 'CL'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Componente principal ──────────────────────────────────────────
export default function ClientesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { usuario } = useAuthStore()
  const { bannerVariant, horaLimite, bloqueado } = useCajaOperativa()

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
  const puedeAsignarSucursal =
    usuario?.rol === 'ADMINISTRADOR' ||
    usuario?.rol === 'SUPERVISOR'

  const { data, isLoading, error } = useQuery({
    queryKey: ['clientes', usuario?.id, usuario?.rol, { buscar, filtroEstado, filtroAsesor, filtroSucursal, pagina }],
    queryFn: () => clienteService.listar({
      buscar:      buscar || undefined,
      estado:      filtroEstado || undefined,
      asesorId:    filtroAsesor || undefined,
      sucursalId:  filtroSucursal || undefined,
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
              placeholder="Nombre, celular, CURP..."
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
                      <td colSpan={7} className="text-center text-[#adb5bd] py-8">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    clientes.map((c) => (
                      <tr key={c.id}>
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
  onClose: () => void
  onSaved: () => void
}

export function ClienteModal({ cliente, sucursales, asesores, puedeAsignarAsesor, puedeAsignarSucursal, onClose, onSaved }: ModalProps) {
  const isEdit = !!cliente
  const { usuario: authUsuario } = useAuthStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [avalOpen, setAvalOpen] = useState(!!cliente?.aval_nombre)
  const [mapLat, setMapLat] = useState<number | null>(
    cliente?.negocio_lat != null ? Number(cliente.negocio_lat) : null
  )
  const [mapLng, setMapLng] = useState<number | null>(
    cliente?.negocio_lng != null ? Number(cliente.negocio_lng) : null
  )
  const [curpStatus, setCurpStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const [celularStatus, setCelularStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const curpTimeout = useRef<ReturnType<typeof setTimeout>>()
  const celularTimeout = useRef<ReturnType<typeof setTimeout>>()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
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
      // Para create mode: auto-fill sucursal del usuario actual si no es admin
      sucursal_id: authUsuario?.sucursal?.id ?? 0,
    },
  })

  const domTipoVivienda = watch('dom_tipo_vivienda')

  const createMutation = useMutation({
    mutationFn: (data: ClienteCreateRequest) => clienteService.crear(data),
    onSuccess: () => { toast.success('Cliente creado'); onSaved() },
    onError: (e: any) => {
      const msg = e.message ?? e.error ?? 'Error al crear cliente'
      toast.error(msg, { duration: 5000 })
    },
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

  const checkCurp = useCallback((curp: string) => {
    clearTimeout(curpTimeout.current)
    if (curp.length !== 18) { setCurpStatus('idle'); return }
    if (isEdit && curp === cliente?.curp) { setCurpStatus('ok'); return }
    setCurpStatus('checking')
    curpTimeout.current = setTimeout(async () => {
      const ok = await clienteService.verificarCurp(curp, isEdit ? cliente!.id : undefined)
      setCurpStatus(ok ? 'ok' : 'taken')
    }, 400)
  }, [isEdit, cliente])

  const checkCelular = useCallback((celular: string) => {
    clearTimeout(celularTimeout.current)
    if (celular.length !== 10) { setCelularStatus('idle'); return }
    if (isEdit && celular === cliente?.celular) { setCelularStatus('ok'); return }
    setCelularStatus('checking')
    celularTimeout.current = setTimeout(async () => {
      const ok = await clienteService.verificarCelular(celular, isEdit ? cliente!.id : undefined)
      setCelularStatus(ok ? 'ok' : 'taken')
    }, 400)
  }, [isEdit, cliente])

  const onSubmit = async (data: ClienteForm) => {
    if (curpStatus === 'taken') { toast.error('El CURP ya está registrado'); return }
    if (celularStatus === 'taken') { toast.error('El celular ya está registrado'); return }

    const payload: ClienteCreateRequest = {
      ...data,
      fecha_nacimiento:    data.fecha_nacimiento,
      dom_monto_renta:     data.dom_monto_renta     || undefined,
      negocio_monto_renta: data.negocio_monto_renta || undefined,
      ingresos_semanales:  data.ingresos_semanales  || undefined,
      gastos_semanales:    data.gastos_semanales     || undefined,
      gastos_renta:        data.gastos_renta         || undefined,
      gastos_otros:        data.gastos_otros         || undefined,
      // Forzar asesor/sucursal según rol
      asesor_id:    puedeAsignarAsesor    ? (data.asesor_id || undefined)    : authUsuario?.id,
      sucursal_id:  puedeAsignarSucursal  ? data.sucursal_id                 : authUsuario!.sucursal.id,
      negocio_lat:  mapLat ?? undefined,
      negocio_lng:  mapLng ?? undefined,
    }

    setIsProcessing(true)

    try {
      if (isEdit) {
        await editMutation.mutateAsync({ id: cliente!.id, data: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/45 flex items-start justify-center overflow-y-auto py-4 px-2"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
          <button onClick={onClose} className="text-[#adb5bd] hover:text-[#495057] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-5 py-4 space-y-5 max-h-[75vh] overflow-y-auto">

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
                      {...register('celular', { onChange: (e) => checkCelular(e.target.value) })}
                      className={`input pr-7 ${errors.celular || celularStatus === 'taken' ? 'input-error' : ''}`}
                      placeholder="10 dígitos"
                      maxLength={10}
                    />
                    <StatusIcon status={celularStatus} />
                  </div>
                  {celularStatus === 'taken' && <p className="text-[#dc2626] text-[11px] mt-0.5">Celular ya registrado</p>}
                </Field>
                <Field label="Teléfono fijo">
                  <input {...register('telefono_fijo')} className="input" placeholder="Opcional" />
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
                      {...register('curp', { onChange: (e) => checkCurp(e.target.value.toUpperCase()) })}
                      className={`input pr-7 uppercase ${errors.curp || curpStatus === 'taken' ? 'input-error' : ''}`}
                      placeholder="18 caracteres"
                      maxLength={18}
                    />
                    <StatusIcon status={curpStatus} />
                  </div>
                  {curpStatus === 'taken' && <p className="text-[#dc2626] text-[11px] mt-0.5">CURP ya registrada</p>}
                </Field>
                <Field label="RFC">
                  <input {...register('rfc')} className="input uppercase" placeholder="Opcional" maxLength={13} />
                </Field>
                <Field label="Tipo de identificación">
                  <input {...register('ine_tipo')} className="input" placeholder="INE, pasaporte..." />
                </Field>
              </div>
            </section>

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
                <Field label="Tipo de vivienda">
                  <select {...register('dom_tipo_vivienda')} className="input">
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
                <Field label="Tipo de local">
                  <select {...register('negocio_tipo_local')} className="input">
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
                <Field label="Ingresos semanales">
                  <input {...register('ingresos_semanales')} type="number" className="input" placeholder="$ estimado" />
                </Field>
              </div>

              {/* ── Ubicación del negocio ── */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide mb-2">
                  Ubicación del negocio (opcional)
                </p>
                <BusinessMap
                  lat={mapLat}
                  lng={mapLng}
                  onChange={(lat, lng) => {
                    setMapLat(lat === 0 && lng === 0 ? null : lat)
                    setMapLng(lat === 0 && lng === 0 ? null : lng)
                  }}
                />
              </div>
            </section>

            {/* ── SECCIÓN 5: Referencias Personales ── */}
            <section>
              <p className="sec-title">Referencias Personales</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Ref. 1 — Nombre *" error={errors.ref1_nombre?.message}>
                    <input {...register('ref1_nombre')} className={`input ${errors.ref1_nombre ? 'input-error' : ''}`} placeholder="Nombre" />
                  </Field>
                  <Field label="Teléfono *" error={errors.ref1_telefono?.message}>
                    <input {...register('ref1_telefono')} className={`input ${errors.ref1_telefono ? 'input-error' : ''}`} placeholder="10 dígitos" />
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
                    <input {...register('ref2_telefono')} className={`input ${errors.ref2_telefono ? 'input-error' : ''}`} placeholder="10 dígitos" />
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
                  <Field label="Teléfono">
                    <input {...register('aval_telefono')} className="input" placeholder="10 dígitos" />
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
            <button type="button" onClick={onClose} className="btn">Cancelar</button>
            <button type="submit" disabled={isPending || curpStatus === 'taken' || celularStatus === 'taken'} className="btn-primary">
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>

      <ProcessingOverlay
        visible={isProcessing || isPending}
        title={isEdit ? 'Actualizando cliente' : 'Creando cliente'}
        message="Estamos guardando la información. Este proceso puede tardar unos segundos."
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
function StatusIcon({ status }: { status: 'idle' | 'checking' | 'ok' | 'taken' }) {
  if (status === 'idle') return null
  return (
    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px]">
      {status === 'checking' && <span className="text-[#adb5bd]">⟳</span>}
      {status === 'ok'       && <span className="text-[#16a34a]">✓</span>}
      {status === 'taken'    && <span className="text-[#dc2626]">✗</span>}
    </span>
  )
}
