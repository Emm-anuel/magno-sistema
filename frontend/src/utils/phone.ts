import type { FormEvent } from 'react'
import { z } from 'zod'

export const PHONE_ERROR = 'Debe contener exactamente 10 dígitos'

export const requiredPhoneSchema = z.string().regex(/^\d{10}$/, PHONE_ERROR)

export const optionalPhoneSchema = z.string().refine(
  (value) => value === '' || /^\d{10}$/.test(value),
  PHONE_ERROR,
)

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function sanitizePhoneInput(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = normalizePhone(event.currentTarget.value)
}
