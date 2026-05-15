import type {
  SearchProviderFilter,
  SearchSort,
  SearchTypeFilter,
} from "@/features/search/api"

interface SearchFiltersProps {
  ownedOnly: boolean
  provider: SearchProviderFilter
  fileType: SearchTypeFilter
  sort: SearchSort
  onOwnedOnlyChange: (value: boolean) => void
  onProviderChange: (value: SearchProviderFilter) => void
  onFileTypeChange: (value: SearchTypeFilter) => void
  onSortChange: (value: SearchSort) => void
}

const SCOPE_OPTIONS = [
  { value: "all", label: "Semua file" },
  { value: "owned", label: "Milik saya" },
] as const

const PROVIDER_OPTIONS: ReadonlyArray<{ value: SearchProviderFilter; label: string }> = [
  { value: "all", label: "Semua provider" },
  { value: "google", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
]

const TYPE_OPTIONS: ReadonlyArray<{ value: SearchTypeFilter; label: string }> = [
  { value: "all", label: "Semua tipe" },
  { value: "photo", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "document", label: "Dokumen" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Lainnya" },
]

const SORT_OPTIONS: ReadonlyArray<{ value: SearchSort; label: string }> = [
  { value: "modified_desc", label: "Modifikasi terbaru" },
  { value: "modified_asc", label: "Modifikasi terlama" },
  { value: "name_asc", label: "Nama (A-Z)" },
]

interface FilterDropdownProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterDropdownProps<T>) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="font-medium uppercase tracking-[0.14em] text-muted-2">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SearchFilters({
  ownedOnly,
  provider,
  fileType,
  sort,
  onOwnedOnlyChange,
  onProviderChange,
  onFileTypeChange,
  onSortChange,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FilterDropdown
        label="Cakupan"
        value={ownedOnly ? "owned" : "all"}
        options={SCOPE_OPTIONS}
        onChange={(value) => onOwnedOnlyChange(value === "owned")}
      />
      <FilterDropdown
        label="Provider"
        value={provider}
        options={PROVIDER_OPTIONS}
        onChange={onProviderChange}
      />
      <FilterDropdown
        label="Tipe file"
        value={fileType}
        options={TYPE_OPTIONS}
        onChange={onFileTypeChange}
      />
      <FilterDropdown
        label="Urutkan"
        value={sort}
        options={SORT_OPTIONS}
        onChange={onSortChange}
      />
    </div>
  )
}
