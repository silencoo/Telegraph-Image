# Upload API

## Upload a file

Send `multipart/form-data` to `POST /upload` with the file in the `file` field:

```bash
curl -F "file=@/path/to/file.png" https://your-domain.example/upload
```

For images, choose the Telegram upload mode with the `imageUploadMode` field:

```bash
# Telegram image path; may be recompressed
curl -F "file=@image.png" -F "imageUploadMode=photo" https://your-domain.example/upload

# Telegram document path; preserves original image bytes
curl -F "file=@image.png" -F "imageUploadMode=document" https://your-domain.example/upload
```

When upload authentication is enabled:

```bash
curl -u 'username:password' -F "file=@file.zip" https://your-domain.example/upload
```

The response is a JSON array containing the uploaded file URL. With `ENABLE_SHORT_URLS=true`, the URL uses the configured short ID length.

## Pastebin

The web interface converts entered text into a file and sends it through the same upload pipeline. Its returned URL follows the same storage and short-link settings.

## File access

Uploaded files are served through `GET /file/:id`. Previewable image, video, audio, and PDF responses are served inline when possible. Other file types are returned with their stored content type.

## Management API

Management endpoints are under `/api/manage/*` and use the same dashboard session or Basic credentials configured by `BASIC_USER` and `BASIC_PASS`. They are intended for the bundled admin interface; API clients should treat their payloads as internal and version-dependent.
