import { FileAudio, FileText } from "lucide-react"

import { getFileHref, getFileKind } from "@/admin/file-utils"
import type { ManagedFile } from "@/admin/types"
import { cn } from "@/lib/utils"

interface FilePreviewProps {
  className?: string
  detailed?: boolean
  file: ManagedFile
}

export function FilePreview({ className, detailed = false, file }: FilePreviewProps) {
  const kind = getFileKind(file.name)
  const source = getFileHref(file)
  const commonClass = cn("size-full object-cover", className)

  if (kind === "image") {
    return (
      <img
        src={source}
        alt={detailed ? file.metadata.fileName : ""}
        className={commonClass}
        loading="lazy"
        decoding="async"
      />
    )
  }

  if (kind === "video") {
    return (
      <video className={commonClass} preload="metadata" muted={!detailed} playsInline controls={detailed}>
        <source src={source} />
      </video>
    )
  }

  if (kind === "audio" && detailed) {
    return (
      <div className={cn("flex size-full items-center justify-center bg-muted px-6", className)}>
        <audio className="w-full" src={source} controls preload="metadata" />
      </div>
    )
  }

  const Icon = kind === "audio" ? FileAudio : FileText

  return (
    <div className={cn("flex size-full items-center justify-center bg-muted text-muted-foreground", className)}>
      <Icon className="size-8" aria-hidden="true" />
    </div>
  )
}
