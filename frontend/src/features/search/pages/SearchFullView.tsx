import { useMemo } from "react"
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { getProviderLabel } from "@/features/accounts/components/ProviderLogo"
import type { ActivityFile } from "@/features/explore/api"
import {
  DEFAULT_SEARCH_LIMIT,
  type SearchProviderFilter,
  type SearchSort,
  type SearchTypeFilter,
} from "@/features/search/api"
import { useSearch } from "@/features/search/hooks/useSearch"
import { SearchFilters } from "@/features/search/components/SearchFilters"
import { Skeleton } from "@/shared/components/LoadingState"
import { FileIcon } from "@/shared/components/FileIcon"
import { formatRelativeTime } from "@/shared/utils/formatTime"

function parseProvider(value: string | null): SearchProviderFilter {
  if (value === "google" || value === "dropbox") return value
  return "all"
}

function parseType(value: string | null): SearchTypeFilter {
  if (value === "photo" || value === "video" || value === "document" || value === "audio" || value === "other") {
    return value
  }
  return "all"
}

function parseSort(value: string | null): SearchSort {
  if (value === "modified_asc" || value === "name_asc") return value
  return "modified_desc"
}

function parseOffset(value: string | null): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const SEARCH_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_SEARCH_LIMIT
  const parsed = Number.parseInt(value, 10)
  return SEARCH_PAGE_SIZE_OPTIONS.includes(
    parsed as (typeof SEARCH_PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_SEARCH_LIMIT
}

const TABLE_HEAD_CLASS =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"

export function SearchFullView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const query = searchParams.get("q") ?? ""
  const ownedOnly = searchParams.get("owned_only") === "true"
  const provider = parseProvider(searchParams.get("provider"))
  const fileType = parseType(searchParams.get("type"))
  const sort = parseSort(searchParams.get("sort"))
  const limit = parseLimit(searchParams.get("limit"))
  const offset = parseOffset(searchParams.get("offset"))

  const params = useMemo(
    () => ({
      query,
      ownedOnly,
      provider,
      fileType,
      sort,
      limit,
      offset,
    }),
    [query, ownedOnly, provider, fileType, sort, limit, offset],
  )

  const { files, total, isLoading, error, isBelowMinLength } = useSearch(params)

  function updateParam(updater: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    updater(next)
    // Reset offset saat filter/query berubah supaya pagination tidak terjebak
    // di halaman yang tidak relevan.
    next.delete("offset")
    setSearchParams(next, { replace: true })
  }

  function handleQueryChange(value: string) {
    updateParam((next) => {
      if (value) next.set("q", value)
      else next.delete("q")
    })
  }

  function handleOwnedOnlyChange(value: boolean) {
    updateParam((next) => {
      if (value) next.set("owned_only", "true")
      else next.delete("owned_only")
    })
  }

  function handleProviderChange(value: SearchProviderFilter) {
    updateParam((next) => {
      if (value !== "all") next.set("provider", value)
      else next.delete("provider")
    })
  }

  function handleFileTypeChange(value: SearchTypeFilter) {
    updateParam((next) => {
      if (value !== "all") next.set("type", value)
      else next.delete("type")
    })
  }

  function handleSortChange(value: SearchSort) {
    updateParam((next) => {
      if (value !== "modified_desc") next.set("sort", value)
      else next.delete("sort")
    })
  }

  function handlePageOffset(nextOffset: number) {
    const next = new URLSearchParams(searchParams)
    if (nextOffset > 0) next.set("offset", String(nextOffset))
    else next.delete("offset")
    setSearchParams(next, { replace: false })
  }

  function handleLimitChange(nextLimit: number) {
    const next = new URLSearchParams(searchParams)
    if (nextLimit !== DEFAULT_SEARCH_LIMIT) next.set("limit", String(nextLimit))
    else next.delete("limit")
    next.delete("offset")
    setSearchParams(next, { replace: true })
  }

  const currentPageStart = total === 0 ? 0 : offset + 1
  const currentPageEnd = Math.min(offset + limit, total)
  const hasPrev = offset > 0
  const hasNext = offset + limit < total

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/eksplorasi")}
          className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
        >
          <ArrowLeft size={14} weight="bold" />
          <span>Kembali ke Eksplorasi</span>
        </button>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-2">
          Pencarian metadata
        </span>
      </header>

      <div className="mt-6 flex items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3.5 py-2.5">
        <MagnifyingGlass size={16} weight="bold" className="text-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Cari metadata file (min. 2 karakter)"
          className="min-h-[28px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      <div className="mt-4">
        <SearchFilters
          ownedOnly={ownedOnly}
          provider={provider}
          fileType={fileType}
          sort={sort}
          onOwnedOnlyChange={handleOwnedOnlyChange}
          onProviderChange={handleProviderChange}
          onFileTypeChange={handleFileTypeChange}
          onSortChange={handleSortChange}
        />
      </div>

      <section className="mt-6">
        {isBelowMinLength ? (
          <div className="rounded-[--radius] border border-line bg-panel px-5 py-8 text-center text-sm text-muted">
            <MagnifyingGlass size={24} weight="duotone" className="mx-auto mb-3 text-muted-2" />
            Ketik minimal 2 karakter di kotak pencarian untuk mulai mencari file lintas akun.
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
            <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        ) : isLoading ? (
          <SearchResultsSkeleton />
        ) : files.length === 0 ? (
          <div className="rounded-[--radius] border border-line bg-panel px-5 py-8 text-center text-sm text-muted">
            Tidak ada hasil untuk pencarian ini. Coba kata kunci atau filter yang berbeda.
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-muted">
              <label className="inline-flex items-center gap-2">
                <select
                  value={limit}
                  onChange={(event) => handleLimitChange(Number(event.target.value))}
                  className="rounded-[--radius-sm] border border-line bg-panel px-2 py-1 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
                  aria-label="Jumlah hasil per halaman"
                >
                  {SEARCH_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span>
                  Menampilkan {currentPageStart}-{currentPageEnd} dari {total} hasil
                </span>
              </label>
            </div>
            <SearchResultsTable files={files} />
            {total > limit && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handlePageOffset(Math.max(0, offset - limit))}
                  disabled={!hasPrev}
                  className="inline-flex items-center gap-1.5 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CaretLeft size={14} weight="bold" />
                  <span>Sebelumnya</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePageOffset(offset + limit)}
                  disabled={!hasNext}
                  className="inline-flex items-center gap-1.5 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Berikutnya</span>
                  <CaretRight size={14} weight="bold" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

function SearchResultsTable({ files }: { files: ActivityFile[] }) {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] table-fixed text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={`${TABLE_HEAD_CLASS} w-[38%] text-left`}>Nama file</th>
              <th className={`${TABLE_HEAD_CLASS} w-[24%] text-left`}>Akun + provider</th>
              <th className={`${TABLE_HEAD_CLASS} w-[20%] text-left`}>Path</th>
              <th className={`${TABLE_HEAD_CLASS} w-[12%] text-left`}>Modifikasi</th>
              <th className={`${TABLE_HEAD_CLASS} w-[96px] text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className="border-b border-line transition last:border-b-0 hover:bg-panel-soft/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius-sm] bg-panel-soft text-ink-soft">
                      <FileIcon type={file.type} mimeType={file.mimeType} size={18} />
                    </span>
                    <p className="min-w-0 truncate text-sm font-medium text-ink">{file.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-ink-soft">
                  <p className="truncate">{file.accountEmail}</p>
                  <p className="text-xs text-muted">{getProviderLabel(file.provider)}</p>
                </td>
                <td className="truncate px-4 py-3 text-xs text-muted">
                  {file.path ?? "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-soft">
                  {formatRelativeTime(file.modifiedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (file.webViewLink) {
                          window.open(file.webViewLink, "_blank", "noopener,noreferrer")
                        }
                      }}
                      disabled={!file.webViewLink}
                      className="inline-flex max-w-full items-center gap-1 rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowSquareOut size={13} weight="bold" />
                      <span>Buka</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SearchResultsSkeleton() {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] table-fixed text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={`${TABLE_HEAD_CLASS} w-[38%] text-left`}>Nama file</th>
              <th className={`${TABLE_HEAD_CLASS} w-[24%] text-left`}>Akun + provider</th>
              <th className={`${TABLE_HEAD_CLASS} w-[20%] text-left`}>Path</th>
              <th className={`${TABLE_HEAD_CLASS} w-[12%] text-left`}>Modifikasi</th>
              <th className={`${TABLE_HEAD_CLASS} w-[96px] text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, idx) => (
              <tr key={idx} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="ml-auto h-7 w-20" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
