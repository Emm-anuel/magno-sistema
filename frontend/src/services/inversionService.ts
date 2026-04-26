import { api } from '@/services/api'

export interface MovimientoInversion {
  id: number
  conceptoInversionId: number
  conceptoNombre: string
  descripcion: string | null
  monto: number
  registradoPorId: number
  registradoPorNombre: string
  createdAt: string
}

function normalize(raw: any): MovimientoInversion {
  return {
    id:                  raw?.id,
    conceptoInversionId: raw?.conceptoInversionId,
    conceptoNombre:      raw?.conceptoNombre ?? '',
    descripcion:         raw?.descripcion ?? null,
    monto:               Number(raw?.monto ?? 0),
    registradoPorId:     raw?.registradoPorId,
    registradoPorNombre: raw?.registradoPorNombre ?? '',
    createdAt:           raw?.createdAt ?? '',
  }
}

export const inversionService = {
  getByDia: (cajaId: number): Promise<MovimientoInversion[]> =>
    api.get(`/inversiones?cajaId=${cajaId}`).then(r => (r.data as any[]).map(normalize)),

  registrar: (cajaId: number, payload: {
    conceptoInversionId: number
    descripcion?: string
    monto: number
  }): Promise<MovimientoInversion> =>
    api.post(`/inversiones?cajaId=${cajaId}`, payload).then(r => normalize(r.data)),

  eliminar: (cajaId: number, movimientoId: number): Promise<void> =>
    api.delete(`/inversiones/${movimientoId}?cajaId=${cajaId}`).then(() => undefined),
}
