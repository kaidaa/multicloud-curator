import { useEffect, useMemo, useState } from "react"
import { CircleNotch, Info, MagnifyingGlass, Plugs, ShieldCheck, WarningCircle } from "@phosphor-icons/react"
import { Link, useNavigate } from "react-router-dom"

import type { Account } from "@/features/accounts/api"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import type { SecurityFile } from "@/features/security/api"
import { BatchRevokeConfirmModal } from "@/features/security/components/BatchRevokeConfirmModal"
import {
  SecurityTable,
  SecurityTableSkeleton,
} from "@/features/security/components/SecurityTable"
import { SecurityToolbar } from "@/features/security/components/SecurityToolbar"
import { useSecurityUiState } from "@/features/security/contexts/SecurityUiStateContext"
import { useSecurity } from "@/features/security/hooks/useSecurity"
import { EmptyState } from "@/shared/components/EmptyState"
import { useToast } from "@/shared/hooks/useToast"
import { getAccountLifecycleSummary } from "@/shared/utils/accountLifecycle"
import { formatDateID } from "@/shared/utils/formatDate"
import {
  hasNewActiveAccountsOutsideCoverage,
  shouldShowCoverageRatio,
} from "@/shared/utils/scanCoverage"

const SECURITY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_SECURITY_PAGE_SIZE = 50

