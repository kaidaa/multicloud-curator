import {
  File as FileGeneric,
  FileAudio,
  FileDoc,
  FileImage,
  FilePdf,
  FilePpt,
  FileText,
  FileVideo,
  FileXls,
  FileZip,
  type Icon,
} from "@phosphor-icons/react"

interface FileIconProps {
  // Backend bisa kirim extension di field `type` (mis. "xlsx") atau mime di
  // `mime_type`. Helper menerima dua-duanya, ekstensi diutamakan karena lebih
  // ringkas dan match dengan icon set Phosphor.
  type?: string | null
  mimeType?: string | null
  size?: number
  className?: string
}

function selectIcon(type: string | undefined | null, mimeType: string | undefined | null): Icon {
  const normalized = (type ?? "").toLowerCase()
  if (normalized) {
    if (["doc", "docx", "odt"].includes(normalized)) return FileDoc
    if (["xls", "xlsx", "csv", "ods"].includes(normalized)) return FileXls
    if (["ppt", "pptx", "key", "odp"].includes(normalized)) return FilePpt
    if (normalized === "pdf") return FilePdf
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(normalized)) return FileImage
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(normalized)) return FileVideo
    if (["mp3", "wav", "flac", "ogg", "m4a"].includes(normalized)) return FileAudio
    if (["zip", "rar", "7z", "tar", "gz"].includes(normalized)) return FileZip
    if (["txt", "md", "markdown", "log"].includes(normalized)) return FileText
  }

  const mime = (mimeType ?? "").toLowerCase()
  if (mime.startsWith("image/")) return FileImage
  if (mime.startsWith("video/")) return FileVideo
  if (mime.startsWith("audio/")) return FileAudio
  if (mime === "application/pdf") return FilePdf
  if (mime.includes("spreadsheet") || mime.includes("excel")) return FileXls
  if (mime.includes("presentation") || mime.includes("powerpoint")) return FilePpt
  if (mime.includes("word") || mime.includes("document")) return FileDoc
  if (mime.startsWith("text/")) return FileText
  if (mime.includes("zip") || mime.includes("compressed")) return FileZip

  return FileGeneric
}

export function FileIcon({ type, mimeType, size = 20, className }: FileIconProps) {
  const Icon = selectIcon(type, mimeType)
  return <Icon size={size} className={className} weight="regular" />
}
