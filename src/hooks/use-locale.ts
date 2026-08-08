import { useEffect, useState } from "react"

import type { Locale } from "@/i18n"

const STORAGE_KEY = "telegraph-image-locale"

function getInitialLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === "zh-CN" || saved === "en") return saved
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en"
}

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  return {
    locale,
    setLocale,
    toggleLocale: () => setLocale((current) => (current === "zh-CN" ? "en" : "zh-CN")),
  }
}
