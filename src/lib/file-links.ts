export type LinkFormat = "url" | "markdown" | "bbcode" | "html"

export interface UploadedFile {
  fileName: string
  url: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function formatLink(file: UploadedFile, format: LinkFormat) {
  switch (format) {
    case "markdown":
      return `![${file.fileName}](${file.url})`
    case "bbcode":
      return `[img]${file.url}[/img]`
    case "html":
      return `<img src="${file.url}" alt="${escapeHtml(file.fileName)}">`
    default:
      return file.url
  }
}
