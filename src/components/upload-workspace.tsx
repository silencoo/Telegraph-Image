import {
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Inbox,
  RotateCcw,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Copy as LocalizedCopy, Locale } from "@/i18n"
import { formatLink, type LinkFormat } from "@/lib/file-links"
import { cn } from "@/lib/utils"

const MAX_CONCURRENT = 3
const FORMATS: LinkFormat[] = ["url", "markdown", "bbcode", "html"]
const PHOTO_LIMIT = 10 * 1024 * 1024
const TELEGRAM_FILE_LIMIT = 20 * 1024 * 1024
const PASTE_DRAFT_KEY = "telegraph-image:paste-draft"

type UploadStatus = "queued" | "uploading" | "success" | "error" | "cancelled"
type ImageUploadMode = "document" | "photo"
type WorkspaceMode = "files" | "pastebin"

interface UploadItem {
  error?: string
  file: globalThis.File
  id: string
  imageUploadMode: ImageUploadMode
  previewUrl?: string
  progress: number
  resultUrl?: string
  status: UploadStatus
}

interface PendingUpload {
  file: globalThis.File
  id: string
  imageUploadMode: ImageUploadMode
}

interface UploadWorkspaceProps {
  copy: LocalizedCopy
  imageUploadModeAvailable: boolean
  locale: Locale
}

