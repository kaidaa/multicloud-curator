import { CaretDown, CaretRight } from "@phosphor-icons/react"

import type { DuplicateGroup } from "@/features/duplicates/api"
import { DuplicateMemberRow } from "@/features/duplicates/components/DuplicateMemberRow"
import { formatBytes } from "@/shared/utils/formatSize"

interface DuplicateGroupAccordionProps {
  group: DuplicateGroup
  isOpen: boolean
  onToggleOpen: (groupId: string) => void
  selectedFileIds: ReadonlySet<string>
  onToggleSelection: (id: string) => void
}

export function DuplicateGroupAccordion({
  group,
  isOpen,
  onToggleOpen,
  selectedFileIds,
  onToggleSelection,
}: DuplicateGroupAccordionProps) {
  return (
    <article className="overflow-hidden rounded-[--radius-sm] border border-line bg-panel">
      <button
        type="button"
        onClick={() => onToggleOpen(group.id)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-panel-soft/60"
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-muted">
          {isOpen ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{group.representativeName}</p>
          <p className="text-xs text-muted">
            {group.membersCount} anggota · {formatBytes(group.totalSizeBytes)}
          </p>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-line">
          {group.members.map((member) => (
            <DuplicateMemberRow
              key={member.id}
              member={member}
              isSelected={selectedFileIds.has(member.id)}
              onToggleSelection={onToggleSelection}
            />
          ))}
        </div>
      )}
    </article>
  )
}
