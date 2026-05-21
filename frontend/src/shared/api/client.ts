/**
 * Typed fetch wrapper. Semua request lewat `/api/*` yang di-proxy Vite dev
 * server ke backend FastAPI di port 8000. Mapping error code spesifik
 * ditambah saat error envelope di-finalize.
 */

import type { ApiErrorPayload, ApiResponse } from "@/shared/api/types"

const BASE_URL = "/api"

export type QueryParamValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryParamValue>

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

interface ApiRequestOptions extends RequestInit {
  params?: QueryParams
}

function withQueryParams(path: string, params?: QueryParams): string {
  if (!params) return path

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  if (!query) return path

  return `${path}${path.includes("?") ? "&" : "?"}${query}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { params, ...init } = options
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${withQueryParams(path, params)}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiClientError(
      {
        code: "network_error",
        message: "Tidak bisa terhubung ke backend.",
      },
      0,
    )
  }

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
  get: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
}
