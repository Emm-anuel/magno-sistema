import { api } from '@/services/api'

export interface CategoriaGasto {
  id: number
  sucursalId: number
  nombre: string
  descripcion: string | null
}

export interface GastoDTO {
  id: number
  cajaId: number
  categoriaId: number
  categoriaNombre: string
  concepto: string
  monto: number
  registradoPorId: number
  registradoPorNombre: string
  createdAt: string
}

export interface GastoAgrupado {
  categoriaId: number
  categoriaNombre: string
  gastos: GastoDTO[]
  subtotal: number
}

export interface GastosDelDia {
  cajaId: number
  grupos: GastoAgrupado[]
  total: number
}

function normalizeGasto(raw: any): GastoDTO {
  return {
    id: raw.id,
    cajaId: raw.cajaId,
    categoriaId: raw.categoriaId,
    categoriaNombre: raw.categoriaNombre ?? '',
    concepto: raw.concepto ?? '',
    monto: Number(raw.monto ?? 0),
    registradoPorId: raw.registradoPorId,
    registradoPorNombre: raw.registradoPorNombre ?? '',
    createdAt: raw.createdAt,
  }
}

function normalizeGastosDelDia(raw: any): GastosDelDia {
  return {
    cajaId: raw.cajaId,
    total: Number(raw.total ?? 0),
    grupos: (raw.grupos ?? []).map((g: any) => ({
      categoriaId: g.categoriaId,
      categoriaNombre: g.categoriaNombre ?? '',
      subtotal: Number(g.subtotal ?? 0),
      gastos: (g.gastos ?? []).map(normalizeGasto),
    })),
  }
}

export const gastoService = {
  getGastos: (cajaId: number) =>
    api.get<any>(`/gastos?cajaId=${cajaId}`).then(r => normalizeGastosDelDia(r.data)),

  registrar: (cajaId: number, data: { categoriaGastoId: number; concepto: string; monto: number }) =>
    api.post<any>(`/gastos?cajaId=${cajaId}`, data).then(r => normalizeGasto(r.data)),

  actualizar: (id: number, data: { categoriaGastoId: number; concepto: string; monto: number }) =>
    api.put<any>(`/gastos/${id}`, data).then(r => normalizeGasto(r.data)),

  eliminar: (id: number) =>
    api.delete(`/gastos/${id}`),

  getCategorias: (sucursalId: number) =>
    api.get<CategoriaGasto[]>(`/gastos/categorias?sucursalId=${sucursalId}`).then(r => r.data),

  crearCategoria: (sucursalId: number, data: { nombre: string; descripcion?: string }) =>
    api.post<CategoriaGasto>(`/gastos/categorias?sucursalId=${sucursalId}`, data).then(r => r.data),

  actualizarCategoria: (id: number, data: { nombre: string; descripcion?: string }) =>
    api.put<CategoriaGasto>(`/gastos/categorias/${id}`, data).then(r => r.data),

  desactivarCategoria: (id: number) =>
    api.delete(`/gastos/categorias/${id}`),
}
