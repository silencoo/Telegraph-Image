import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  Ban,
  CheckCircle2,
  Copy,
  FileAudio,
  FileText,
  FileVideo,
  Grid2X2,
  Home,
  ImageIcon,
  Languages,
  List,
  LogOut,
  Maximize2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { AdminLogin } from "@/admin/admin-login"
import { adminMessages } from "@/admin/copy"
import { FileGrid } from "@/admin/file-grid"
import { FilePreview } from "@/admin/file-preview"
import { FileTable } from "@/admin/file-table"
import { formatFileSize, getFileHref, getFileKind, getPublicUrl, normalizeFile } from "@/admin/file-utils"
import type {
  ConfirmOperation,
  FileFilter,
  FileKind,
  FileSort,
  FileView,
  ManagedFile,
} from "@/admin/types"
import { useManagedFiles } from "@/admin/use-managed-files"
import { BrandMark } from "@/components/brand-mark"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { useLocale } from "@/hooks/use-locale"

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024
const MAX_UPLOAD_CONCURRENT = 3

function readAdminParam<T extends string>(name: string, allowed: readonly T[], fallback: T) {
  if (typeof window === "undefined") return fallback
  const value = new URLSearchParams(window.location.search).get(name)
  return allowed.includes(value as T) ? value as T : fallback
}

function readAdminSearch() {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("q") ?? ""
}

