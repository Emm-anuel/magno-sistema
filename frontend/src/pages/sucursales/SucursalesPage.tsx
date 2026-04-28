import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Pencil, Power, X, Building2 } from 'lucide-react'
import { sucursalService } from '@/services/api'
import type { Sucursal } from '@/types'

const formSchema = z.object({
  nombre: z.string().min(2, 'Requerido'),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
})

type SucursalForm = z.infer<typeof formSchema>

export default function SucursalesPage() {
  const qc = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ open: boolean; sucursal: Sucursal | null }>({
    open: false,
    sucursal: null,
  })

  const { data: sucursales = [], isLoading } = useQuery({
    queryKey: ['sucursales-admin'],
    queryFn: () => sucursalService.listarTodas(),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activa }: { id: number; activa: boolean }) =>
      sucursalService.cambiarEstado(id, activa),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['sucursales-admin'] })
      toast.success('Estado actualizado')
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al cambiar estado'),
  })

  const filtro = busqueda.trim().toLowerCase()
  const filtradas = sucursales.filter((s) =>
    !filtro || s.nombre.toLowerCase().includes(filtro) || (s.direccion ?? '').toLowerCase().includes(filtro),
  )

  const total = sucursales.length
  const activas = sucursales.filter((s) => s.activa).length

  return (
    <div>
      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div className="metric-card">
          <p className="metric-label">Total sucursales</p>
          <p className="metric-val">{total}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Activas</p>
          <p className="metric-val text-[#2d6a4f]">{activas}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Inactivas</p>
          <p className="metric-val text-[#adb5bd]">{total - activas}</p>
        </div>
      </div>

      {/* ── Tabla / lista ── */}
      <div className="card">
        <div className="card-header flex-wrap gap-2">
          <span className="card-title">Sucursales</span>
          <button
            className="btn-primary"
            onClick={() => setModal({ open: true, sucursal: null })}
          >
            <Plus className="w-4 h-4" />
            Nueva Sucursal
          </button>
        </div>

        {/* Filtros */}
        <div className="px-[18px] py-3 border-b border-[#e9ecef] flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Buscar por nombre o dirección..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input max-w-xs"
          />
        </div>

        {isLoading ? (
          <p className="text-center text-[#adb5bd] py-10 text-[13px]">Cargando...</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Contacto</th>
                    <th className="text-center">Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-[#adb5bd] py-8">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    filtradas.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#d1fae5] flex items-center justify-center text-[11px] font-semibold text-[#065f46] shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-[#212529]">{s.nombre}</p>
                              <p className="text-[11px] text-[#adb5bd]">{s.direccion ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-[#495057]">
                          <p className="text-[12px]">{s.telefono ?? '—'}</p>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${s.activa ? 'badge-verde' : 'badge-rojo'}`}>
                            {s.activa ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="btn btn-sm"
                              onClick={() => setModal({ open: true, sucursal: s })}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              className={`btn btn-sm ${s.activa ? '' : 'border-[#bbf7d0] text-[#2d6a4f] hover:bg-[#f0fdf4]'}`}
                              onClick={() => toggleMutation.mutate({ id: s.id, activa: !s.activa })}
                              title={s.activa ? 'Desactivar' : 'Activar'}
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
              {filtradas.length === 0 ? (
                <p className="text-center text-[#adb5bd] py-8 text-[13px]">Sin resultados</p>
              ) : (
                filtradas.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-[#d1fae5] flex items-center justify-center text-[13px] font-semibold text-[#065f46] shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#212529] text-[13px] truncate">{s.nombre}</p>
                      <p className="text-[11px] text-[#adb5bd] truncate">{s.telefono ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`badge ${s.activa ? 'badge-verde' : 'badge-rojo'}`}>
                        {s.activa ? 'Activa' : 'Inactiva'}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => setModal({ open: true, sucursal: s })}
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

      {modal.open && (
        <SucursalModal
          sucursal={modal.sucursal}
          onClose={() => setModal({ open: false, sucursal: null })}
          onSaved={() => setModal({ open: false, sucursal: null })}
        />
      )}
    </div>
  )
}

interface ModalProps {
  sucursal: Sucursal | null
  onClose: () => void
  onSaved: () => void
}

function SucursalModal({ sucursal, onClose, onSaved }: ModalProps) {
  const isEdit = !!sucursal
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SucursalForm>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: isEdit
      ? {
          nombre: sucursal.nombre,
          direccion: sucursal.direccion ?? '',
          telefono: sucursal.telefono ?? '',
        }
      : {
          nombre: '',
          direccion: '',
          telefono: '',
        },
  })

  const createMutation = useMutation({
    mutationFn: (data: SucursalForm) =>
      sucursalService.crear({
        ...data,
        direccion: data.direccion?.trim() || undefined,
        telefono: data.telefono?.trim() || undefined,
        activa: true,
      } as Sucursal),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['sucursales-admin'] })
      toast.success('Sucursal creada')
      onSaved()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al crear sucursal'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SucursalForm }) =>
      sucursalService.actualizar(id, {
        ...sucursal!,
        ...data,
        direccion: data.direccion?.trim() || undefined,
        telefono: data.telefono?.trim() || undefined,
      } as Sucursal),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['sucursales-admin'] })
      toast.success('Sucursal actualizada')
      onSaved()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al actualizar sucursal'),
  })

  const isPending = createMutation.isPending || editMutation.isPending

  const onSubmit = async (formData: SucursalForm) => {
    if (isEdit) {
      await editMutation.mutateAsync({ id: sucursal!.id, data: formData })
      return
    }
    await createMutation.mutateAsync(formData)
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/45 flex items-start justify-center overflow-y-auto py-4 px-2"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl w-full max-w-xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] my-auto">
        {/* Header */}
        <div className="modal-header">
          <h3 className="font-semibold text-[15px] text-[#212529]">
            {isEdit ? 'Editar Sucursal' : 'Nueva Sucursal'}
          </h3>
          <button onClick={onClose} className="text-[#adb5bd] hover:text-[#495057] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-5 py-4 space-y-4">
            <section>
              <p className="sec-title">Datos generales</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nombre *" error={errors.nombre?.message}>
                  <input
                    {...register('nombre')}
                    className={`input ${errors.nombre ? 'input-error' : ''}`}
                    placeholder="Sucursal Centro"
                  />
                </Field>
                <Field label="Teléfono" error={errors.telefono?.message}>
                  <input
                    {...register('telefono')}
                    className={`input ${errors.telefono ? 'input-error' : ''}`}
                    placeholder="7710000000"
                  />
                </Field>
                <Field label="Dirección" error={errors.direccion?.message}>
                  <input
                    {...register('direccion')}
                    className={`input ${errors.direccion ? 'input-error' : ''}`}
                    placeholder="Av. Principal 123"
                  />
                </Field>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear Sucursal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
