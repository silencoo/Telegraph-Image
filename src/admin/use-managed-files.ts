import { useCallback, useEffect, useState } from "react"

import { normalizeFile } from "@/admin/file-utils"
import type { ListResponse, ListType, ManagedFile } from "@/admin/types"

class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required")
    this.name = "UnauthorizedError"
  }
}

async function managementFetch(path: string, signal?: AbortSignal, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    signal,
  })

  if (response.status === 401) {
    throw new UnauthorizedError()
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }

  return response
}

function mergeFiles(current: ManagedFile[], additions: ManagedFile[]) {
  const files = new Map(current.map((file) => [file.name, file]))
  additions.forEach((file) => files.set(file.name, file))
  return Array.from(files.values())
}

export function useManagedFiles() {
  const [files, setFiles] = useState<ManagedFile[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [usesBasicAuth, setUsesBasicAuth] = useState(false)
  const [authRequired, setAuthRequired] = useState<boolean | null>(null)

  const authorizedFetch = useCallback(async (
    path: string,
    signal?: AbortSignal,
    init?: RequestInit,
  ) => {
    try {
      return await managementFetch(path, signal, init)
    } catch (requestError) {
      if (requestError instanceof UnauthorizedError) {
        setUsesBasicAuth(true)
        setAuthRequired(true)
      }
      throw requestError
    }
  }, [])

  const fetchPage = useCallback(async (
    pageCursor?: string,
    replace = false,
    signal?: AbortSignal,
  ) => {
    replace ? setLoading(true) : setLoadingMore(true)
    setError("")

    try {
      const query = new URLSearchParams({ limit: "100" })
      if (pageCursor) query.set("cursor", pageCursor)
      const response = await authorizedFetch(`/api/manage/list?${query}`, signal)
      const result = await response.json() as ListResponse
      const incoming = (result.keys ?? []).map(normalizeFile)
      setFiles((current) => replace ? incoming : mergeFiles(current, incoming))
      setCursor(result.list_complete ? null : result.cursor ?? null)
      setHasMore(!result.list_complete && Boolean(result.cursor))
      setAuthRequired(false)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return
      if (requestError instanceof UnauthorizedError) return
      setAuthRequired(false)
      setError(requestError instanceof Error ? requestError.message : "Unknown error")
    } finally {
      replace ? setLoading(false) : setLoadingMore(false)
    }
  }, [authorizedFetch])

  useEffect(() => {
    const controller = new AbortController()
    void fetchPage(undefined, true, controller.signal)

    void authorizedFetch("/api/manage/check", controller.signal)
      .then((response) => response.text())
      .then((result) => setUsesBasicAuth(result === "true"))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
      })

    return () => controller.abort()
  }, [authorizedFetch, fetchPage])

  async function login(user: string, pass: string) {
    const response = await fetch("/api/manage/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    })

    if (response.status === 401) return false
    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `HTTP ${response.status}`)
    }

    setUsesBasicAuth(true)
    await fetchPage(undefined, true)
    return true
  }

  async function logout() {
    await authorizedFetch("/api/manage/logout", undefined, {
      method: "POST",
    })
    setFiles([])
    setCursor(null)
    setHasMore(false)
    setError("")
    setAuthRequired(true)
  }

  async function updateListType(targets: ManagedFile[], type: ListType) {
    const route = type === "Block" ? "block" : "white"
    await Promise.all(targets.map((file) =>
      authorizedFetch(`/api/manage/${route}/${encodeURIComponent(file.name)}`),
    ))
    const names = new Set(targets.map((file) => file.name))
    setFiles((current) => current.map((file) =>
      names.has(file.name)
        ? { ...file, metadata: { ...file.metadata, ListType: type } }
        : file,
    ))
  }

  async function deleteFiles(targets: ManagedFile[]) {
    await Promise.all(targets.map((file) =>
      authorizedFetch(`/api/manage/delete/${encodeURIComponent(file.name)}`),
    ))
    const names = new Set(targets.map((file) => file.name))
    setFiles((current) => current.filter((file) => !names.has(file.name)))
  }

  async function toggleFavorite(target: ManagedFile) {
    const response = await authorizedFetch(
      `/api/manage/toggleLike/${encodeURIComponent(target.name)}`,
    )
    const result = await response.json() as { liked?: boolean }
    setFiles((current) => current.map((file) =>
      file.name === target.name
        ? { ...file, metadata: { ...file.metadata, liked: Boolean(result.liked) } }
        : file,
    ))
  }

  async function renameFile(target: ManagedFile, fileName: string) {
    const query = new URLSearchParams({ newName: fileName })
    await authorizedFetch(
      `/api/manage/editName/${encodeURIComponent(target.name)}?${query}`,
    )
    setFiles((current) => current.map((file) =>
      file.name === target.name
        ? { ...file, metadata: { ...file.metadata, fileName } }
        : file,
    ))
  }

  return {
    deleteFiles,
    authRequired,
    error,
    files,
    hasMore,
    loadMore: () => cursor ? fetchPage(cursor) : Promise.resolve(),
    login,
    loading,
    loadingMore,
    logout,
    refresh: () => fetchPage(undefined, true),
    renameFile,
    setFiles,
    toggleFavorite,
    updateListType,
    usesBasicAuth,
  }
}
