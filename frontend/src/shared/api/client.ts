/**
 * Typed fetch wrapper. Semua request lewat `/api/*` yang di-proxy Vite dev
 * server ke backend FastAPI di port 8000. Mapping error code spesifik
 * ditambah saat error envelope di-finalize.
 */

import type { ApiErrorPayload, ApiResponse } from "@/shared/api/types"

const BASE_URL = "/api"

export class ApiClientError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly details?: Record<string, unknown>

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message || payload.code)
    this.name = "ApiClientError"
    this.code = payload.code
    this.status = status
    this.details = payload.details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  })

  if (response.status === 204) {
    return { data: null as unknown as T }
  }

  const text = await response.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new ApiClientError(
        { code: "invalid_response", message: "Backend mengirim payload non-JSON" },
        response.status,
      )
    }
  }

  if (!response.ok) {
    const errorPayload =
      body && typeof body === "object" && "error" in body
        ? ((body as { error: ApiErrorPayload }).error ?? {
            code: "internal_error",
            message: "Unknown error",
          })
        : { code: "internal_error", message: response.statusText }
    throw new ApiClientError(errorPayload, response.status)
  }

  return body as ApiResponse<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
