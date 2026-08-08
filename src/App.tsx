import { useEffect, useState } from "react"

import { UploadWorkspace } from "@/components/upload-workspace"
import { Toaster } from "@/components/ui/sonner"
import { messages } from "@/i18n"
import { useLocale } from "@/hooks/use-locale"

interface SiteConfig {
  backgroundImage: string
  imageUploadModeAvailable: boolean
  siteName: string
  siteTitle: string
}

const defaultConfig: SiteConfig = {
  backgroundImage: "",
  imageUploadModeAvailable: true,
  siteName: "Telegraph-Image",
  siteTitle: "",
}

export default function App() {
  const { locale } = useLocale()
  const copy = messages[locale]
  const [config, setConfig] = useState(defaultConfig)

  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/config", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Config unavailable")
        return response.json() as Promise<Partial<SiteConfig>>
      })
      .then((data) => {
        setConfig((current) => ({ ...current, ...data }))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const usesDefaultTitle =
      !config.siteTitle || config.siteTitle === "Telegraph-Image | 免费图床"
    document.title = usesDefaultTitle
      ? `${config.siteName} | ${copy.metaTitle}`
      : config.siteTitle

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    description?.setAttribute("content", copy.metaDescription)
  }, [config.siteName, config.siteTitle, copy.metaDescription, copy.metaTitle])

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {config.backgroundImage ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 bg-cover bg-center opacity-12 dark:opacity-8"
          style={{ backgroundImage: `url(${JSON.stringify(config.backgroundImage)})` }}
        />
      ) : null}
      <div aria-hidden="true" className="fixed inset-0 -z-20 bg-background" />

      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        {copy.skipToContent}
      </a>

      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <UploadWorkspace
          locale={locale}
          copy={copy}
          imageUploadModeAvailable={config.imageUploadModeAvailable}
        />
      </main>

      <Toaster position="bottom-center" richColors closeButton />
    </div>
  )
}
