import { useEffect, useState } from 'react'
import { api } from '@/services/api'

interface Props {
  fileUrl: string
  alt: string
  className?: string
  fallbackClassName?: string
}

export default function SecurePreviewImage({
  fileUrl,
  alt,
  className,
  fallbackClassName,
}: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!fileUrl) {
      setPreviewSrc(null)
      setFailed(true)
      return
    }

    if (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:')) {
      setPreviewSrc(fileUrl)
      setFailed(false)
      return
    }

    let isCancelled = false
    let objectUrl: string | null = null

    setPreviewSrc(null)
    setFailed(false)

    api
      .get('/files/preview', {
        params: { url: fileUrl },
        responseType: 'blob',
      })
      .then((res) => {
        if (isCancelled) return
        objectUrl = URL.createObjectURL(res.data as Blob)
        setPreviewSrc(objectUrl)
      })
      .catch(() => {
        if (isCancelled) return
        setFailed(true)
      })

    return () => {
      isCancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [fileUrl])

  if (failed) {
    return (
      <div
        className={
          fallbackClassName ??
          'w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-lg'
        }
      >
        Img
      </div>
    )
  }

  if (!previewSrc) {
    return <div className="w-full h-full bg-gray-100 animate-pulse" />
  }

  return <img src={previewSrc} alt={alt} className={className} />
}
