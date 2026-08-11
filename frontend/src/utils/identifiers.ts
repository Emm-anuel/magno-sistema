import type { FormEvent } from 'react'
import { z } from 'zod'

export function normalizeCurp(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18)
}

export function normalizeRfc(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, '').slice(0, 13)
}

export const curpSchema = z.string()
  .transform(normalizeCurp)
  .refine((value) => value.length === 18, 'Debe contener exactamente 18 caracteres')

export const optionalRfcSchema = z.string()
  .transform(normalizeRfc)
  .refine((value) => value === '' || value.length === 12 || value.length === 13,
    'Debe contener 12 o 13 caracteres')

export function sanitizeCurpInput(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = normalizeCurp(event.currentTarget.value)
}

export function sanitizeRfcInput(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = normalizeRfc(event.currentTarget.value)
}
