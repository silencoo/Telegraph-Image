import { Images } from "lucide-react"

import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  size?: "sm" | "default"
}

export function BrandMark({ className, size = "default" }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20",
        size === "sm" ? "size-8" : "size-9",
        className,
      )}
    >
      <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-primary-foreground/20" />
      <Images className={size === "sm" ? "size-4" : "size-5"} strokeWidth={2.2} />
    </span>
  )
}
