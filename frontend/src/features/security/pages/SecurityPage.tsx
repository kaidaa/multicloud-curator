import { useMemo, useState } from "react"
import { CircleNotch, MagnifyingGlass, Plugs, ShieldCheck, WarningCircle } from "@phosphor-icons/react"
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
import { formatDateID } from "@/shared/utils/formatDate"

export function SecurityPage() {
  const {
    mode,
    setMode,
    selectedFileIds,
    toggleSelection,
    removeFromSelection,
  } = useSecurityUiState()

  const { files, scanAt, isLoading, error, refetch, scan, batchRevoke } = useSecurity({
    mode,
  })

  const { accounts } = useAccounts()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [isScanning, setIsScanning] = useState(false)
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false)

  const problemAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.status === "token_invalid" || a.status === "revoked",
      ),
    [accounts],
  )

  // Status akun bersifat dinamis. Derive ulang `deletable` + `deletableReason`
  // dinamis dari AccountsContext supaya row actionability sinkron tanpa
  // re-scan. Pattern identik Feature 4/5. Healthy strict = "active" saja
  // (per FPS): never_synced/syncing/token_invalid/revoked semuanya disable.
  // Kasus is_owned=false (defensive — Feature 6 mock semua owned) dipertahankan
  // apa adanya.
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
        if (!file.isOwned) return file

        const status = accountStatusMap.get(file.accountId)
        if (status === "active") {
          return { ...file, deletable: true, deletableReason: null }
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
      map.set(file.fileId, file)
    }
    return map
  }, [effectiveFiles])

  const selectedFiles = useMemo<SecurityFile[]>(() => {
    const result: SecurityFile[] = []
    for (const fileId of selectedFileIds) {
      const file = fileIndex.get(fileId)
      if (file) result.push(file)
    }
    return result
  }, [selectedFileIds, fileIndex])

  const selectedCount = selectedFiles.length

  async function handleScanClick() {
    if (isScanning) return
    setIsScanning(true)
    try {
      await scan()
      pushToast("Scan keamanan selesai.", "info")
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
    const fileIds = [...selectedFileIds]
    if (fileIds.length === 0) return
    try {
      const result = await batchRevoke(fileIds)
      if (result.revoked.length > 0) {
        removeFromSelection(result.revoked.map((d) => d.fileId))
        pushToast(`${result.revoked.length} file dikembalikan ke privat.`, "success")
      }
      if (result.failed.length > 0) {
        const failedNames = result.failed
          .map((f) => f.message ?? f.errorCode ?? f.fileId)
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
  const hasData = effectiveFiles.length > 0

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Kelola File</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Keamanan File</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Audit file Anda yang berstatus publik. Tinjau alasan file masuk daftar lewat keyword yang cocok, lalu cabut akses jika perlu.
        </p>
        {scanAt && (
          <p className="mt-2 text-xs text-muted-2">
            Scan terakhir: <strong className="font-semibold text-ink-soft">{formatDateID(scanAt)}</strong>
          </p>
        )}
      </header>

      {problemAccounts.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[--radius-sm] border border-warning-strong/20 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Akses publik file dari akun tersebut tidak bisa dicabut sampai otorisasi diperbarui.
          </p>
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
      ) : (
        <>
          <div className="mt-6">
            <SecurityToolbar
              mode={mode}
              onModeChange={setMode}
              isScanning={isScanning}
              onScanClick={() => void handleScanClick()}
              selectedCount={selectedCount}
              onRevokeClick={() => setIsRevokeModalOpen(true)}
            />
          </div>

          {mode === "public" && (
            <p className="mt-3 text-xs text-muted">
              Perlu ditinjau menampilkan file publik yang nama-nya cocok dengan keyword sensitif.
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
              scanAt === null ? (
                <EmptyState
                  icon={<ShieldCheck size={28} weight="duotone" />}
                  title="Belum ada audit keamanan"
                  description="Jalankan scan untuk memeriksa file publik di akun Anda."
                  action={
                    <button
                      type="button"
                      onClick={() => void handleScanClick()}
                      disabled={isScanning}
                      className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MagnifyingGlass size={16} weight="bold" />
                      <span>Mulai scan</span>
                    </button>
                  }
                />
              ) : mode === "sensitive" ? (
                <EmptyState
                  icon={<ShieldCheck size={28} weight="duotone" />}
                  title="Tidak ada file publik yang perlu ditinjau"
                  description={`Audit terakhir: ${formatDateID(scanAt)}. Coba mode "Semua file publik" untuk lihat file lain, atau kelola daftar keyword.`}
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMode("public")}
                        className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                      >
                        Lihat semua file publik
                      </button>
                      <Link
                        to="/pengaturan/keyword"
                        className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                      >
                        Kelola keyword sensitif
                      </Link>
                    </div>
                  }
                />
              ) : (
                <EmptyState
                  icon={<ShieldCheck size={28} weight="duotone" />}
                  title="Tidak ada file publik di akun Anda"
                  description={`Audit terakhir: ${formatDateID(scanAt)}. File Anda tidak berstatus publik saat ini.`}
                />
              )
            ) : (
              <SecurityTable
                files={effectiveFiles}
                selectedFileIds={selectedFileIds}
                onToggleSelection={toggleSelection}
              />
            )}
          </section>

          {hasData && mode === "sensitive" && (
            <p className="mt-4 text-xs text-muted">
              Tidak ada keyword yang relevan?{" "}
              <Link to="/pengaturan/keyword" className="text-primary-strong underline">
                Kelola keyword sensitif
              </Link>
            </p>
          )}
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
