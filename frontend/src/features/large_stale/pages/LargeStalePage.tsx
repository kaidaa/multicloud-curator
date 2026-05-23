import { useEffect, useMemo, useState } from "react"
import { Broom, Funnel, Info, Plugs, WarningCircle } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"

import type { Account } from "@/features/accounts/api"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import type { LargeStaleFile } from "@/features/large_stale/api"
import { BatchDeleteConfirmModal } from "@/features/large_stale/components/BatchDeleteConfirmModal"
import { LargeStaleTable, LargeStaleTableSkeleton } from "@/features/large_stale/components/LargeStaleTable"
import { LargeStaleToolbar } from "@/features/large_stale/components/LargeStaleToolbar"
import { ThresholdInfoBanner } from "@/features/large_stale/components/ThresholdInfoBanner"
import { useLargeStaleUiState } from "@/features/large_stale/contexts/LargeStaleUiStateContext"
import { useLargeStale } from "@/features/large_stale/hooks/useLargeStale"
import { EmptyState } from "@/shared/components/EmptyState"
import { useToast } from "@/shared/hooks/useToast"
import { getAccountLifecycleSummary } from "@/shared/utils/accountLifecycle"
import { formatBytes } from "@/shared/utils/formatSize"
import { formatDateID } from "@/shared/utils/formatDate"
import {
  hasNewActiveAccountsOutsideCoverage,
  shouldShowCoverageRatio,
} from "@/shared/utils/scanCoverage"

const LARGE_STALE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_LARGE_STALE_PAGE_SIZE = 50

