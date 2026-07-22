import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Pencil, Power, X, Upload, Maximize2, UserSearch } from 'lucide-react'
import { api, usuarioService, fileService } from '@/services/api'
import { ROL_LABELS } from '@/types'
import type { Rol, Usuario, UsuarioCreateRequest, UsuarioUpdateRequest } from '@/types'
import ImagePreviewModal from '@/components/ImagePreviewModal'
import ProcessingOverlay from '@/components/ProcessingOverlay'

// ── Tipos ─────────────────────────────────────────────────────────
const ROLES: Rol[] = ['ADMINISTRADOR', 'SUPERVISOR', 'SUPERVISOR_CAMPO', 'ASESOR_COBRADOR']
const USUARIOS_OCULTOS = new Set(['admin@magno.mx'])

// ── Esquema de validación ─────────────────────────────────────────
const baseSchema = {
  nombre_completo: z.string().min(2, 'Requerido'),
  email:           z.string().email('Correo inválido'),
  telefono:        z.string().min(10, 'Mínimo 10 dígitos'),
  rol:             z.enum(['ADMINISTRADOR', 'SUPERVISOR', 'SUPERVISOR_CAMPO', 'ASESOR_COBRADOR'] as const),
  sucursal_id:     z.coerce.number().min(1, 'Requerido'),
  calle:           z.string().min(1, 'Requerido'),
  no_exterior:     z.string().min(1, 'Requerido'),
  no_interior:     z.string().optional(),
  colonia:         z.string().min(1, 'Requerido'),
  municipio:       z.string().min(1, 'Requerido'),
  estado:          z.string().min(1, 'Requerido'),
  codigo_postal:   z.string().min(4, 'Requerido'),
  ine_numero:      z.string().min(1, 'Requerido'),
  ine_imagen_url:  z.string().min(1, 'Requerido'),
  ine_imagen_reverso_url: z.string().min(1, 'Requerido'),
  ref1_nombre:     z.string().min(1, 'Requerido'),
  ref1_telefono:   z.string().min(10, 'Mínimo 10 dígitos'),
  ref1_parentesco: z.string().min(1, 'Requerido'),
  ref2_nombre:     z.string().min(1, 'Requerido'),
  ref2_telefono:   z.string().min(10, 'Mínimo 10 dígitos'),
  ref2_parentesco: z.string().min(1, 'Requerido'),
}

