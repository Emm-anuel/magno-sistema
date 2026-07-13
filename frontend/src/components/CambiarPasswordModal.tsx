import { useState, forwardRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { usuarioService } from '@/services/api'

const schema = z
  .object({
    passwordActual: z.string().min(1, 'Ingresa tu contraseña actual'),
    passwordNuevo:  z.string().min(6, 'Mínimo 6 caracteres'),
    confirmacion:   z.string().min(1, 'Confirma tu nueva contraseña'),
  })
  .refine((d) => d.passwordNuevo === d.confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmacion'],
  })

type Form = z.infer<typeof schema>

interface Props {
  onClose: () => void
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[12px] font-medium text-[#495057]">{label}</label>
      {children}
      {error && <p className="text-[11px] text-[#dc3545]">{error}</p>}
    </div>
  )
}

const PasswordInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
>(function PasswordInput({ placeholder, error, ...props }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <input
        {...props}
        ref={ref}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className={`input ${error ? 'input-error' : ''}`}
      />
      <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="w-3.5 h-3.5 accent-[#2196F3] cursor-pointer"
        />
        <span className="text-xs text-[#6c757d] select-none">Mostrar</span>
      </label>
    </div>
  )
})

export default function CambiarPasswordModal({ onClose }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: Form) =>
      usuarioService.cambiarMiPassword(data.passwordActual, data.passwordNuevo),
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente')
      onClose()
    },
    onError: (err: any) => {
      const status = err?.response?.status
      if (status === 400) {
        toast.error('La contraseña actual es incorrecta')
      } else {
        toast.error('No se pudo actualizar la contraseña')
      }
    },
  })

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/45 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="modal-header">
          <h3 className="font-semibold text-[15px] text-[#212529]">Cambiar contraseña</h3>
          <button onClick={onClose} className="text-[#adb5bd] hover:text-[#495057] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <div className="px-5 py-4 space-y-4">
            <Field label="Contraseña actual" error={errors.passwordActual?.message}>
              <PasswordInput
                {...register('passwordActual')}
                placeholder="Tu contraseña actual"
                error={!!errors.passwordActual}
              />
            </Field>

            <Field label="Nueva contraseña" error={errors.passwordNuevo?.message}>
              <PasswordInput
                {...register('passwordNuevo')}
                placeholder="Mínimo 6 caracteres"
                error={!!errors.passwordNuevo}
              />
            </Field>

            <Field label="Confirmar nueva contraseña" error={errors.confirmacion?.message}>
              <PasswordInput
                {...register('confirmacion')}
                placeholder="Repite la nueva contraseña"
                error={!!errors.confirmacion}
              />
            </Field>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
