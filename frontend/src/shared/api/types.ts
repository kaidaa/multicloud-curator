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
