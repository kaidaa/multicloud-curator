/**
 * Shared API contract types yang dipakai lintas fitur. Tipe spesifik per
 * endpoint tinggal di folder fitur masing-masing dan extend dari sini bila
 * butuh envelope.
 */

export interface EnvelopeMeta {
  snapshot_at?: string
  pagination?: {
    limit?: number
    offset?: number
    total?: number
    has_more?: boolean
  }
  [key: string]: unknown
}

export interface ApiResponse<T> {
  data: T
  meta?: EnvelopeMeta
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface HealthResponse {
  status: "ok"
}