const createSchema = z.object({
  ...baseSchema,
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

const editSchema = z.object({
  ...baseSchema,
  password: z.string().min(6, 'Mínimo 6 caracteres').or(z.literal('')).optional(),
})

type CreateForm = z.infer<typeof createSchema>
const PASSWORD_MASK = '••••••••'

// ── Helpers ───────────────────────────────────────────────────────
function initials(name: string) {
  if (!name?.trim()) return 'US'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Componente principal ──────────────────────────────────────────
export default function UsuariosPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<Rol | ''>('')
  const [filtroActivo, setFiltroActivo] = useState<boolean | ''>('')

  // Modal
  const [modal, setModal] = useState<{ open: boolean; usuario: Usuario | null }>({
    open: false,
    usuario: null,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuarioService.listar({ size: 200 }),
  })

  const { data: sucursalesData } = useQuery({
    queryKey: ['sucursales-list'],
    queryFn: () => api.get<{ id: number; nombre: string }[]>('/sucursales').then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      usuarioService.cambiarEstado(id, activo),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('Error al cambiar estado'),
  })

  // Ocultar cuentas internas únicamente de esta pantalla administrativa.
  const usuariosVisibles = (data?.content ?? []).filter(
    (u) => !USUARIOS_OCULTOS.has(u.email.trim().toLowerCase())
  )

  // Filtrar localmente
  const usuarios = usuariosVisibles.filter((u) => {
    const q = busqueda.toLowerCase()
    const matchQ = !q || u.nombre_completo.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRol = !filtroRol || u.rol === filtroRol
    const matchActivo = filtroActivo === '' || u.activo === filtroActivo
    return matchQ && matchRol && matchActivo
  })

  // Métricas
  const total = usuariosVisibles.length
  const activos = usuariosVisibles.filter((u) => u.activo).length
  const conIne = usuariosVisibles.filter((u) => u.ine_imagen_url).length

  return (
    <div>
      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="metric-card">
          <p className="metric-label">Total usuarios</p>
          <p className="metric-val">{total}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Activos</p>
          <p className="metric-val text-[#2d6a4f]">{activos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Inactivos</p>
          <p className="metric-val text-[#adb5bd]">{total - activos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Con INE cargado</p>
          <p className="metric-val">{conIne}</p>
        </div>
      </div>

      {/* ── Tabla / lista ── */}
      <div className="card">
        <div className="card-header flex-wrap gap-2">
          <span className="card-title">Usuarios del sistema</span>
          <button
            className="btn-primary"
            onClick={() => setModal({ open: true, usuario: null })}
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>

        {/* Filtros */}
        <div className="px-[18px] py-3 border-b border-[#e9ecef] flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Buscar por nombre o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input max-w-xs"
          />
          <select
            className="input w-auto"
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value as Rol | '')}
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROL_LABELS[r]}</option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={String(filtroActivo)}
            onChange={(e) => {
              const v = e.target.value
              setFiltroActivo(v === '' ? '' : v === 'true')
            }}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        {/* Tabla desktop */}
        {isLoading ? (
          <p className="text-center text-[#adb5bd] py-10 text-[13px]">Cargando...</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Sucursal</th>
                    <th className="text-center">INE</th>
                    <th className="text-center">Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>

                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-[#adb5bd] py-8">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#d1fae5] flex items-center justify-center text-[11px] font-semibold text-[#065f46] shrink-0">
                              {initials(u.nombre_completo)}
                            </div>
                            <div>
                              <p className="font-medium text-[#212529]">{u.nombre_completo}</p>
                              <p className="text-[11px] text-[#adb5bd]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <RolBadge rol={u.rol} />
                        </td>
                        <td className="text-[#495057]">{u.sucursal.nombre}</td>
                        <td className="text-center">
                          {u.ine_imagen_url ? (
                            <span className="text-[#2d6a4f] font-semibold text-[13px]">✓</span>
                          ) : (
                            <span className="text-[#adb5bd] text-[12px]">—</span>
                          )}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${u.activo ? 'badge-verde' : 'badge-rojo'}`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="btn btn-sm"
                              onClick={() => navigate(`/usuarios/${u.id}`)}
                              title="Ver detalle"
                            >
                              <UserSearch className="w-3.5 h-3.5" />
                              Detalle
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setModal({ open: true, usuario: u })}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              className={`btn btn-sm ${u.activo ? '' : 'border-[#bbf7d0] text-[#2d6a4f] hover:bg-[#f0fdf4]'}`}
                              onClick={() => toggleMutation.mutate({ id: u.id, activo: !u.activo })}
                              title={u.activo ? 'Desactivar' : 'Activar'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
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
              {usuarios.length === 0 ? (
                <p className="text-center text-[#adb5bd] py-8 text-[13px]">Sin resultados</p>
              ) : (
                usuarios.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-[#d1fae5] flex items-center justify-center text-[13px] font-semibold text-[#065f46] shrink-0">
                      {initials(u.nombre_completo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#212529] text-[13px] truncate">{u.nombre_completo}</p>
                      <p className="text-[11px] text-[#adb5bd] truncate">{ROL_LABELS[u.rol]} · {u.sucursal.nombre}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`badge ${u.activo ? 'badge-verde' : 'badge-rojo'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => navigate(`/usuarios/${u.id}`)}
                        title="Ver detalle"
                      >
                        <UserSearch className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => setModal({ open: true, usuario: u })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal de alta / edición ── */}
      {modal.open && (
        <UsuarioModal
          usuario={modal.usuario}
          sucursales={sucursalesData ?? []}
          onClose={() => setModal({ open: false, usuario: null })}
          onSaved={() => setModal({ open: false, usuario: null })}
        />
      )}

    </div>
  )
}

// ── Badge de Rol ──────────────────────────────────────────────────
function RolBadge({ rol }: { rol: Rol }) {
  const map: Record<Rol, string> = {
    ADMINISTRADOR:    'badge-azul',
    SUPERVISOR:       'badge-verde',
    SUPERVISOR_CAMPO: 'badge-amarillo',
    ASESOR_COBRADOR:  'badge-gris',
  }
  return <span className={`badge ${map[rol]}`}>{ROL_LABELS[rol]}</span>
}

// ── Modal de Alta / Edición ───────────────────────────────────────
interface ModalProps {
  usuario: Usuario | null
  sucursales: { id: number; nombre: string }[]
  onClose: () => void
  onSaved: () => void
}

function UsuarioModal({ usuario, sucursales, onClose, onSaved }: ModalProps) {
  const isEdit = !!usuario
  const qc = useQueryClient()
  const [isProcessing, setIsProcessing] = useState(false)
  const [ineFile, setIneFile] = useState<File | null>(null)
  const [inePreview, setInePreview] = useState<string>(usuario?.ine_imagen_url ?? '')
  const [ineImgSrc, setIneImgSrc] = useState<string>(usuario?.ine_imagen_url ?? '')
  const [ineReversoFile, setIneReversoFile] = useState<File | null>(null)
  const [ineReversoPreview, setIneReversoPreview] = useState<string>(usuario?.ine_imagen_reverso_url ?? '')
  const [ineReversoImgSrc, setIneReversoImgSrc] = useState<string>(usuario?.ine_imagen_reverso_url ?? '')
  const [ineFullPreview, setIneFullPreview] = useState(false)
  const [ineReversoFullPreview, setIneReversoFullPreview] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [passwordModified, setPasswordModified] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputReversoRef = useRef<HTMLInputElement>(null)

  const schema = isEdit ? editSchema : createSchema

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: isEdit
      ? {
          nombre_completo: usuario.nombre_completo,
          email:           usuario.email,
          telefono:        usuario.telefono,
          rol:             usuario.rol,
          sucursal_id:     usuario.sucursal.id,
          calle:           usuario.calle ?? '',
          no_exterior:     usuario.no_exterior ?? '',
          no_interior:     usuario.no_interior ?? '',
          colonia:         usuario.colonia ?? '',
          municipio:       usuario.municipio ?? '',
          estado:          usuario.estado ?? '',
          codigo_postal:   usuario.codigo_postal ?? '',
          ine_numero:      usuario.ine_numero ?? '',
          ine_imagen_url:  usuario.ine_imagen_url ?? '',
          ine_imagen_reverso_url: usuario.ine_imagen_reverso_url ?? '',
          ref1_nombre:     usuario.ref1_nombre ?? '',
          ref1_telefono:   usuario.ref1_telefono ?? '',
          ref1_parentesco: usuario.ref1_parentesco ?? '',
          ref2_nombre:     usuario.ref2_nombre ?? '',
          ref2_telefono:   usuario.ref2_telefono ?? '',
          ref2_parentesco: usuario.ref2_parentesco ?? '',
          password:        PASSWORD_MASK,
        }
      : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: UsuarioCreateRequest) => usuarioService.crear(data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario creado')
      onSaved()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al crear usuario'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UsuarioUpdateRequest }) =>
      usuarioService.actualizar(id, data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario actualizado')
      onSaved()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al actualizar'),
  })

  const isPending = createMutation.isPending || editMutation.isPending

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIneFile(file)
    const objectUrl = URL.createObjectURL(file)
    setInePreview(objectUrl)
    setIneImgSrc(objectUrl)
    setValue('ine_imagen_url', objectUrl, { shouldDirty: true, shouldValidate: true })
  }

  const handleReversoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIneReversoFile(file)
    const objectUrl = URL.createObjectURL(file)
    setIneReversoPreview(objectUrl)
    setIneReversoImgSrc(objectUrl)
    setValue('ine_imagen_reverso_url', objectUrl, { shouldDirty: true, shouldValidate: true })
  }

  const handleIneImgError = async (
    currentSrc: string,
    previewUrl: string,
    setImgSrc: (src: string) => void,
  ) => {
    if (currentSrc !== previewUrl || previewUrl.startsWith('blob:')) return
    const token = localStorage.getItem('magno_token')
    try {
      const res = await fetch(`/api/files/download?url=${encodeURIComponent(previewUrl)}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setImgSrc(URL.createObjectURL(blob))
    } catch {
      setImgSrc('')   // oculta el img y muestra la zona de upload
    }
  }

  const onSubmit = async (formData: CreateForm) => {
    setIsProcessing(true)

    try {
      let ineUrl = formData.ine_imagen_url ?? ''
      let ineReversoUrl = formData.ine_imagen_reverso_url ?? ''

      // 1. Subir imagen si hay una nueva seleccionada
      if (ineFile) {
        try {
          ineUrl = await fileService.upload(ineFile, 'usuarios-ine')
        } catch {
          toast.error('Error al subir imagen INE')
          return
        }
        setValue('ine_imagen_url', ineUrl)
      }

      if (ineReversoFile) {
        try {
          ineReversoUrl = await fileService.upload(ineReversoFile, 'usuarios-ine-reverso')
        } catch {
          toast.error('Error al subir reverso de INE')
          return
        }
        setValue('ine_imagen_reverso_url', ineReversoUrl)
      }

      const payload = { ...formData, ine_imagen_url: ineUrl, ine_imagen_reverso_url: ineReversoUrl }

      if (isEdit) {
        if (!passwordModified || !payload.password) {
          delete (payload as any).password
        }
        await editMutation.mutateAsync({ id: usuario!.id, data: payload as UsuarioUpdateRequest })
      } else {
        await createMutation.mutateAsync(payload as UsuarioCreateRequest)
      }
    } catch {
      return
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/45 flex items-start justify-center overflow-y-auto py-4 px-2"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] my-auto">
        {/* Header */}
        <div className="modal-header">
          <h3 className="font-semibold text-[15px] text-[#212529]">
            {isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h3>
          <button onClick={onClose} className="text-[#adb5bd] hover:text-[#495057] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-5 py-4 space-y-5">

            {/* ── Datos Personales ── */}
            <section>
              <p className="sec-title">Datos Personales</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nombre Completo *" error={errors.nombre_completo?.message}>
                  <input {...register('nombre_completo')} className={`input ${errors.nombre_completo ? 'input-error' : ''}`} placeholder="Nombre completo" />
                </Field>

                <Field label="Correo Electrónico *" error={errors.email?.message}>
                  <input {...register('email')} type="email" className={`input ${errors.email ? 'input-error' : ''}`} placeholder="correo@magno.com" disabled={isEdit} />
                </Field>

                <Field label={isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'} error={errors.password?.message}>
                  <input
                    {...register('password')}
                    type={showPass ? 'text' : 'password'}
                    className={`input ${errors.password ? 'input-error' : ''}`}
                    placeholder={isEdit ? PASSWORD_MASK : 'Mínimo 6 caracteres'}
                    onFocus={() => {
                      if (isEdit && getValues('password') === PASSWORD_MASK) {
                        setValue('password', '', { shouldDirty: true, shouldValidate: false })
                        setPasswordModified(false)
                      }
                    }}
                    onChange={(e) => {
                      setPasswordModified(true)
                      register('password').onChange(e)
                    }}
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={showPass}
                      onChange={(e) => {
                        if (e.target.checked && isEdit && getValues('password') === PASSWORD_MASK) {
                          setValue('password', '', { shouldDirty: true, shouldValidate: false })
                          setPasswordModified(false)
                        }
                        setShowPass(e.target.checked)
                      }}
                      className="w-3.5 h-3.5 accent-[#2196F3] cursor-pointer"
                    />
                    <span className="text-xs text-[#6c757d] select-none">Mostrar contraseña</span>
                  </label>
                </Field>

                <Field label="Teléfono *" error={errors.telefono?.message}>
                  <input {...register('telefono')} className={`input ${errors.telefono ? 'input-error' : ''}`} placeholder="10 dígitos" />
                </Field>

                <Field label="Rol *" error={errors.rol?.message}>
                  <select {...register('rol')} className={`input ${errors.rol ? 'input-error' : ''}`}>
                    <option value="">Seleccionar rol</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROL_LABELS[r]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Sucursal *" error={errors.sucursal_id?.message}>
                  <select {...register('sucursal_id')} className={`input ${errors.sucursal_id ? 'input-error' : ''}`}>
                    <option value="">Seleccionar sucursal</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            {/* ── Domicilio ── */}
            <section>
              <p className="sec-title">Domicilio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Calle *" error={errors.calle?.message}>
                  <input {...register('calle')} className={`input ${errors.calle ? 'input-error' : ''}`} placeholder="Nombre de la calle" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="No. Exterior *" error={errors.no_exterior?.message}>
                    <input {...register('no_exterior')} className={`input ${errors.no_exterior ? 'input-error' : ''}`} placeholder="Ext." />
                  </Field>
                  <Field label="No. Interior" error={errors.no_interior?.message}>
                    <input {...register('no_interior')} className="input" placeholder="Int. (opc.)" />
                  </Field>
                </div>
                <Field label="Colonia *" error={errors.colonia?.message}>
                  <input {...register('colonia')} className={`input ${errors.colonia ? 'input-error' : ''}`} placeholder="Colonia" />
                </Field>
                <Field label="Municipio *" error={errors.municipio?.message}>
                  <input {...register('municipio')} className={`input ${errors.municipio ? 'input-error' : ''}`} placeholder="Municipio" />
                </Field>
                <Field label="Estado *" error={errors.estado?.message}>
                  <input {...register('estado')} className={`input ${errors.estado ? 'input-error' : ''}`} placeholder="Estado" />
                </Field>
                <Field label="C.P. *" error={errors.codigo_postal?.message}>
                  <input {...register('codigo_postal')} className={`input ${errors.codigo_postal ? 'input-error' : ''}`} placeholder="00000" />
                </Field>
              </div>
            </section>

            {/* ── Identificación ── */}
            <section>
              <p className="sec-title">Identificación</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="No. de INE *" error={errors.ine_numero?.message}>
                  <input {...register('ine_numero')} className={`input ${errors.ine_numero ? 'input-error' : ''}`} placeholder="Número de INE" />
                </Field>

                <input type="hidden" {...register('ine_imagen_url')} />
                <input type="hidden" {...register('ine_imagen_reverso_url')} />

                <div>
                  <label className="block text-[12px] font-medium text-[#495057] mb-1.5">
                    Imagen INE - Frente *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {ineImgSrc ? (
                    <div className="relative">
                      <img
                        src={ineImgSrc}
                        alt="INE"
                        className="w-full h-24 object-cover rounded-lg border border-[#dee2e6]"
                        onError={() => handleIneImgError(ineImgSrc, inePreview, setIneImgSrc)}
                      />
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setIneFullPreview(true)}
                          className="btn btn-sm text-[11px] bg-white/90"
                          title="Ver tamaño completo"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn btn-sm text-[11px] bg-white/90"
                        >
                          Cambiar
                        </button>
                      </div>
                      <p className="text-[11px] text-[#adb5bd] mt-1">
                        INE cargado — clic en "Cambiar" para reemplazar
                      </p>
                    </div>
                  ) : (
                    <div
                      className="upload-zone flex flex-col items-center gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-5 h-5" />
                      <span>Foto/escaneo de INE</span>
                      <span className="text-[11px]">JPG, PNG, PDF</span>
                    </div>
                  )}
                  {errors.ine_imagen_url?.message && (
                    <p className="text-[#dc2626] text-[11px] mt-0.5">{errors.ine_imagen_url.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#495057] mb-1.5">
                    Imagen INE - Reverso *
                  </label>
                  <input
                    ref={fileInputReversoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleReversoFileChange}
                  />
                  {ineReversoImgSrc ? (
                    <div className="relative">
                      <img
                        src={ineReversoImgSrc}
                        alt="INE reverso"
                        className="w-full h-24 object-cover rounded-lg border border-[#dee2e6]"
                        onError={() => handleIneImgError(ineReversoImgSrc, ineReversoPreview, setIneReversoImgSrc)}
                      />
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setIneReversoFullPreview(true)}
                          className="btn btn-sm text-[11px] bg-white/90"
                          title="Ver tamaño completo"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputReversoRef.current?.click()}
                          className="btn btn-sm text-[11px] bg-white/90"
                        >
                          Cambiar
                        </button>
                      </div>
                      <p className="text-[11px] text-[#adb5bd] mt-1">
                        INE cargado — clic en "Cambiar" para reemplazar
                      </p>
                    </div>
                  ) : (
                    <div
                      className="upload-zone flex flex-col items-center gap-1.5"
                      onClick={() => fileInputReversoRef.current?.click()}
                    >
                      <Upload className="w-5 h-5" />
                      <span>Foto/escaneo del reverso</span>
                      <span className="text-[11px]">JPG, PNG, PDF</span>
                    </div>
                  )}
                  {errors.ine_imagen_reverso_url?.message && (
                    <p className="text-[#dc2626] text-[11px] mt-0.5">{errors.ine_imagen_reverso_url.message}</p>
                  )}
                </div>

                {/* Preview a tamaño completo */}
                <ImagePreviewModal
                  isOpen={ineFullPreview}
                  onClose={() => setIneFullPreview(false)}
                  imageUrl={ineImgSrc || inePreview}
                  title={`INE — ${usuario?.nombre_completo ?? 'Usuario'}`}
                  downloadFileName="ine.jpg"
                />
                <ImagePreviewModal
                  isOpen={ineReversoFullPreview}
                  onClose={() => setIneReversoFullPreview(false)}
                  imageUrl={ineReversoImgSrc || ineReversoPreview}
                  title={`INE reverso — ${usuario?.nombre_completo ?? 'Usuario'}`}
                  downloadFileName="ine-reverso.jpg"
                />
              </div>
            </section>

            {/* ── Referencias ── */}
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
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>

      <ProcessingOverlay
        visible={isProcessing || isPending}
        title={isEdit ? 'Actualizando usuario' : 'Creando usuario'}
        message="Estamos procesando la solicitud y subiendo los archivos. No hagas clic de nuevo."
      />
    </div>
  )
}

// ── Helper de campo con label y error ─────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#495057] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[#dc2626] text-[11px] mt-0.5">{error}</p>}
    </div>
  )
}
