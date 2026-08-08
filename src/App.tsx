import { useEffect, useState } from "react"
import { Languages, LayoutDashboard } from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { UploadWorkspace } from "@/components/upload-workspace"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { messages } from "@/i18n"
import { useLocale } from "@/hooks/use-locale"

interface SiteConfig {
  backgroundImage: string
  showAdminEntry: boolean
  siteName: string
  siteTitle: string
}

const defaultConfig: SiteConfig = {
  backgroundImage: "",
  showAdminEntry: true,
  siteName: "Telegraph-Image",
  siteTitle: "",
}

export default function App() {
  const { locale, toggleLocale } = useLocale()
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

      <header className="border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark />
            <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
              {config.siteName}
            </span>
          </a>

          <nav className="flex shrink-0 items-center gap-1" aria-label={copy.utilityNavigation}>
            {config.showAdminEntry ? (
              <Button variant="ghost" size="sm" asChild>
                <a href="/admin" aria-label={copy.openAdmin}>
                  <LayoutDashboard aria-hidden="true" />
                  <span className="hidden sm:inline">{copy.admin}</span>
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              aria-label={copy.switchLanguage}
            >
              <Languages className="hidden sm:block" aria-hidden="true" />
              <span className="sm:hidden">{locale === "zh-CN" ? "EN" : "中"}</span>
              <span className="hidden sm:inline">{copy.switchLanguageLabel}</span>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <section className="mb-8 max-w-3xl sm:mb-10" aria-labelledby="page-title">
          <p className="mb-3 text-sm font-medium text-primary">{copy.eyebrow}</p>
          <h1 id="page-title" className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            {copy.description}
          </p>
        </section>

        <UploadWorkspace locale={locale} copy={copy} />
      </main>

      <Toaster position="bottom-center" richColors closeButton />
    </div>
  )
}
