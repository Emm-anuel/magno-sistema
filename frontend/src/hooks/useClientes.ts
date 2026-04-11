import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clienteService } from '@/services/api'
import type { ClienteCreateRequest, ClienteUpdateRequest } from '@/types'

interface FiltrosClientes {
  buscar?: string
  estado?: string
  asesorId?: number
  sucursalId?: number
  activo?: boolean
  page?: number
  size?: number
}

export function useClientes(filtros: FiltrosClientes = {}) {
  return useQuery({
    queryKey: ['clientes', filtros],
    queryFn: () => clienteService.listar(filtros),
    staleTime: 30_000,
  })
}

export function useCliente(id: number | undefined) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clienteService.obtener(id!),
    enabled: !!id,
  })
}

export function useCrearCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ClienteCreateRequest) => clienteService.crear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}

export function useActualizarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClienteUpdateRequest }) =>
      clienteService.actualizar(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['cliente', id] })
    },
  })
}

export function useCambiarEstadoCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, activo, motivo }: { id: number; activo: boolean; motivo?: string }) =>
      clienteService.cambiarEstado(id, activo, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}
