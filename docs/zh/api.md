# 上传 API

## 上传文件

向 `POST /upload` 发送 `multipart/form-data`，文件字段名为 `file`：

```bash
curl -F "file=@/path/to/file.png" https://your-domain.example/upload
```

上传图片时，可以通过 `imageUploadMode` 选择 Telegram 上传方式：

```bash
# Telegram 图片接口，可能重新压缩
curl -F "file=@image.png" -F "imageUploadMode=photo" https://your-domain.example/upload

# Telegram 文档接口，保留图片原始数据
curl -F "file=@image.png" -F "imageUploadMode=document" https://your-domain.example/upload
```

启用上传身份验证后：

```bash
curl -u 'username:password' -F "file=@file.zip" https://your-domain.example/upload
```

响应是包含文件访问地址的 JSON 数组。设置 `ENABLE_SHORT_URLS=true` 后，返回地址会使用配置长度的短 ID。

## Pastebin

网页中的 Pastebin 会把输入文字转换为文件，并通过同一条上传流程发送。返回地址遵循相同的存储和短链接设置。

## 访问文件

文件通过 `GET /file/:id` 访问。图片、视频、音频和 PDF 等可预览类型会尽可能在浏览器中直接打开，其他类型按照保存的 Content-Type 返回。

## 管理 API

管理接口位于 `/api/manage/*`，使用 `BASIC_USER` 和 `BASIC_PASS` 对应的后台会话或 Basic Auth。它们主要供项目自带的管理界面使用；外部 API 客户端应将其响应格式视为可能随版本变化的内部接口。
