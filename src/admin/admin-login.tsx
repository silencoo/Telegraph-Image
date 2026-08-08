import { type FormEvent, useState } from "react"
import { ArrowLeft, Languages, LoaderCircle, LockKeyhole } from "lucide-react"

import type { AdminCopy } from "@/admin/copy"
import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AdminLoginProps = {
  copy: AdminCopy
  locale: "zh-CN" | "en"
  onLogin: (user: string, pass: string) => Promise<boolean>
  onToggleLocale: () => void
}

export function AdminLogin({ copy, locale, onLogin, onToggleLocale }: AdminLoginProps) {
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user.trim() || !pass) {
      setError(copy.loginRequired)
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const authenticated = await onLogin(user.trim(), pass)
      if (!authenticated) {
        setPass("")
        setError(copy.invalidCredentials)
      }
    } catch {
      setError(copy.loginFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-muted/30">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" aria-hidden="true" />
      <header className="relative z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark size="sm" />
            Telegraph-Image
          </a>
          <Button type="button" variant="outline" size="sm" onClick={onToggleLocale} aria-label={copy.language}>
            <Languages aria-hidden="true" />
            {locale === "zh-CN" ? "English" : "中文"}
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl place-items-center px-4 py-10 sm:px-6 lg:grid-cols-[1fr_28rem] lg:gap-16 lg:px-8">
        <section className="hidden max-w-xl lg:block" aria-labelledby="login-context-title">
          <span className="inline-flex size-12 items-center justify-center rounded-xl border bg-background shadow-sm">
            <LockKeyhole className="size-5 text-primary" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-medium text-primary">{copy.loginEyebrow}</p>
          <h2 id="login-context-title" className="mt-2 text-4xl font-semibold tracking-tight">{copy.loginTitle}</h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">{copy.loginDescription}</p>
        </section>

        <Card className="w-full max-w-md shadow-lg shadow-foreground/5">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-primary lg:hidden">{copy.loginEyebrow}</p>
            <CardTitle><h1 className="text-2xl tracking-tight">{copy.loginTitle}</h1></CardTitle>
            <CardDescription className="leading-6">{copy.loginDescription}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="admin-user" className="text-sm font-medium">{copy.username}</label>
                <Input
                  id="admin-user"
                  name="username"
                  value={user}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={256}
                  placeholder={copy.usernamePlaceholder}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                  disabled={submitting}
                  onChange={(event) => { setUser(event.target.value); setError("") }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="admin-password" className="text-sm font-medium">{copy.password}</label>
                <Input
                  id="admin-password"
                  name="password"
                  type="password"
                  value={pass}
                  autoComplete="current-password"
                  maxLength={1024}
                  placeholder={copy.passwordPlaceholder}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                  disabled={submitting}
                  onChange={(event) => { setPass(event.target.value); setError("") }}
                />
              </div>
              {error ? <p id="login-error" className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                {submitting ? copy.signingIn : copy.signIn}
              </Button>
            </CardContent>
          </form>
          <CardFooter className="flex-col items-start gap-4 border-t text-xs text-muted-foreground">
            <p>{copy.loginSessionNote}</p>
            <Button type="button" variant="link" size="sm" className="h-auto px-0 text-muted-foreground" asChild>
              <a href="/"><ArrowLeft aria-hidden="true" />{copy.home}</a>
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
