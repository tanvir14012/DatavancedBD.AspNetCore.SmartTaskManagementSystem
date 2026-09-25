import axios from 'axios'

import type { ApiErrorPayload } from '@/types/api'

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const payload = error.response?.data
    return payload?.detail ?? payload?.message ?? payload?.title ?? fallback
  }

  return fallback
}

export function getApiFieldErrors(error: unknown): Record<string, string[]> {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return {}
  }

  const errors = error.response?.data?.errors ?? {}
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]),
  )
}
