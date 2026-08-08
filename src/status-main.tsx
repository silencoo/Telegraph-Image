import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Clock3, Home, Languages, ShieldAlert } from "lucide-react"
import { ThemeProvider } from "next-themes"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useLocale } from "@/hooks/use-locale"
import "@/index.css"

const statusMessages = {
  "zh-CN": {
    blocked: {
      eyebrow: "访问受限",
      title: "此文件已被屏蔽",
      description: "该文件未通过内容审查或已由管理员加入黑名单，因此当前无法访问。",
    },
    pending: {
      eyebrow: "等待审核",
      title: "此文件尚未开放访问",
      description: "当前站点已启用白名单模式。文件经管理员审核并加入白名单后即可访问。",
    },
    home: "返回上传页",
    language: "Switch to English",
    languageLabel: "English",
  },
  en: {
    blocked: {
      eyebrow: "Access restricted",
      title: "This file has been blocked",
      description: "The file did not pass content review or was added to the blocklist by an administrator, so it cannot be accessed.",
    },
    pending: {
      eyebrow: "Review pending",
      title: "This file is not available yet",
      description: "Whitelist mode is enabled. The file will become available after an administrator reviews and approves it.",
    },
    home: "Back to uploader",
    language: "切换到中文",
    languageLabel: "中文",
  },
} as const

function FileStatusPage() {
  const { locale, toggleLocale } = useLocale()
  const copy = statusMessages[locale]
  const status = document.body.dataset.fileStatus === "pending" ? "pending" : "blocked"
  const message = copy[status]
  const Icon = status === "blocked" ? ShieldAlert : Clock3

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/25 px-4 py-10">
      <Card className="w-full max-w-xl shadow-sm">
        <CardContent className="flex flex-col items-center px-6 py-8 text-center sm:px-10 sm:py-12">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Icon className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-medium text-primary">{message.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{message.title}</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{message.description}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <a href="/"><Home aria-hidden="true" />{copy.home}</a>
            </Button>
            <Button type="button" variant="outline" onClick={toggleLocale} aria-label={copy.language}>
              <Languages aria-hidden="true" />{copy.languageLabel}
            </Button>
          </div>
          <a
            className="mt-8 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="https://github.com/cf-pages/Telegraph-Image"
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegraph-Image
          </a>
        </CardContent>
      </Card>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <FileStatusPage />
    </ThemeProvider>
  </StrictMode>,
)
