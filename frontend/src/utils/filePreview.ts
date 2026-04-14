export function getFilePreviewUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  return `/api/files/preview?url=${encodeURIComponent(url)}`
}