export function UploadWorkspace({ copy, imageUploadModeAvailable, locale }: UploadWorkspaceProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [format, setFormat] = useState<LinkFormat>("url")
  const [dragActive, setDragActive] = useState(false)
  const [imageUploadMode, setImageUploadMode] = useState<ImageUploadMode>("document")
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("files")
  const [pasteFileName, setPasteFileName] = useState("paste.txt")
  const [pasteContent, setPasteContent] = useState("")
  const draftLoaded = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeUploads = useRef(0)
  const pendingUploads = useRef<PendingUpload[]>([])
  const requests = useRef(new Map<string, XMLHttpRequest>())
  const previewUrls = useRef(new Set<string>())

  const completed = useMemo(
    () => items.filter((item) => item.status === "success" && item.resultUrl),
    [items],
  )

  const output = useMemo(
    () =>
      completed
        .map((item) =>
          formatLink(
            { fileName: item.file.name, url: item.resultUrl! },
            format,
          ),
        )
        .join("\n"),
    [completed, format],
  )

  const pasteByteSize = useMemo(() => new TextEncoder().encode(pasteContent).byteLength, [pasteContent])
  const normalizedPasteName = useMemo(
    () => (pasteFileName.trim() || "paste.txt").replace(/[\\/]/g, "-"),
    [pasteFileName],
  )
  const pasteUploadName = useMemo(
    () => /\.[a-z0-9]+$/i.test(normalizedPasteName) ? normalizedPasteName : `${normalizedPasteName}.txt`,
    [normalizedPasteName],
  )

  useEffect(() => {
    const urls = previewUrls.current
    const currentRequests = requests.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      currentRequests.forEach((request) => request.abort())
    }
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PASTE_DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved) as { content?: string; fileName?: string }
        if (typeof draft.fileName === "string") setPasteFileName(draft.fileName)
        if (typeof draft.content === "string") setPasteContent(draft.content)
      }
    } catch {
      // Ignore unavailable storage and malformed drafts.
    } finally {
      draftLoaded.current = true
    }
  }, [])

  useEffect(() => {
    if (!draftLoaded.current) return
    const timeout = window.setTimeout(() => {
      try {
        if (!pasteContent && pasteFileName === "paste.txt") localStorage.removeItem(PASTE_DRAFT_KEY)
        else localStorage.setItem(PASTE_DRAFT_KEY, JSON.stringify({ content: pasteContent, fileName: pasteFileName }))
      } catch {
        // Draft persistence is an enhancement; uploads still work without it.
      }
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [pasteContent, pasteFileName])

  useEffect(() => {
    const handlePaste = (event: globalThis.ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is globalThis.File => Boolean(file))

      if (files.length) enqueueFiles(files)
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [imageUploadMode])

  function enqueueFiles(files: globalThis.File[]) {
    if (!files.length) return

    let invalidCount = 0
    const additions = files.map<UploadItem>((file) => {
      const id = crypto.randomUUID()
      const previewUrl = isPreviewableImage(file)
        ? URL.createObjectURL(file)
        : undefined
      if (previewUrl) previewUrls.current.add(previewUrl)
      const error = getSizeError(file, imageUploadMode)
      if (error) invalidCount += 1
      else pendingUploads.current.push({ file, id, imageUploadMode })
      return {
        error,
        file,
        id,
        imageUploadMode,
        previewUrl,
        progress: 0,
        status: error ? "error" : "queued",
      }
    })

    setItems((current) => [...current, ...additions])
    if (invalidCount) toast.error(copy.filesTooLarge(invalidCount))
    queueMicrotask(pumpQueue)
  }

  function getSizeError(file: globalThis.File, mode: ImageUploadMode) {
    if (!imageUploadModeAvailable) return undefined
    const limit = file.type.startsWith("image/") && mode === "photo" ? PHOTO_LIMIT : TELEGRAM_FILE_LIMIT
    return file.size > limit ? copy.fileTooLarge(formatSize(limit, locale)) : undefined
  }

  function pumpQueue() {
    while (activeUploads.current < MAX_CONCURRENT && pendingUploads.current.length) {
      const next = pendingUploads.current.shift()
      if (!next) return
      activeUploads.current += 1
      uploadFile(next)
    }
  }

  function updateItem(id: string, updates: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    )
  }

  function uploadFile({ file, id, imageUploadMode: queuedImageUploadMode }: PendingUpload) {
    const body = new FormData()
    body.append("file", file)
    body.append("imageUploadMode", queuedImageUploadMode)

    const request = new XMLHttpRequest()
    requests.current.set(id, request)
    updateItem(id, { progress: 0, status: "uploading" })
    request.open("POST", "/upload")

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      updateItem(id, { progress: Math.round((event.loaded / event.total) * 100) })
    }

    request.onload = () => {
      let resultUrl: string | undefined
      let error: string = copy.unknownError

      try {
        const data = JSON.parse(request.responseText) as
          | Array<{ src?: string }>
          | { error?: string }
        if (request.status === 200 && Array.isArray(data) && data[0]?.src) {
          resultUrl = `${window.location.origin}${data[0].src}`
        } else if (!Array.isArray(data) && data.error) {
          error = data.error
        } else {
          error = `HTTP ${request.status}`
        }
      } catch {
        error = `HTTP ${request.status}`
      }

      if (resultUrl) {
        updateItem(id, { progress: 100, resultUrl, status: "success" })
      } else {
        updateItem(id, { error, progress: 100, status: "error" })
      }
      finishRequest(id)
    }

    request.onerror = () => {
      updateItem(id, { error: copy.networkError, progress: 100, status: "error" })
      finishRequest(id)
    }

    request.onabort = () => finishRequest(id)
    request.send(body)
  }

  function finishRequest(id: string) {
    if (!requests.current.has(id)) return
    requests.current.delete(id)
    activeUploads.current = Math.max(0, activeUploads.current - 1)
    pumpQueue()
  }

  function cancelItem(item: UploadItem) {
    pendingUploads.current = pendingUploads.current.filter((pending) => pending.id !== item.id)
    const request = requests.current.get(item.id)
    if (request) request.abort()
    updateItem(item.id, { error: undefined, progress: 0, status: "cancelled" })
  }

  function removeItem(item: UploadItem) {
    pendingUploads.current = pendingUploads.current.filter((pending) => pending.id !== item.id)
    requests.current.get(item.id)?.abort()
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
      previewUrls.current.delete(item.previewUrl)
    }
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
  }

  function retryItem(item: UploadItem) {
    const error = getSizeError(item.file, imageUploadMode)
    if (error) {
      updateItem(item.id, { error, imageUploadMode, progress: 0, status: "error" })
      toast.error(error)
      return
    }
    pendingUploads.current = pendingUploads.current.filter((pending) => pending.id !== item.id)
    pendingUploads.current.push({ file: item.file, id: item.id, imageUploadMode })
    updateItem(item.id, {
      error: undefined,
      imageUploadMode,
      progress: 0,
      resultUrl: undefined,
      status: "queued",
    })
    queueMicrotask(pumpQueue)
  }

  function clearAll() {
    pendingUploads.current = []
    const activeRequests = Array.from(requests.current.values())
    requests.current.clear()
    activeUploads.current = 0
    activeRequests.forEach((request) => request.abort())
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
    setItems([])
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

  function openPicker() {
    inputRef.current?.click()
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    enqueueFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    enqueueFiles(Array.from(event.dataTransfer.files))
  }

  function handleDropKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    openPicker()
  }

  function handleLocalPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    if (event.clipboardData.files.length) {
      event.stopPropagation()
      enqueueFiles(Array.from(event.clipboardData.files))
    }
  }

  function uploadPaste() {
    if (!pasteContent.trim()) return

    enqueueFiles([
      new globalThis.File([pasteContent], pasteUploadName, {
        type: "text/plain;charset=utf-8",
      }),
    ])
  }

  function clearPasteDraft() {
    setPasteFileName("paste.txt")
    setPasteContent("")
    try {
      localStorage.removeItem(PASTE_DRAFT_KEY)
    } catch {
      // Ignore unavailable storage.
    }
  }

  return (
    <Tabs
      value={workspaceMode}
      onValueChange={(value) => setWorkspaceMode(value as WorkspaceMode)}
      className="gap-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="grid w-full grid-cols-2 sm:w-72" aria-label={copy.workspaceModeLabel}>
          <TabsTrigger value="files">
            <Upload aria-hidden="true" />
            {copy.filesTab}
          </TabsTrigger>
          <TabsTrigger value="pastebin">
            <FileText aria-hidden="true" />
            {copy.pastebinTab}
          </TabsTrigger>
        </TabsList>
        {imageUploadModeAvailable ? <TelegramUploadLimits copy={copy} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="min-h-[31rem] lg:min-h-[37rem]">
          <TabsContent value="files" className="mt-0 h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{copy.uploadTitle}</CardTitle>
                <CardDescription>{copy.uploadDescription}</CardDescription>
                {imageUploadModeAvailable ? (
                  <CardAction>
                    <div
                      className="flex items-center gap-2"
                      title={imageUploadMode === "document"
                        ? copy.imageUploadModeOriginalDescription
                        : copy.imageUploadModeOptimizedDescription}
                    >
                      <label htmlFor="image-upload-mode" className="text-xs font-medium text-muted-foreground">
                        {copy.imageUploadModeOriginal}
                      </label>
                      <Switch
                        id="image-upload-mode"
                        checked={imageUploadMode === "document"}
                        onCheckedChange={(checked) => setImageUploadMode(checked ? "document" : "photo")}
                        aria-describedby="image-upload-mode-description"
                      />
                      <span id="image-upload-mode-description" className="sr-only">
                        {imageUploadMode === "document"
                          ? copy.imageUploadModeOriginalDescription
                          : copy.imageUploadModeOptimizedDescription}
                      </span>
                    </div>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent>
                <div
                  id="dropzone"
                  role="button"
                  tabIndex={0}
                  aria-label={copy.chooseFiles}
                  onClick={openPicker}
                  onKeyDown={handleDropKeyboard}
                  onPaste={handleLocalPaste}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDragActive(false)
                    }
                  }}
                  onDrop={handleDrop}
                  className={cn(
                    "group flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    dragActive
                      ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]"
                      : "border-border bg-muted/25 hover:border-primary/50 hover:bg-muted/45",
                  )}
                >
                  <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
                    <Upload className="size-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">
                    {dragActive ? copy.dropActive : copy.dropTitle}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    {copy.dropHint}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="mt-6"
                    onClick={(event) => {
                      event.stopPropagation()
                      openPicker()
                    }}
                  >
                    <Upload aria-hidden="true" />
                    {copy.chooseFiles}
                  </Button>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">{copy.multipleFiles}</Badge>
                    <Badge variant="secondary">
                      <Clipboard aria-hidden="true" />
                      {copy.pasteSupported}
                    </Badge>
                  </div>
                </div>
                <input
                  ref={inputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  aria-label={copy.chooseFiles}
                  onChange={handleInput}
                  tabIndex={-1}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pastebin" className="mt-0 h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{copy.pastebinTitle}</CardTitle>
                <CardDescription>{copy.pastebinDescription}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-5">
                <div className="space-y-2">
                  <label htmlFor="paste-file-name" className="text-sm font-medium">
                    {copy.pasteFileNameLabel}
                  </label>
                  <Input
                    id="paste-file-name"
                    value={pasteFileName}
                    onChange={(event) => setPasteFileName(event.target.value)}
                    placeholder={copy.pasteFileNamePlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {pasteUploadName !== (pasteFileName.trim() || "paste.txt") ? (
                    <p className="text-xs text-muted-foreground">{copy.pasteFileNameAdjusted(pasteUploadName)}</p>
                  ) : null}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <label htmlFor="paste-content" className="text-sm font-medium">
                      {copy.pasteContentLabel}
                    </label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {copy.characterCount(pasteContent.length)} · {formatSize(pasteByteSize, locale)}
                    </span>
                  </div>
                  <Textarea
                    id="paste-content"
                    value={pasteContent}
                    onChange={(event) => setPasteContent(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && pasteContent.trim()) {
                        event.preventDefault()
                        uploadPaste()
                      }
                    }}
                    placeholder={copy.pasteContentPlaceholder}
                    className="min-h-64 flex-1 resize-none leading-6"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Button type="button" variant="ghost" onClick={clearPasteDraft} disabled={!pasteContent && pasteFileName === "paste.txt"}>
                    <Trash2 aria-hidden="true" />
                    {copy.clearPaste}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    disabled={!pasteContent.trim()}
                    onClick={uploadPaste}
                  >
                    <Upload aria-hidden="true" />
                    {copy.uploadPaste}
                    <span className="hidden text-xs opacity-70 sm:inline">⌘/Ctrl ↵</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>

        <Card className="min-h-[31rem] lg:min-h-[37rem]">
          <CardHeader className="border-b">
            <CardTitle>{copy.uploadQueue}</CardTitle>
            <CardDescription>{copy.uploadQueueDescription}</CardDescription>
            {items.length ? (
              <CardAction>
                <Badge variant="outline">{copy.fileCount(items.length)}</Badge>
              </CardAction>
            ) : null}
          </CardHeader>

          <CardContent className="flex min-h-64 flex-1 flex-col px-0">
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium">{copy.emptyTitle}</p>
                <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                  {copy.emptyDescription}
                </p>
              </div>
            ) : (
              <div className="max-h-80 divide-y overflow-y-auto" aria-live="polite">
                {items.map((item) => (
                  <UploadRow
                    key={item.id}
                    item={item}
                    copy={copy}
                    locale={locale}
                    currentFormat={format}
                    onCopy={copyText}
                    onCancel={cancelItem}
                    onRemove={removeItem}
                    onRetry={retryItem}
                  />
                ))}
              </div>
            )}
          </CardContent>

          {completed.length ? (
            <>
              <Separator />
              <div className="space-y-4 px-6 pb-6">
                <div className="flex items-start justify-between gap-4 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold">{copy.outputTitle}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {copy.outputDescription}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                    <Trash2 aria-hidden="true" />
                    {copy.clear}
                  </Button>
                </div>

                <Tabs value={format} onValueChange={(value) => setFormat(value as LinkFormat)}>
                  <div className="sm:hidden">
                    <Select value={format} onValueChange={(value) => setFormat(value as LinkFormat)}>
                      <SelectTrigger className="w-full" aria-label={copy.outputFormat}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((item) => (
                          <SelectItem key={item} value={item}>{getFormatLabel(item)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <TabsList className="hidden w-full grid-cols-4 sm:grid">
                    {FORMATS.map((item) => (
                      <TabsTrigger key={item} value={item} className="text-xs sm:text-sm">
                        {getFormatLabel(item)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {FORMATS.map((item) => (
                    <TabsContent key={item} value={item}>
                      <Textarea
                        readOnly
                        spellCheck={false}
                        value={
                          item === format
                            ? output
                            : completed
                                .map((file) =>
                                  formatLink(
                                    { fileName: file.file.name, url: file.resultUrl! },
                                    item,
                                  ),
                                )
                                .join("\n")
                        }
                        aria-label={`${copy.outputTitle} — ${item}`}
                        className="min-h-24 resize-y font-mono text-xs leading-5"
                      />
                    </TabsContent>
                  ))}
                </Tabs>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => copyText(output)}>
                    <Copy aria-hidden="true" />
                    {copy.copyAll}
                  </Button>
                </div>
              </div>
            </>
          ) : items.length ? (
            <div className="flex justify-end border-t px-6 py-4">
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} aria-label={copy.clearQueue}>
                <Trash2 aria-hidden="true" />
                {copy.clear}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </Tabs>
  )
}

function TelegramUploadLimits({ copy }: { copy: LocalizedCopy }) {
  const limits = [
    [copy.botLimitImageOriginal, "20 MB"],
    [copy.botLimitImageOptimized, "10 MB"],
    [copy.botLimitVideo, "20 MB"],
    [copy.botLimitAudio, "20 MB"],
    [copy.botLimitDocument, "20 MB"],
  ]

  return (
    <ul
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] leading-4 text-muted-foreground sm:justify-end"
    >
      {limits.map(([label, size]) => (
        <li key={label} className="whitespace-nowrap">
          {label} <span className="font-medium tabular-nums text-foreground/75">{size}</span>
        </li>
      ))}
    </ul>
  )
}

interface UploadRowProps {
  copy: LocalizedCopy
  currentFormat: LinkFormat
  item: UploadItem
  locale: Locale
  onCancel: (item: UploadItem) => void
  onCopy: (text: string) => Promise<void>
  onRemove: (item: UploadItem) => void
  onRetry: (item: UploadItem) => void
}

function UploadRow({ copy, currentFormat, item, locale, onCancel, onCopy, onRemove, onRetry }: UploadRowProps) {
  const Icon = getFileIcon(item.file.type)
  const statusText =
    item.status === "queued"
      ? copy.queued
      : item.status === "uploading"
        ? copy.uploading(item.progress)
        : item.status === "success"
          ? copy.uploaded
          : item.status === "cancelled"
            ? copy.cancelled
          : `${copy.failed}: ${item.error ?? copy.unknownError}`

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <Icon className="size-5" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </p>
          {item.status === "success" ? (
            <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : item.status === "error" ? (
            <XCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">{formatSize(item.file.size, locale)}</span>
          <span aria-hidden="true">·</span>
          <span className={cn("truncate", item.status === "error" && "text-destructive")}>
            {statusText}
          </span>
        </div>
        {item.status === "uploading" || item.status === "queued" ? (
          <Progress value={item.progress} className="mt-2 h-1" aria-label={statusText} />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {item.resultUrl ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copy.copyLink(item.file.name)}
              title={copy.copyLink(item.file.name)}
              onClick={() =>
                onCopy(
                  formatLink(
                    { fileName: item.file.name, url: item.resultUrl! },
                    currentFormat,
                  ),
                )
              }
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" asChild>
              <a href={item.resultUrl} target="_blank" rel="noopener noreferrer" aria-label={copy.openFile(item.file.name)} title={copy.openFile(item.file.name)}>
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </>
        ) : null}
        {item.status === "error" || item.status === "cancelled" ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRetry(item)} aria-label={copy.retryFile(item.file.name)} title={copy.retryFile(item.file.name)}>
            <RotateCcw aria-hidden="true" />
          </Button>
        ) : null}
        {item.status === "queued" || item.status === "uploading" ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onCancel(item)} aria-label={copy.cancelFile(item.file.name)} title={copy.cancelFile(item.file.name)}>
            <X aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(item)} aria-label={copy.removeFile(item.file.name)} title={copy.removeFile(item.file.name)}>
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

function isPreviewableImage(file: globalThis.File) {
  return file.type.startsWith("image/") || /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(file.name)
}

function getFormatLabel(format: LinkFormat) {
  if (format === "url") return "URL"
  if (format === "html") return "HTML"
  if (format === "bbcode") return "BBCode"
  return "Markdown"
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage
  if (type.startsWith("video/")) return FileVideo
  if (type.startsWith("audio/")) return FileAudio
  return File
}

function formatSize(bytes: number, locale: Locale) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bytes / 1024 / 1024)} MB`
}