export function SecurityPage() {
  const {
    mode,
    setMode,
    providerFilter,
    setProviderFilter,
    selectedFileIds,
    markScanRequested,
    toggleSelection,
    clearSelection,
    removeFromSelection,
  } = useSecurityUiState()

  const { accounts } = useAccounts()
  const { hasActiveAccounts, problemAccounts } = useMemo(
    () => getAccountLifecycleSummary(accounts),
    [accounts],
  )

  const { files, scanAt, coverage, isLoading, error, refetch, scan, batchRevoke } = useSecurity({
    mode,
    providerFilter,
    enabled: hasActiveAccounts,
  })

  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [isScanning, setIsScanning] = useState(false)
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_SECURITY_PAGE_SIZE)

  useEffect(() => {
    if (hasActiveAccounts) return
    clearSelection()
  }, [clearSelection, hasActiveAccounts])

  // Overlay status akun terkini hanya boleh menambah disable state; backend
  // `deletable=false` tetap menang.
  const accountStatusMap = useMemo(() => {
    const map = new Map<string, Account["status"]>()
    for (const account of accounts) {
      map.set(account.id, account.status)
    }
    return map
  }, [accounts])

  const effectiveFiles = useMemo<SecurityFile[]>(
    () =>
      files.map((file) => {
        if (!file.deletable) return file
        if (!file.isOwned) {
          return {
            ...file,
            deletable: false,
            deletableReason:
              file.deletableReason ??
              "File shared tidak bisa dicabut akses publiknya dari aplikasi ini",
          }
        }

        const status = accountStatusMap.get(file.accountId)
        if (status === "active") {
          return file
        }

        return {
          ...file,
          deletable: false,
          deletableReason: "Akun perlu otorisasi ulang sebelum akses publik bisa dicabut",
        }
      }),
    [files, accountStatusMap],
  )

  // Lookup map untuk modal target dari selection.
  const fileIndex = useMemo(() => {
    const map = new Map<string, SecurityFile>()
    for (const file of effectiveFiles) {
      map.set(file.id, file)
    }
    return map
  }, [effectiveFiles])

  const selectedFiles = useMemo<SecurityFile[]>(() => {
    const result: SecurityFile[] = []
    for (const id of selectedFileIds) {
      const file = fileIndex.get(id)
      if (file) result.push(file)
    }
    return result
  }, [selectedFileIds, fileIndex])

  const selectedCount = selectedFiles.length
  const paginatedFiles = useMemo(
    () => effectiveFiles.slice(offset, offset + pageSize),
    [effectiveFiles, offset, pageSize],
  )
  const currentPageStart = effectiveFiles.length === 0 ? 0 : offset + 1
  const currentPageEnd = Math.min(offset + paginatedFiles.length, effectiveFiles.length)
  const hasPrevPage = offset > 0
  const hasNextPage = offset + pageSize < effectiveFiles.length

  useEffect(() => {
    if (offset === 0 || offset < effectiveFiles.length) return
    const lastValidOffset =
      effectiveFiles.length > 0
        ? Math.floor((effectiveFiles.length - 1) / pageSize) * pageSize
        : 0
    clearSelection()
    setOffset(lastValidOffset)
  }, [clearSelection, effectiveFiles.length, offset, pageSize])

  function handleModeChange(nextMode: typeof mode) {
    clearSelection()
    setOffset(0)
    setMode(nextMode)
  }

  function handleProviderFilterChange(nextProvider: typeof providerFilter) {
    clearSelection()
    setOffset(0)
    setProviderFilter(nextProvider)
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

  async function handleScanClick() {
    if (isScanning || !hasActiveAccounts) return
    setIsScanning(true)
    try {
      const result = await scan()
      markScanRequested()
      clearSelection()
      if (result && result.files.length > 0) {
        pushToast(`Scan keamanan selesai. ${result.files.length} file ditemukan.`, "info")
      }
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Scan keamanan gagal. Coba lagi.",
        "error",
      )
    } finally {
      setIsScanning(false)
    }
  }

  async function handleConfirmRevoke() {
    const ids = [...selectedFileIds]
    if (ids.length === 0) return
    try {
      const result = await batchRevoke(ids)
      if (result.revoked.length > 0) {
        removeFromSelection(result.revoked.map((d) => d.id))
        pushToast(`${result.revoked.length} file dikembalikan ke privat.`, "success")
      }
      if (result.failed.length > 0) {
        const failedNames = result.failed
          .map((f) => f.message ?? f.errorCode ?? f.id)
          .join("; ")
        pushToast(
          `${result.failed.length} file gagal dicabut: ${failedNames}`,
          "error",
        )
      }
      setIsRevokeModalOpen(false)
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Pencabutan gagal. Coba lagi.",
        "error",
      )
    }
  }

  const hasAccounts = accounts.length > 0
  const hasStoredScan = scanAt !== null
  const hasData = hasStoredScan && effectiveFiles.length > 0
  const providerFilterActive = providerFilter !== "all"
  const showCoverageRatio = shouldShowCoverageRatio(coverage)
  const hasCoverageNudge = hasNewActiveAccountsOutsideCoverage(coverage, accounts)

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Kelola File</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Keamanan File</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Audit file Anda yang berstatus publik. Tinjau alasan file masuk daftar lewat keyword yang cocok, lalu cabut akses jika perlu.
        </p>
        {hasActiveAccounts && hasStoredScan && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
            <span>
              Scan terakhir: <strong className="font-semibold text-ink-soft">{formatDateID(scanAt)}</strong>
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
          </div>
        )}
      </header>

      {problemAccounts.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[--radius-sm] border border-warning-strong/40 bg-warning-soft/80 px-4 py-3 text-sm text-warning-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Akses publik file dari akun tersebut tidak bisa dicabut sampai otorisasi diperbarui.
          </p>
        </div>
      )}

      {hasActiveAccounts && hasStoredScan && hasCoverageNudge && (
        <div className="mt-4 flex items-center gap-2 text-xs text-primary-strong">
          <span
            title="Ada akun aktif yang belum tercakup oleh hasil scan terakhir. Jalankan scan ulang untuk memperbarui hasil."
            aria-label="Ada akun aktif yang belum tercakup oleh hasil scan terakhir. Jalankan scan ulang untuk memperbarui hasil."
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
            description="Hubungkan akun untuk mulai mengaudit file publik di Google Drive dan Dropbox."
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
      ) : !hasActiveAccounts ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShieldCheck size={28} weight="duotone" />}
            title="Belum ada akun dengan data lengkap"
            description="Scan keamanan tersedia setelah minimal satu akun selesai dimuat."
            action={
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white opacity-50 disabled:cursor-not-allowed"
              >
                <MagnifyingGlass size={16} weight="bold" />
                <span>Mulai scan</span>
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <SecurityToolbar
              mode={mode}
              onModeChange={handleModeChange}
              providerFilter={providerFilter}
              onProviderFilterChange={handleProviderFilterChange}
              isScanning={isScanning}
              scanLabel={hasStoredScan ? "Scan ulang" : "Mulai scan"}
              onScanClick={() => void handleScanClick()}
              selectedCount={selectedCount}
              onRevokeClick={() => setIsRevokeModalOpen(true)}
            />
          </div>

          {hasStoredScan && mode === "public" && (
            <p className="mt-3 text-xs text-muted">
              Menampilkan semua file yang saat ini dapat diakses publik.
            </p>
          )}

          {hasStoredScan && mode === "sensitive" && (
            <p className="mt-3 text-xs text-muted">
              Tidak ada keyword yang relevan?{" "}
              <Link to="/pengaturan/keyword" className="text-primary-strong underline">
                Kelola keyword sensitif
              </Link>
            </p>
          )}

          <section className="mt-4 min-h-[320px]">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[--radius] border border-line bg-panel px-6 py-12 text-center">
                <CircleNotch size={28} className="animate-spin text-primary" weight="bold" />
                <p className="text-sm font-semibold text-ink">Scan keamanan sedang berjalan</p>
                <p className="text-xs text-muted">
                  Halaman tetap responsif, Anda bisa berpindah ke menu lain.
                </p>
              </div>
            ) : isLoading ? (
              <SecurityTableSkeleton />
            ) : error ? (
              <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
                <p className="font-medium">Gagal memuat hasil audit keamanan.</p>
                <p className="mt-1 text-xs">{error}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
                >
                  Coba lagi
                </button>
              </div>
            ) : !hasData ? (
              !hasStoredScan ? (
                <EmptyState
                  icon={<ShieldCheck size={28} weight="duotone" />}
                  title="Belum ada audit keamanan"
                  description="Jalankan scan untuk memeriksa file publik di akun Anda."
                />
              ) : mode === "sensitive" ? (
                <EmptyState
                  icon={<ShieldCheck size={28} weight="duotone" />}
                  title="Tidak ada file publik yang perlu ditinjau"
                  description={`Audit terakhir: ${formatDateID(scanAt)}. Coba filter "Semua file publik" untuk lihat file lain, atau kelola daftar keyword.`}
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleModeChange("public")}
                        className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                      >
                        Lihat semua file publik
                      </button>
                      {providerFilterActive && (
                        <button
                          type="button"
                          onClick={() => handleProviderFilterChange("all")}
                          className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                        >
                          Tampilkan semua provider
                        </button>
                      )}
                    </div>
                  }
                />
              ) : (
                <EmptyState
                  icon={<ShieldCheck size={28} weight="duotone" />}
                  title={
                    providerFilterActive
                      ? "Tidak ada file publik untuk provider ini"
                      : "Tidak ada file publik di akun Anda"
                  }
                  description={`Audit terakhir: ${formatDateID(scanAt)}. File Anda tidak berstatus publik saat ini.`}
                  action={
                    providerFilterActive ? (
                      <button
                        type="button"
                        onClick={() => handleProviderFilterChange("all")}
                        className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                      >
                        Tampilkan semua provider
                      </button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 text-xs text-muted">
                  <select
                    value={pageSize}
                    onChange={(event) =>
                      handlePageSizeChange(Number(event.target.value))
                    }
                    className="rounded-[--radius-sm] border border-line bg-bg px-2 py-1 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
                    aria-label="Jumlah file per halaman"
                  >
                    {SECURITY_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span>
                    Menampilkan {currentPageStart}-{currentPageEnd} dari {effectiveFiles.length} file
                  </span>
                </div>
                <SecurityTable
                  files={paginatedFiles}
                  selectedFileIds={selectedFileIds}
                  onToggleSelection={toggleSelection}
                />
                {effectiveFiles.length > pageSize && (
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handlePageOffset(offset - pageSize)}
                      disabled={!hasPrevPage}
                      className="inline-flex items-center gap-1.5 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePageOffset(offset + pageSize)}
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

      <BatchRevokeConfirmModal
        open={isRevokeModalOpen}
        files={selectedFiles}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setIsRevokeModalOpen(false)}
      />
    </>
  )
}