export function LargeStalePage() {
  const {
    typeFilter,
    setTypeFilter,
    providerFilter,
    setProviderFilter,
    sortBy,
    setSortBy,
    selectedFileIds,
    markScanRequested,
    toggleSelection,
    clearSelection,
    removeFromSelection,
  } = useLargeStaleUiState()

  const [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_LARGE_STALE_PAGE_SIZE)
  const { accounts } = useAccounts()

  const { files, total, thresholds, snapshotAt, coverage, isLoading, error, refetch, refresh, batchDelete } =
    useLargeStale({
      typeFilter,
      providerFilter,
      sortBy,
      limit: pageSize,
      offset,
      enabled: accounts.length > 0,
    })

  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (isLoading || offset === 0 || offset < total) return
    const lastValidOffset =
      total > 0
        ? Math.floor((total - 1) / pageSize) * pageSize
        : 0
    clearSelection()
    setOffset(lastValidOffset)
  }, [clearSelection, isLoading, offset, pageSize, total])

  const { hasActiveAccounts, problemAccounts } = useMemo(
    () => getAccountLifecycleSummary(accounts),
    [accounts],
  )

  useEffect(() => {
    if (hasActiveAccounts && snapshotAt) return
    clearSelection()
  }, [clearSelection, hasActiveAccounts, snapshotAt])

  // Overlay status akun terkini hanya boleh menambah disable state; backend
  // `deletable=false` tetap menang.
  const accountStatusMap = useMemo(() => {
    const map = new Map<string, Account["status"]>()
    for (const account of accounts) {
      map.set(account.id, account.status)
    }
    return map
  }, [accounts])

  const effectiveFiles = useMemo<LargeStaleFile[]>(
    () =>
      files.map((file) => {
        if (!file.deletable) return file
        if (!file.isOwned) {
          return {
            ...file,
            deletable: false,
            deletableReason:
              file.deletableReason ?? "File shared tidak bisa dihapus dari aplikasi ini",
          }
        }

        const status = accountStatusMap.get(file.accountId)
        if (status === "active") {
          return file
        }

        return {
          ...file,
          deletable: false,
          deletableReason: "Akun perlu otorisasi ulang sebelum file bisa dihapus",
        }
      }),
    [files, accountStatusMap],
  )

  // Total size dari seluruh kandidat (untuk meta header).
  const totalSize = useMemo(
    () => effectiveFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [effectiveFiles],
  )

  const fileIndex = useMemo(() => {
    const map = new Map<string, LargeStaleFile>()
    for (const file of effectiveFiles) {
      map.set(file.id, file)
    }
    return map
  }, [effectiveFiles])

  const selectedFiles = useMemo<LargeStaleFile[]>(() => {
    const result: LargeStaleFile[] = []
    for (const id of selectedFileIds) {
      const file = fileIndex.get(id)
      if (file) result.push(file)
    }
    return result
  }, [selectedFileIds, fileIndex])

  const selectedCount = selectedFiles.length
  const selectedTotalSize = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [selectedFiles],
  )

  const currentPageStart = total === 0 ? 0 : offset + 1
  const currentPageEnd = Math.min(offset + effectiveFiles.length, total)
  const hasPrevPage = offset > 0
  const hasNextPage = offset + pageSize < total

  function handleTypeFilterChange(value: typeof typeFilter) {
    clearSelection()
    setOffset(0)
    setTypeFilter(value)
  }

  function handleProviderFilterChange(value: typeof providerFilter) {
    clearSelection()
    setOffset(0)
    setProviderFilter(value)
  }

  function handleSortChange(value: typeof sortBy) {
    clearSelection()
    setOffset(0)
    setSortBy(value)
  }

  function handlePageOffset(nextOffset: number) {
    clearSelection()
    setOffset(Math.max(0, nextOffset))
  }

  function handlePageSizeChange(nextPageSize: number) {
    clearSelection()
    setOffset(0)
    setPageSize(nextPageSize)
  }

  async function handleScanRefresh() {
    if (isRefreshing || !hasActiveAccounts) return
    setIsRefreshing(true)
    try {
      const result = await refresh()
      markScanRequested()
      setOffset(0)
      clearSelection()
      if (result && result.total > 0) {
        pushToast(`${result.total} kandidat ditemukan.`, "info")
      }
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Scan gagal. Coba lagi.",
        "error",
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleConfirmDelete() {
    const ids = [...selectedFileIds]
    if (ids.length === 0) return
    try {
      const result = await batchDelete(ids)
      if (result.deleted.length > 0) {
        removeFromSelection(result.deleted.map((d) => d.id))
        pushToast(`${result.deleted.length} file berhasil dihapus.`, "success")
      }
      if (result.failed.length > 0) {
        const failedNames = result.failed
          .map((f) => f.message ?? f.errorCode ?? f.id)
          .join("; ")
        pushToast(
          `${result.failed.length} file gagal dihapus: ${failedNames}`,
          "error",
        )
      }
      setIsDeleteModalOpen(false)
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Penghapusan gagal. Coba lagi.",
        "error",
      )
    }
  }

  const hasAccounts = accounts.length > 0
  const hasStoredScan = snapshotAt !== null
  const hasData = hasStoredScan && effectiveFiles.length > 0
  const filterActive = typeFilter !== "all" || providerFilter !== "all"
  const showCoverageRatio = shouldShowCoverageRatio(coverage)
  const hasCoverageNudge = hasNewActiveAccountsOutsideCoverage(coverage, accounts)

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Kelola File</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">File Besar dan Usang</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Kandidat pembersihan berdasarkan ukuran besar atau usia lama. Hanya file milik Anda yang dapat dihapus.
        </p>
        {hasAccounts && hasStoredScan && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
            <span>
              Scan terakhir: <strong className="font-semibold text-ink-soft">{formatDateID(snapshotAt)}</strong>
            </span>
            {showCoverageRatio && coverage && (
              <>
                <span>|</span>
                <span>
                  Hasil scan ini mencakup{" "}
                  <strong className="font-semibold text-ink-soft">{coverage.coveredAccountCount}</strong>
                  {" "}dari{" "}
                  <strong className="font-semibold text-ink-soft">{coverage.eligibleAccountCount}</strong>
                  {" "}akun
                </span>
              </>
            )}
            {hasData && (
              <>
                <span>|</span>
                <span>
                  <strong className="font-semibold text-ink-soft">{total}</strong> file
                </span>
                <span>|</span>
                <span>
                  <strong className="font-semibold text-ink-soft">{formatBytes(totalSize)}</strong> di halaman ini
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {problemAccounts.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[--radius-sm] border border-warning-strong/40 bg-warning-soft/80 px-4 py-3 text-sm text-warning-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Beberapa file dari akun tersebut tidak bisa dihapus sampai otorisasi diperbarui.
          </p>
        </div>
      )}

      {hasAccounts && hasStoredScan && hasCoverageNudge && (
        <div className="mt-4 flex items-center gap-2 text-xs text-primary-strong">
          <span
            title="Ada akun aktif yang belum tercakup oleh hasil terakhir. Jalankan scan ulang untuk memperbarui kandidat."
            aria-label="Ada akun aktif yang belum tercakup oleh hasil terakhir. Jalankan scan ulang untuk memperbarui kandidat."
          >
            <Info size={15} weight="bold" aria-hidden="true" />
          </span>
          <span>Belum mencakup akun terbaru</span>
        </div>
      )}

      {!hasAccounts && !isLoading && !error ? (
        <div className="mt-8">
          <EmptyState
            icon={<Plugs size={28} weight="duotone" />}
            title="Belum ada akun terhubung"
            description="Hubungkan akun untuk mulai melihat kandidat file besar dan usang lintas Google Drive dan Dropbox."
            action={
              <button
                type="button"
                onClick={() => navigate("/pengaturan/akun")}
                className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong"
              >
                <Plugs size={16} weight="bold" />
                <span>Hubungkan akun pertama</span>
              </button>
            }
          />
        </div>
      ) : !hasActiveAccounts && !hasStoredScan ? (
        <div className="mt-8">
          <EmptyState
            icon={<Broom size={28} weight="duotone" />}
            title="Belum ada akun dengan data lengkap"
            description="Scan file besar dan usang tersedia setelah minimal satu akun selesai dimuat."
            action={
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white opacity-50 disabled:cursor-not-allowed"
              >
                <Broom size={16} weight="bold" />
                <span>Mulai scan</span>
              </button>
            }
          />
        </div>
      ) : !hasStoredScan && !isRefreshing ? (
        <div className="mt-8">
          <EmptyState
            icon={<Broom size={28} weight="duotone" />}
            title="Belum ada hasil scan"
            description="Jalankan scan untuk melihat kandidat file besar dan usang."
            action={
              <button
                type="button"
                onClick={() => void handleScanRefresh()}
                className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong"
              >
                <Broom size={16} weight="bold" />
                <span>Mulai scan</span>
              </button>
            }
          />
        </div>
      ) : (
        <>
          {(hasStoredScan || isRefreshing) && (
          <div className="mt-4">
            <LargeStaleToolbar
              typeFilter={typeFilter}
              onTypeFilterChange={handleTypeFilterChange}
              providerFilter={providerFilter}
              onProviderFilterChange={handleProviderFilterChange}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              isRefreshing={isRefreshing}
              scanLabel={hasStoredScan ? "Scan ulang" : "Mulai scan"}
              onScanRefreshClick={() => void handleScanRefresh()}
              selectedCount={selectedCount}
              selectedTotalSize={selectedTotalSize}
              onDeleteClick={() => setIsDeleteModalOpen(true)}
            />
          </div>
          )}

          <section className="mt-6 min-h-[320px]">
            {isLoading || isRefreshing ? (
              <LargeStaleTableSkeleton />
            ) : error ? (
              <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
                <p className="font-medium">Gagal memuat kandidat file besar dan usang.</p>
                <p className="mt-1 text-xs">{error}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
                >
                  Coba lagi
                </button>
              </div>
            ) : effectiveFiles.length === 0 ? (
              filterActive ? (
                <EmptyState
                  icon={<Funnel size={28} weight="duotone" />}
                  title="Tidak ada hasil untuk filter ini"
                  description="Belum ada file kandidat dengan tipe yang dipilih. Reset filter untuk melihat hasil lain."
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        handleTypeFilterChange("all")
                        handleProviderFilterChange("all")
                      }}
                      className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                    >
                      Tampilkan semua file
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Broom size={28} weight="duotone" />}
                  title="Tidak ada file besar atau usang"
                  description="File milik Anda dalam kondisi rapi. Tidak ada kandidat pembersihan saat ini."
                />
              )
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <select
                      value={pageSize}
                      onChange={(event) =>
                        handlePageSizeChange(Number(event.target.value))
                      }
                      className="rounded-[--radius-sm] border border-line bg-bg px-2 py-1 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
                      aria-label="Jumlah file per halaman"
                    >
                      {LARGE_STALE_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <span>Menampilkan {currentPageStart}-{currentPageEnd} dari {total} file</span>
                  </div>
                  {thresholds && <ThresholdInfoBanner thresholds={thresholds} />}
                </div>
                <LargeStaleTable
                  files={effectiveFiles}
                  selectedFileIds={selectedFileIds}
                  onToggleSelection={toggleSelection}
                />
            {total > pageSize && (
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        handlePageOffset(offset - pageSize)
                      }
                      disabled={!hasPrevPage}
                      className="inline-flex items-center gap-1.5 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handlePageOffset(offset + pageSize)
                      }
                      disabled={!hasNextPage}
                      className="inline-flex items-center gap-1.5 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <BatchDeleteConfirmModal
        open={isDeleteModalOpen}
        files={selectedFiles}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </>
  )
}
