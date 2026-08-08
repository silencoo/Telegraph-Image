import { Ban, Heart, ShieldCheck, UserRoundX } from "lucide-react"

import type { AdminCopy } from "@/admin/copy"
import type { ManagedFile } from "@/admin/types"
import { Badge } from "@/components/ui/badge"

export function FileStatus({ copy, file }: { copy: AdminCopy; file: ManagedFile }) {
  if (file.metadata.ListType === "Block") {
    return <Badge variant="destructive"><Ban aria-hidden="true" />{copy.blacklist}</Badge>
  }

  if (file.metadata.ListType === "White") {
    return <Badge variant="secondary"><ShieldCheck aria-hidden="true" />{copy.whitelist}</Badge>
  }

  if (file.metadata.Label?.toLowerCase() === "adult") {
    return <Badge variant="destructive"><UserRoundX aria-hidden="true" />{copy.adult}</Badge>
  }

  if (file.metadata.liked) {
    return <Badge variant="outline"><Heart className="fill-current" aria-hidden="true" />{copy.liked}</Badge>
  }

  return <Badge variant="outline">{copy.normal}</Badge>
}
