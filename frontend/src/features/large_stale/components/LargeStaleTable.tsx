import type { LargeStaleFile } from "@/features/large_stale/api"
import { LargeStaleRow } from "@/features/large_stale/components/LargeStaleRow"
import { Skeleton } from "@/shared/components/LoadingState"

interface LargeStaleTableProps {
  files: LargeStaleFile[]
  selectedFileIds: ReadonlySet<string>
  onToggleSelection: (id: string) => void
}

const TABLE_HEAD_CLASS =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"

function LargeStaleTableHead() {
  return (
    <thead className="border-b border-line">
      <tr>
        <th className={`${TABLE_HEAD_CLASS} w-8 text-left`}>
          <span className="sr-only">Pilih</span>
        </th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Nama file</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Lokasi</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Ukuran</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Modifikasi terakhir</th>
        <th className={`${TABLE_HEAD_CLASS} text-right`}>Aksi</th>
      </tr>
    </thead>
  )
}

export function LargeStaleTable({
  files,
  selectedFileIds,
  onToggleSelection,
}: LargeStaleTableProps) {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <LargeStaleTableHead />
          <tbody>
            {files.map((file) => (
              <LargeStaleRow
                key={file.id}
                file={file}
                isSelected={selectedFileIds.has(file.id)}
                onToggleSelection={onToggleSelection}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function LargeStaleTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <LargeStaleTableHead />
          <tbody>
            {Array.from({ length: 5 }).map((_, idx) => (
              <tr key={idx} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
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
