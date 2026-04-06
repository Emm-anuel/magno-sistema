import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { ApiError } from '@/types'

const schema = z.object({
  email:    z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => authService.login(data.email, data.password),
    onSuccess: ({ token, usuario }) => {
      login(token, usuario)
    },
    onError: (err: ApiError) => {
      toast.error(err.message ?? 'Credenciales incorrectas')
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <h2 className="text-[15px] font-semibold text-[#212529] mb-5">Iniciar sesión</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-[#495057]">
          Correo electrónico
        </label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="usuario@magno.com"
          className={`input ${errors.email ? 'input-error' : ''}`}
        />
        {errors.email && (
          <p className="text-[#dc2626] text-[11px]">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-[#495057]">
          Contraseña
        </label>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className={`input ${errors.password ? 'input-error' : ''}`}
        />
        {errors.password && (
          <p className="text-[#dc2626] text-[11px]">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="btn-primary w-full mt-2 py-2.5 text-[14px]"
      >
        {mutation.isPending ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  )
}
