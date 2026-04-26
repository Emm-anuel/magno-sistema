import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService } from '@/services/cajaService'

export type BannerVariant = 'none' | 'warning' | 'danger' | 'danger-hora'

export interface CajaOperativaState {
  bloqueado: boolean
  bannerVariant: BannerVariant
  horaLimite: string
  cajaId: number | null
  isLoading: boolean
}

const FIELD_ROLES = new Set(['ASESOR_COBRADOR', 'SUPERVISOR_CAMPO'])

function isWithin15MinOf(horaStr: string): boolean {
  const parts = horaStr.split(':').map(Number)
  const limiteMin = parts[0] * 60 + parts[1]
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= limiteMin - 15 && nowMin < limiteMin
}

export function useCajaOperativa(): CajaOperativaState {
  const { usuario } = useAuthStore()
  const isFieldRole = FIELD_ROLES.has(usuario?.rol ?? '')

  const { data: estado, isLoading } = useQuery({
    queryKey: ['caja-estado-operativa'],
    queryFn: () => cajaService.getEstado(),
    enabled: isFieldRole,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  if (!isFieldRole || !estado) {
    return { bloqueado: false, bannerVariant: 'none', horaLimite: '17:00', cajaId: null, isLoading }
  }

  let bannerVariant: BannerVariant = 'none'
  if (estado.bloqueado) {
    bannerVariant = estado.motivoBloqueo === 'HORA_LIMITE' ? 'danger-hora' : 'danger'
  } else if (isWithin15MinOf(estado.horaLimite)) {
    bannerVariant = 'warning'
  }

  return {
    bloqueado: estado.bloqueado,
    bannerVariant,
    horaLimite: estado.horaLimite,
    cajaId: estado.cajaId,
    isLoading,
  }
}
