import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  MagnifyingGlass,
  WarningCircle,
  X,
} from "@phosphor-icons/react"

import {
  type SearchProviderFilter,
  type SearchSort,
  type SearchTypeFilter,
} from "@/features/search/api"
import { useSearch } from "@/features/search/hooks/useSearch"
import { SearchFilters } from "@/features/search/components/SearchFilters"
import { SearchResultRow } from "@/features/search/components/SearchResultRow"
import { Skeleton } from "@/shared/components/LoadingState"

interface SearchDrawerProps {
  open: boolean
  onClose: () => void
}

const DRAWER_PREVIEW_LIMIT = 7

export function SearchDrawer({ open, onClose }: SearchDrawerProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState("")
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [provider, setProvider] = useState<SearchProviderFilter>("all")
  const [fileType, setFileType] = useState<SearchTypeFilter>("all")
  const [sort, setSort] = useState<SearchSort>("modified_desc")

  // Reset state setiap drawer dibuka dari awal supaya tidak membawa
  // sisa query lama. Visual sengaja jangan persist — drawer adalah ephemeral
  // preview, persistensi ada di /cari (URL state).
  useEffect(() => {
    if (open) {
      setQuery("")
      setOwnedOnly(false)
      setProvider("all")
      setFileType("all")
      setSort("modified_desc")
    }
  }, [open])

  // Auto-focus input + lock body scroll + ESC close.
  useEffect(() => {
    if (!open) return
    const focusHandle = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 30)

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"

    return () => {
      window.clearTimeout(focusHandle)
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  const searchParams = useMemo(
    () => ({
      query,
      ownedOnly,
      provider,
      fileType,
      sort,
      limit: DRAWER_PREVIEW_LIMIT,
      offset: 0,
    }),
    [query, ownedOnly, provider, fileType, sort],
  )

  const { files, total, isLoading, error, isBelowMinLength } = useSearch(searchParams)

  function handleOpenFullView() {
    const params = new URLSearchParams()
    if (query.trim()) params.set("q", query.trim())
    if (ownedOnly) params.set("owned_only", "true")
    if (provider !== "all") params.set("provider", provider)
    if (fileType !== "all") params.set("type", fileType)
    if (sort !== "modified_desc") params.set("sort", sort)
    onClose()
    navigate(`/cari${params.toString() ? `?${params.toString()}` : ""}`)
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian metadata"
        onClick={(event) => event.stopPropagation()}
        className="fixed left-1/2 top-7 w-[min(820px,calc(100vw-2.25rem))] max-h-[calc(100vh-3.5rem)] -translate-x-1/2 overflow-auto rounded-[16px] border border-line bg-bg pb-[18px] pl-[18px] pr-[18px] pt-11 shadow-soft"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pencarian"
          className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-[--radius-sm] text-muted transition hover:bg-panel-soft hover:text-ink"
        >
          <X size={16} weight="bold" />
        </button>

        <div className="flex items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3.5 py-2.5">
          <MagnifyingGlass size={16} weight="bold" className="text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari metadata file lintas Google Drive dan Dropbox (min. 2 karakter)"
            className="min-h-[28px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>

        <div className="mt-4">
          <SearchFilters
            ownedOnly={ownedOnly}
            provider={provider}
            fileType={fileType}
            sort={sort}
            onOwnedOnlyChange={setOwnedOnly}
            onProviderChange={setProvider}
            onFileTypeChange={setFileType}
            onSortChange={setSort}
          />
        </div>

        <div className="mt-4">
          {isBelowMinLength ? (
            <p className="rounded-[--radius-sm] bg-panel-soft px-4 py-3 text-xs text-muted">
              Ketik minimal 2 karakter untuk mulai mencari.
            </p>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-[--radius-sm] border border-danger-strong/30 bg-danger-soft px-4 py-3 text-sm text-danger-strong">
              <WarningCircle size={16} weight="fill" className="mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Skeleton key={idx} className="h-14 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <p className="rounded-[--radius-sm] bg-panel-soft px-4 py-3 text-sm text-muted">
              Tidak ada hasil untuk pencarian ini.
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <SearchResultRow key={file.id} file={file} />
              ))}
              {total > files.length && (
                <p className="px-1 text-xs text-muted-2">
                  Menampilkan {files.length} dari {total} hasil.
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleOpenFullView}
          disabled={isBelowMinLength || files.length === 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Lihat semua hasil</span>
          <ArrowRight size={14} weight="bold" />
        </button>
      </section>
    </div>,
    document.body,
  )
}
