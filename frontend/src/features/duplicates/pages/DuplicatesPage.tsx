import { useMemo, useState } from "react"
import {
  ArrowsClockwise,
  CircleNotch,
  CopySimple,
  Funnel,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react"

import type { Account } from "@/features/accounts/api"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import type { DuplicateGroup, DuplicateMember } from "@/features/duplicates/api"
import { BatchDeleteConfirmModal } from "@/features/duplicates/components/BatchDeleteConfirmModal"
import { DuplicateGroupAccordion } from "@/features/duplicates/components/DuplicateGroupAccordion"
import { DuplicatesToolbar } from "@/features/duplicates/components/DuplicatesToolbar"
import { useDuplicatesUiState } from "@/features/duplicates/contexts/DuplicatesUiStateContext"
import { useDuplicates } from "@/features/duplicates/hooks/useDuplicates"
import { EmptyState } from "@/shared/components/EmptyState"
import { Skeleton } from "@/shared/components/LoadingState"
import { useToast } from "@/shared/hooks/useToast"
import { formatDateID } from "@/shared/utils/formatDate"

export function DuplicatesPage() {
  const {
    typeFilter,
    setTypeFilter,
    selectedFileIds,
    toggleSelection,
    clearSelection,
    removeFromSelection,
    openGroupIds,
    toggleOpenGroup,
    resetOpenGroups,
  } = useDuplicatesUiState()

  const { groups, total, scanAt, isLoading, error, refetch, scan, batchDelete } =
    useDuplicates({ typeFilter })

  const { accounts } = useAccounts()
  const { pushToast } = useToast()

  const [isScanning, setIsScanning] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const problemAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.status === "token_invalid" || a.status === "revoked",
      ),
    [accounts],
  )

  // Status akun bersifat dinamis (user bisa reauthorize kapan saja),
  // sedangkan field `deletable`/`deletableReason` di mock adalah snapshot
  // saat scan terakhir. Derive ulang per member supaya row actionability
  // sinkron dengan AccountsContext tanpa perlu re-scan. Healthy strict =
  // "active" saja (per FPS). Kasus shared (is_owned=false) dipertahankan
  // permanen non-deletable.
  const accountStatusMap = useMemo(() => {
    const map = new Map<string, Account["status"]>()
    for (const account of accounts) {
      map.set(account.id, account.status)
    }
    return map
  }, [accounts])

  const effectiveGroups = useMemo<DuplicateGroup[]>(
    () =>
      groups.map((group) => ({
        ...group,
        members: group.members.map((member) => {
          if (!member.isOwned) return member

          const status = accountStatusMap.get(member.accountId)
          if (status === "active") {
            return { ...member, deletable: true, deletableReason: null }
          }

          return {
            ...member,
            deletable: false,
            deletableReason: "Akun perlu otorisasi ulang sebelum file bisa dihapus",
          }
        }),
      })),
    [groups, accountStatusMap],
  )

  const totalFiles = useMemo(
    () => effectiveGroups.reduce((sum, g) => sum + g.membersCount, 0),
    [effectiveGroups],
  )

  // Lookup map untuk hitung total size selection lintas grup tanpa O(n²).
  const memberIndex = useMemo(() => {
    const map = new Map<string, DuplicateMember>()
    for (const group of effectiveGroups) {
      for (const member of group.members) {
        map.set(member.fileId, member)
      }
    }
    return map
  }, [effectiveGroups])

  const selectedMembers = useMemo<DuplicateMember[]>(() => {
    const result: DuplicateMember[] = []
    for (const fileId of selectedFileIds) {
      const member = memberIndex.get(fileId)
      if (member) result.push(member)
    }
    return result
  }, [selectedFileIds, memberIndex])

  const selectedCount = selectedMembers.length
  const selectedTotalSize = useMemo(
    () => selectedMembers.reduce((sum, m) => sum + m.sizeBytes, 0),
    [selectedMembers],
  )

  async function handleScanClick() {
    if (isScanning) return
    setIsScanning(true)
    try {
      await scan()
      clearSelection()
      resetOpenGroups()
      pushToast(`Scan selesai. ${total} grup ditemukan.`, "info")
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Scan gagal. Coba lagi.",
        "error",
      )
    } finally {
      setIsScanning(false)
    }
  }

  async function handleConfirmDelete() {
    const fileIds = [...selectedFileIds]
    if (fileIds.length === 0) return
    try {
      const result = await batchDelete(fileIds)
      if (result.deleted.length > 0) {
        removeFromSelection(result.deleted.map((d) => d.fileId))
        pushToast(`${result.deleted.length} file berhasil dihapus.`, "success")
      }
      if (result.failed.length > 0) {
        const failedNames = result.failed
          .map((f) => f.message ?? f.errorCode ?? f.fileId)
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

  const hasData = effectiveGroups.length > 0
  const hasEverScanned = scanAt !== null

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Kelola File</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Duplikasi</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Tinjau kelompok file yang dianggap duplikat. File shared hanya ditampilkan sebagai konteks dan tidak dapat dihapus.
        </p>
        {hasEverScanned && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
            <span>
              Scan terakhir: <strong className="font-semibold text-ink-soft">{formatDateID(scanAt)}</strong>
            </span>
            {hasData && (
              <>
                <span>·</span>
                <span>
                  <strong className="font-semibold text-ink-soft">{total}</strong> grup
                </span>
                <span>·</span>
                <span>
                  <strong className="font-semibold text-ink-soft">{totalFiles}</strong> file
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {problemAccounts.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[--radius-sm] border border-warning-strong/20 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Beberapa file dari akun tersebut tidak bisa dihapus sampai otorisasi diperbarui.
          </p>
        </div>
      )}

      {(hasData || isLoading || isScanning) && (
        <div className="mt-6">
          <DuplicatesToolbar
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            isScanning={isScanning}
            onScanClick={() => void handleScanClick()}
            selectedCount={selectedCount}
            selectedTotalSize={selectedTotalSize}
            onDeleteClick={() => setIsDeleteModalOpen(true)}
          />
        </div>
      )}

      <section className="mt-6 min-h-[320px]">
        {isScanning ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[--radius] border border-line bg-panel px-6 py-12 text-center">
            <CircleNotch size={28} className="animate-spin text-primary" weight="bold" />
            <p className="text-sm font-semibold text-ink">Scan duplikasi sedang berjalan</p>
            <p className="text-xs text-muted">
              Halaman tetap responsif, Anda bisa berpindah ke menu lain.
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
            <p className="font-medium">Gagal memuat hasil scan duplikat.</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
            >
              Coba lagi
            </button>
          </div>
        ) : effectiveGroups.length === 0 ? (
          hasEverScanned ? (
            // Empty post-scan. Bedakan: kalau filter aktif (bukan "all") berarti
            // tidak ada match untuk filter ini; selain itu memang scan tidak
            // menemukan duplikat sama sekali.
            typeFilter !== "all" ? (
              <EmptyState
                icon={<Funnel size={28} weight="duotone" />}
                title="Tidak ada grup untuk filter ini"
                description={`Belum ada duplikat dengan tipe yang dipilih. Reset filter atau ganti tipe untuk melihat hasil lain.`}
                action={
                  <button
                    type="button"
                    onClick={() => setTypeFilter("all")}
                    className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                  >
                    Tampilkan semua tipe
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<CopySimple size={28} weight="duotone" />}
                title="Tidak ada duplikat terdeteksi"
                description={`Scan terakhir: ${formatDateID(scanAt)}. Jika kondisi berubah, jalankan scan ulang.`}
                action={
                  <button
                    type="button"
                    onClick={() => void handleScanClick()}
                    disabled={isScanning}
                    className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowsClockwise size={14} weight="bold" />
                    <span>Scan ulang</span>
                  </button>
                }
              />
            )
          ) : (
            <EmptyState
              icon={<MagnifyingGlass size={28} weight="duotone" />}
              title="Belum ada hasil scan"
              description="Jalankan scan untuk mendeteksi file duplikat lintas akun terhubung."
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
          )
        ) : (
          <div className="space-y-2">
            {effectiveGroups.map((group) => (
              <DuplicateGroupAccordion
                key={group.id}
                group={group}
                isOpen={openGroupIds.has(group.id)}
                onToggleOpen={toggleOpenGroup}
                selectedFileIds={selectedFileIds}
                onToggleSelection={toggleSelection}
              />
            ))}
          </div>
        )}
      </section>

      <BatchDeleteConfirmModal
        open={isDeleteModalOpen}
        files={selectedMembers}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </>
  )
}
