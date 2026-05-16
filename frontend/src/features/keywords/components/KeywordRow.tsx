import type { Keyword } from "@/features/keywords/api"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { ToggleSwitch } from "@/shared/components/ToggleSwitch"

interface KeywordRowProps {
  keyword: Keyword
  isPendingDelete: boolean
  onToggle: (id: string) => void
  onAskDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}

export function KeywordRow({
  keyword,
  isPendingDelete,
  onToggle,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: KeywordRowProps) {
  const isDefault = keyword.category === "default"

  return (
    <tr
      className={`border-b border-line transition last:border-b-0 hover:bg-panel-soft/60 ${
        keyword.active ? "" : "opacity-60"
      }`}
    >
      <td className="px-4 py-3 text-sm font-medium text-ink">{keyword.word}</td>

      <td className="px-4 py-3">
        <StatusBadge variant="neutral">
          {isDefault ? "Default" : "Kustom"}
        </StatusBadge>
      </td>

      <td className="px-4 py-3">
        <ToggleSwitch
          checked={keyword.active}
          onChange={() => onToggle(keyword.id)}
          aria-label={
            keyword.active
              ? `Nonaktifkan keyword ${keyword.word}`
              : `Aktifkan keyword ${keyword.word}`
          }
        />
      </td>

      <td className="px-4 py-3">
        {isDefault ? (
          <span className="text-xs text-muted-2">Tidak dapat dihapus</span>
        ) : isPendingDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onConfirmDelete(keyword.id)}
              className="inline-flex items-center gap-1 rounded-[--radius-sm] bg-danger px-2.5 py-1 text-xs font-medium text-white transition hover:bg-danger-strong"
            >
              Konfirmasi
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="inline-flex items-center gap-1 rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
            >
              Batal
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAskDelete(keyword.id)}
            className="inline-flex items-center gap-1 rounded-[--radius-sm] px-2.5 py-1 text-xs font-medium text-danger-strong transition hover:bg-danger-soft"
          >
            Hapus
          </button>
        )}
      </td>
    </tr>
  )
}
