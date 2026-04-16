export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024

export function getMaxUploadBytesForMime(mimeType: string): number {
  return mimeType.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES
}

export function bytesToMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(0)
}
