import { ClockCounterClockwise } from "@phosphor-icons/react"

import type { ActivityFile } from "@/features/explore/api"
import { ActivityRow } from "@/features/explore/components/ActivityRow"
import { EmptyState } from "@/shared/components/EmptyState"
import { Skeleton } from "@/shared/components/LoadingState"

interface ActivityListProps {
  files: ActivityFile[]
  isLoading: boolean
  error: string | null
  onRetry?: () => void
}

const TABLE_HEAD_CLASS =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"

function ActivityTableHead() {
  return (
    <thead className="border-b border-line">
      <tr>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Nama berkas</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Lokasi</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Dimodifikasi</th>
        <th className={`${TABLE_HEAD_CLASS} text-right`}>Aksi</th>
      </tr>
    </thead>
  )
}

export function ActivityList({ files, isLoading, error, onRetry }: ActivityListProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <ActivityTableHead />
            <tbody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
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

  if (error) {
    return (
      <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
        <p className="font-medium">Gagal memuat aktivitas terkini.</p>
        <p className="mt-1 text-xs">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
          >
            Coba lagi
          </button>
        )}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <EmptyState
        icon={<ClockCounterClockwise size={28} weight="duotone" />}
        title="Belum ada aktivitas"
        description="Setelah akun di-refresh, file terbaru lintas akun akan muncul di sini."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <ActivityTableHead />
          <tbody>
            {files.map((file) => (
              <ActivityRow key={file.id} file={file} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
