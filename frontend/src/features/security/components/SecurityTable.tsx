import type { SecurityFile } from "@/features/security/api"
import { SecurityRow } from "@/features/security/components/SecurityRow"
import { Skeleton } from "@/shared/components/LoadingState"

interface SecurityTableProps {
  files: SecurityFile[]
  selectedFileIds: ReadonlySet<string>
  onToggleSelection: (fileId: string) => void
}

const TABLE_HEAD_CLASS =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"

function SecurityTableHead() {
  return (
    <thead className="border-b border-line">
      <tr>
        <th className={`${TABLE_HEAD_CLASS} w-8 text-left`}>
          <span className="sr-only">Pilih</span>
        </th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Nama file</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Lokasi</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Keyword cocok</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Dimodifikasi</th>
        <th className={`${TABLE_HEAD_CLASS} text-right`}>Aksi</th>
      </tr>
    </thead>
  )
}

export function SecurityTable({
  files,
  selectedFileIds,
  onToggleSelection,
}: SecurityTableProps) {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <SecurityTableHead />
          <tbody>
            {files.map((file) => (
              <SecurityRow
                key={file.id}
                file={file}
                isSelected={selectedFileIds.has(file.fileId)}
                onToggleSelection={onToggleSelection}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SecurityTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <SecurityTableHead />
          <tbody>
            {Array.from({ length: 4 }).map((_, idx) => (
              <tr key={idx} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="ml-auto h-7 w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
