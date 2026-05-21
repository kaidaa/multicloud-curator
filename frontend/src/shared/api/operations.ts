import { api } from "@/shared/api/client"

export type OperationType = "refresh" | "duplicates_scan" | "security_scan"
export type OperationStatus = "queued" | "running" | "completed" | "failed"

export interface OperationProgress {
  current: number | null
  total: number | null
  label: string | null
}

export interface OperationResponse {
  operation_id: string
  operation_type: OperationType
  status: OperationStatus
  started_at: string
  completed_at: string | null
  progress: OperationProgress | null
  context: Record<string, unknown> | null
  error_message: string | null
}

interface WaitForOperationOptions {
  intervalMs?: number
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_INITIAL_INTERVAL_MS = 2000
const SLOW_POLL_AFTER_MS = 30 * 1000
const SLOW_POLL_INTERVAL_MS = 5000
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

export class OperationFailedError extends Error {
  constructor(public readonly operation: OperationResponse) {
    super(operation.error_message || "Operasi gagal diproses.")
    this.name = "OperationFailedError"
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Polling dibatalkan.", "AbortError"))
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout)
        reject(new DOMException("Polling dibatalkan.", "AbortError"))
      },
      { once: true },
    )
  })
}

export function getOperation(
  operationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<OperationResponse> {
  return api
    .get<OperationResponse>(`/operations/${operationId}`, {
      signal: options.signal,
    })
    .then((response) => response.data)
}

export async function waitForOperation(
  operationId: string,
  options: WaitForOperationOptions = {},
): Promise<OperationResponse> {
  const initialIntervalMs = options.intervalMs ?? DEFAULT_INITIAL_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const operation = await getOperation(operationId, { signal: options.signal })

    if (operation.status === "completed") {
      return operation
    }
    if (operation.status === "failed") {
      throw new OperationFailedError(operation)
    }

    const elapsedMs = Date.now() - startedAt
    const nextIntervalMs =
      elapsedMs >= SLOW_POLL_AFTER_MS
        ? Math.max(initialIntervalMs, SLOW_POLL_INTERVAL_MS)
        : initialIntervalMs
    await sleep(nextIntervalMs, options.signal)
  }

  throw new Error("Operasi masih berjalan terlalu lama. Coba cek kembali nanti.")
}