export function AdminApp() {
  const { locale, toggleLocale } = useLocale()
  const copy = adminMessages[locale]
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    authRequired,
    deleteFiles,
    error,
    files,
    hasMore,
    loadMore,
    login,
    loading,
    loadingMore,
    logout,
    refresh,
    renameFile,
    setFiles,
    toggleFavorite,
    updateListType,
    usesBasicAuth,
  } = useManagedFiles()

  const [search, setSearch] = useState(readAdminSearch)
  const [kindFilter, setKindFilter] = useState<FileKind | "all">(() => readAdminParam("type", ["all", "image", "video", "audio", "document"] as const, "all"))
  const [statusFilter, setStatusFilter] = useState<FileFilter>(() => readAdminParam("status", ["all", "favorites", "white", "block", "adult"] as const, "all"))
  const [sort, setSort] = useState<FileSort>(() => readAdminParam("sort", ["newest", "name", "size"] as const, "newest"))
  const [view, setView] = useState<FileView>(() => readAdminParam("view", ["table", "grid"] as const, "table"))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOperation, setConfirmOperation] = useState<ConfirmOperation | null>(null)
  const [processing, setProcessing] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ManagedFile | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [previewFile, setPreviewFile] = useState<ManagedFile | null>(null)

  useEffect(() => {
    document.title = `${authRequired ? copy.loginTitle : copy.metaTitle} | Telegraph-Image`
  }, [authRequired, copy.loginTitle, copy.metaTitle])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (kindFilter !== "all") params.set("type", kindFilter)
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (sort !== "newest") params.set("sort", sort)
    if (view !== "table") params.set("view", view)
    const query = params.toString()
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
  }, [kindFilter, search, sort, statusFilter, view])

  const counts = useMemo(() => {
    const result: Record<FileKind, number> = { image: 0, video: 0, audio: 0, document: 0 }
    files.forEach((file) => { result[getFileKind(file.name)] += 1 })
    return result
  }, [files])

  const filteredFiles = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale)
    return files
      .filter((file) => {
        const matchesSearch = !needle || [file.name, file.metadata.fileName]
          .some((value) => value.toLocaleLowerCase(locale).includes(needle))
        const matchesKind = kindFilter === "all" || getFileKind(file.name) === kindFilter
        const matchesStatus = statusFilter === "all"
          || (statusFilter === "favorites" && file.metadata.liked)
          || (statusFilter === "white" && file.metadata.ListType === "White")
          || (statusFilter === "block" && file.metadata.ListType === "Block")
          || (statusFilter === "adult" && file.metadata.Label?.toLowerCase() === "adult")
        return matchesSearch && matchesKind && matchesStatus
      })
      .sort((a, b) => {
        if (sort === "name") return a.metadata.fileName.localeCompare(b.metadata.fileName, locale)
        if (sort === "size") return b.metadata.fileSize - a.metadata.fileSize
        return (b.metadata.TimeStamp ?? 0) - (a.metadata.TimeStamp ?? 0)
      })
  }, [files, kindFilter, locale, search, sort, statusFilter])

  const selectedFiles = useMemo(
    () => files.filter((file) => selected.has(file.name)),
    [files, selected],
  )

  if (authRequired === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-muted/30 px-4" aria-busy="true">
        <Card className="w-full max-w-md" role="status" aria-label={copy.loading}>
          <CardHeader>
            <Skeleton className="size-10 rounded-lg motion-reduce:animate-none" />
            <Skeleton className="h-6 w-52 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-full motion-reduce:animate-none" />
            <Skeleton className="h-9 w-full motion-reduce:animate-none" />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (authRequired) {
    return (
      <AdminLogin
        copy={copy}
        locale={locale}
        onLogin={login}
        onToggleLocale={toggleLocale}
      />
    )
  }

  function selectFile(file: ManagedFile, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      checked ? next.add(file.name) : next.delete(file.name)
      return next
    })
  }

  function toggleAllVisible() {
    const allSelected = filteredFiles.length > 0 && filteredFiles.every((file) => selected.has(file.name))
    setSelected((current) => {
      const next = new Set(current)
      filteredFiles.forEach((file) => allSelected ? next.delete(file.name) : next.add(file.name))
      return next
    })
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(copy.copied)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand("copy")
      textarea.remove()
      copied ? toast.success(copy.copied) : toast.error(copy.copyFailed)
    }
  }

  function requestConfirmation(operation: ConfirmOperation) {
    setConfirmOperation(operation)
  }

  async function runConfirmedOperation() {
    if (!confirmOperation) return
    setProcessing(true)
    try {
      if (confirmOperation.type === "delete") {
        await deleteFiles(confirmOperation.files)
        toast.success(copy.deleted)
      } else {
        await updateListType(
          confirmOperation.files,
          confirmOperation.type === "block" ? "Block" : "White",
        )
        toast.success(copy.updated)
      }
      const names = new Set(confirmOperation.files.map((file) => file.name))
      setSelected((current) => new Set(Array.from(current).filter((name) => !names.has(name))))
      setConfirmOperation(null)
    } catch {
      toast.error(copy.operationFailed)
    } finally {
      setProcessing(false)
    }
  }

  function openRename(file: ManagedFile) {
    setRenameTarget(file)
    setRenameValue(file.metadata.fileName)
    setRenameError("")
  }

  async function saveRename() {
    if (!renameTarget) return
    const value = renameValue.trim()
    if (!value) {
      setRenameError(copy.renameEmpty)
      return
    }
    setProcessing(true)
    try {
      await renameFile(renameTarget, value)
      setRenameTarget(null)
      toast.success(copy.renamed)
    } catch {
      toast.error(copy.operationFailed)
    } finally {
      setProcessing(false)
    }
  }

  async function handleFavorite(file: ManagedFile) {
    try {
      await toggleFavorite(file)
      toast.success(copy.favoriteUpdated)
    } catch {
      toast.error(copy.operationFailed)
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!chosen.length) return

    const valid = chosen.filter((file) => file.size <= MAX_UPLOAD_SIZE)
    const invalidCount = chosen.length - valid.length
    if (invalidCount) toast.error(`${copy.uploadTooLarge} (${invalidCount})`)
    if (!valid.length) return

    setUploading(true)
    toast.loading(copy.uploading(valid.length), { id: "admin-upload" })
    let successCount = 0
    let failureCount = 0
    const uploaded: ManagedFile[] = []

    async function uploadFile(file: File) {
      const body = new FormData()
      body.append("file", file)
      try {
        const response = await fetch("/upload", { method: "POST", body, credentials: "include" })
        const result = await response.json() as Array<{ src?: string }> | { error?: string }
        if (!response.ok || !Array.isArray(result) || !result[0]?.src) throw new Error("Upload failed")
        const name = result[0].src.replace(/^\/file\//, "")
        uploaded.push(normalizeFile({
          name,
          metadata: { fileName: file.name, fileSize: file.size, TimeStamp: Date.now() },
        }))
        successCount += 1
      } catch {
        failureCount += 1
      }
    }

    for (let index = 0; index < valid.length; index += MAX_UPLOAD_CONCURRENT) {
      await Promise.all(valid.slice(index, index + MAX_UPLOAD_CONCURRENT).map(uploadFile))
    }

    setFiles((current) => [...uploaded, ...current])
    toast.dismiss("admin-upload")
    if (successCount) toast.success(copy.uploadSuccess(successCount))
    if (failureCount) toast.error(copy.uploadFailure(failureCount))
    setUploading(false)
  }

  const confirmDescription = confirmOperation?.type === "delete"
    ? copy.confirmDelete(confirmOperation.files.length)
    : confirmOperation?.type === "block"
      ? copy.confirmBlock(confirmOperation.files.length)
      : confirmOperation
        ? copy.confirmWhite(confirmOperation.files.length)
        : ""

  const actionProps = {
    copy,
    onConfirm: requestConfirmation,
    onCopy: (file: ManagedFile) => void copyText(getPublicUrl(file)),
    onRename: openRename,
    onToggleFavorite: (file: ManagedFile) => void handleFavorite(file),
  }

  const statCards: Array<{ filter: FileKind | "all"; icon: typeof List; label: string; value: number }> = [
    { filter: "all", label: copy.loaded, value: files.length, icon: List },
    { filter: "image", label: copy.image, value: counts.image, icon: ImageIcon },
    { filter: "video", label: copy.video, value: counts.video, icon: FileVideo },
    { filter: "audio", label: copy.audio, value: counts.audio, icon: FileAudio },
    { filter: "document", label: copy.document, value: counts.document, icon: FileText },
  ]

  return (
    <div className="min-h-dvh bg-muted/20">
      <a
        href="#admin-content"
        className="fixed left-4 top-4 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        {copy.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark />
            <span className="truncate text-sm font-semibold sm:text-base">Telegraph-Image</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">{copy.dashboard}</Badge>
          </a>
          <nav className="flex shrink-0 items-center gap-1" aria-label={copy.dashboard}>
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href="/"><Home aria-hidden="true" /><span className="hidden sm:inline">{copy.home}</span></a>
            </Button>
            {usesBasicAuth ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void logout().catch(() => toast.error(copy.operationFailed))}
              >
                <LogOut aria-hidden="true" /><span className="hidden sm:inline">{copy.logout}</span>
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={toggleLocale} aria-label={copy.language}>
              <Languages className="hidden sm:block" aria-hidden="true" />
              <span className="sm:hidden">{copy.languageShort}</span>
              <span className="hidden sm:inline">{locale === "zh-CN" ? "English" : "中文"}</span>
            </Button>
          </nav>
        </div>
      </header>

      <main id="admin-content" className={`mx-auto w-full max-w-[1440px] space-y-6 px-4 pt-6 sm:px-6 sm:py-8 lg:px-8 ${selectedFiles.length ? "pb-24" : "pb-6"}`}>
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" aria-labelledby="admin-title">
          <div>
            <p className="text-sm font-medium text-primary">Telegraph-Image</p>
            <h1 id="admin-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.dashboard}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
          </div>
          <div className="flex gap-2">
            <input ref={inputRef} type="file" multiple className="sr-only" aria-label={copy.upload} onChange={handleUpload} />
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{copy.retry}</span>
            </Button>
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload aria-hidden="true" />
              {uploading ? copy.processing : copy.upload}
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={copy.loaded}>
          {statCards.map(({ filter, label, value, icon: Icon }) => (
            <button
              key={filter}
              type="button"
              aria-pressed={kindFilter === filter}
              onClick={() => setKindFilter(filter)}
              className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className={kindFilter === filter ? "gap-3 border-primary py-4 shadow-none ring-2 ring-primary/10" : "gap-3 py-4 shadow-none transition-colors hover:border-primary/40"}>
                <CardContent className="flex items-center justify-between px-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                  </div>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            </button>
          ))}
        </section>

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <CardTitle>{copy.files}</CardTitle>
                <CardDescription>{loading ? copy.loading : `${filteredFiles.length} / ${files.length}`}</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <label className="relative min-w-56 flex-1 sm:flex-none">
                  <span className="sr-only">{copy.searchLabel}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} className="pl-9 sm:w-64" />
                </label>
                <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as FileKind | "all")}>
                  <SelectTrigger aria-label={copy.kind} className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{copy.allTypes}</SelectItem>
                    <SelectItem value="image">{copy.image}</SelectItem>
                    <SelectItem value="video">{copy.video}</SelectItem>
                    <SelectItem value="audio">{copy.audio}</SelectItem>
                    <SelectItem value="document">{copy.document}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FileFilter)}>
                  <SelectTrigger aria-label={copy.filterLabel} className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{copy.allStatuses}</SelectItem>
                    <SelectItem value="favorites">{copy.favorites}</SelectItem>
                    <SelectItem value="white">{copy.whitelist}</SelectItem>
                    <SelectItem value="block">{copy.blacklist}</SelectItem>
                    <SelectItem value="adult">{copy.adult}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => setSort(value as FileSort)}>
                  <SelectTrigger aria-label={copy.sortLabel} className={`w-full sm:w-36 ${view === "table" ? "md:hidden" : ""}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{copy.newest}</SelectItem>
                    <SelectItem value="name">{copy.nameAscending}</SelectItem>
                    <SelectItem value="size">{copy.sizeDescending}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="hidden items-center rounded-md border p-0.5 md:flex">
                  <Button type="button" variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setView("table")} aria-label={copy.tableView}><List aria-hidden="true" /></Button>
                  <Button type="button" variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setView("grid")} aria-label={copy.gridView}><Grid2X2 aria-hidden="true" /></Button>
                </div>
              </div>
            </div>
          </CardHeader>

          {!loading && !error && filteredFiles.length ? (
            <div className="flex flex-col gap-3 border-b bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filteredFiles.every((file) => selected.has(file.name)) ? true : selectedFiles.length ? "indeterminate" : false}
                  onCheckedChange={toggleAllVisible}
                  aria-label={copy.selectAll}
                />
                <span className="text-sm text-muted-foreground">{copy.selected(selectedFiles.length)}</span>
                {selectedFiles.length ? <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{copy.clearSelection}</Button> : null}
              </div>
              {selectedFiles.length ? (
                <div className="hidden flex-wrap gap-2 md:flex">
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText(selectedFiles.map(getPublicUrl).join("\n"))}><Copy aria-hidden="true" />{copy.batchCopy}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => requestConfirmation({ files: selectedFiles, type: "white" })}><ShieldCheck aria-hidden="true" />{copy.batchWhite}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => requestConfirmation({ files: selectedFiles, type: "block" })}><Ban aria-hidden="true" />{copy.batchBlock}</Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => requestConfirmation({ files: selectedFiles, type: "delete" })}><Trash2 aria-hidden="true" />{copy.batchDelete}</Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-5" role="status" aria-label={copy.loading}>
                {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 w-full motion-reduce:animate-none" />)}
              </div>
            ) : error ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <Ban className="size-9 text-destructive" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">{copy.errorTitle}</h2>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">{error}</p>
                <Button type="button" variant="outline" className="mt-5" onClick={() => void refresh()}>{copy.retry}</Button>
              </div>
            ) : !filteredFiles.length ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <CheckCircle2 className="size-9 text-muted-foreground" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">{copy.emptyTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{copy.emptyDescription}</p>
              </div>
            ) : (
              <div className={view === "grid" ? "p-4 sm:p-5" : ""}>
                {view === "table" ? (
                  <FileTable
                    files={filteredFiles}
                    locale={locale}
                    selected={selected}
                    sort={sort}
                    onPreview={setPreviewFile}
                    onSelect={selectFile}
                    onSort={setSort}
                    {...actionProps}
                  />
                ) : null}
                <FileGrid files={filteredFiles} forceVisible={view === "grid"} locale={locale} selected={selected} onPreview={setPreviewFile} onSelect={selectFile} {...actionProps} />
              </div>
            )}
          </CardContent>

          {!loading && !error && files.length ? (
            <div className="flex justify-center border-t px-4 py-4">
              {hasMore ? (
                <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore && <RefreshCw className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {loadingMore ? copy.loading : copy.loadMore}
                </Button>
              ) : <p className="text-xs text-muted-foreground">{copy.noMore}</p>}
            </div>
          ) : null}
        </Card>
      </main>

      {selectedFiles.length ? (
        <div className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur-sm md:hidden">
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {copy.selected(selectedFiles.length)}
          </Button>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" title={copy.batchCopy} aria-label={copy.batchCopy} onClick={() => void copyText(selectedFiles.map(getPublicUrl).join("\n"))}><Copy aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon-sm" title={copy.batchWhite} aria-label={copy.batchWhite} onClick={() => requestConfirmation({ files: selectedFiles, type: "white" })}><ShieldCheck aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon-sm" title={copy.batchBlock} aria-label={copy.batchBlock} onClick={() => requestConfirmation({ files: selectedFiles, type: "block" })}><Ban aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" title={copy.batchDelete} aria-label={copy.batchDelete} onClick={() => requestConfirmation({ files: selectedFiles, type: "delete" })}><Trash2 aria-hidden="true" /></Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl" closeLabel={copy.cancel}>
          {previewFile ? (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="truncate" title={previewFile.metadata.fileName}>{previewFile.metadata.fileName}</DialogTitle>
                <DialogDescription>
                  {copy[getFileKind(previewFile.name)]} · {formatFileSize(previewFile.metadata.fileSize, locale)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-64 max-h-[65dvh] items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                <FilePreview file={previewFile} detailed className="max-h-[65dvh] object-contain" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => void copyText(getPublicUrl(previewFile))}>
                  <Copy aria-hidden="true" />{copy.copyLink}
                </Button>
                <Button type="button" asChild>
                  <a href={getFileHref(previewFile)} target="_blank" rel="noopener noreferrer">
                    <Maximize2 aria-hidden="true" />{copy.open}
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmOperation)} onOpenChange={(open) => !open && !processing && setConfirmOperation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmOperation?.type === "delete" ? "destructive" : "default"}
              disabled={processing}
              onClick={(event) => { event.preventDefault(); void runConfirmedOperation() }}
            >
              {processing ? copy.processing : copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && !processing && setRenameTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.renameTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.renameDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="rename-file" className="text-sm font-medium">{copy.renameLabel}</label>
            <Input
              id="rename-file"
              value={renameValue}
              maxLength={64}
              aria-invalid={Boolean(renameError)}
              aria-describedby={renameError ? "rename-error" : undefined}
              onChange={(event) => { setRenameValue(event.target.value); setRenameError("") }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveRename() } }}
            />
            {renameError ? <p id="rename-error" className="text-sm text-destructive">{renameError}</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={processing} onClick={(event) => { event.preventDefault(); void saveRename() }}>
              {processing ? copy.processing : copy.save}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="bottom-center" richColors closeButton />
    </div>
  )
}
