export type LocationType = "MY_DRIVE" | "SHARED_WITH_ME" | "SHARED_DRIVE" | "UNKNOWN"

const LOCATION_LABELS: Record<LocationType, string> = {
  MY_DRIVE: "My Drive",
  SHARED_WITH_ME: "Dibagikan ke saya",
  SHARED_DRIVE: "Shared Drive",
  UNKNOWN: "Lokasi tidak diketahui",
}

export function formatFileLocation(
  path: string | null,
  locationType: LocationType | null,
): string {
  if (path?.trim()) {
    return path
  }
  if (locationType) {
    return LOCATION_LABELS[locationType] ?? "Lokasi tidak diketahui"
  }
  return "—"
}
