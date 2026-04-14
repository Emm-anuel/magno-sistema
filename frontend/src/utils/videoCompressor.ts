import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export interface VideoCompressOptions {
  maxResolution?: '720p' | '480p' // default: '720p'
  crf?: number                     // 23–35, default: 28
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout al ${label}`))
    }, ms)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export async function compressVideo(
  file: File,
  onProgress: (percent: number) => void,
  options?: VideoCompressOptions
): Promise<File> {
  const resolution = options?.maxResolution ?? '720p'
  const crf = options?.crf ?? 28

  if (file.size === 0) {
    console.warn(`videoCompressor: archivo vacío "${file.name}", usando original`)
    return file
  }

  const ffmpeg = new FFmpeg()

  try {
    await withTimeout(
      ffmpeg.load({
        coreURL: new URL('/ffmpeg/ffmpeg-core.js', window.location.origin).href,
        wasmURL: new URL('/ffmpeg/ffmpeg-core.wasm', window.location.origin).href,
      }),
      30_000,
      'cargar FFmpeg',
    )

    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100))
    })

    await withTimeout(ffmpeg.writeFile('input.mp4', await fetchFile(file)), 20_000, 'escribir archivo de entrada')

    const audioOptions =
      resolution === '720p'
        ? ['-b:a', '96k']
        : ['-b:a', '64k']

    const scale = resolution === '720p' ? 'scale=-2:720' : 'scale=-2:480'

    const args = [
      '-i', 'input.mp4',
      '-vf', scale,
      '-c:v', 'libx264',
      '-crf', String(crf),
      '-preset', 'fast',
      '-c:a', 'aac',
      ...audioOptions,
      'output.mp4',
    ]

    await withTimeout(ffmpeg.exec(args), 180_000, 'optimizar video')

    const data = await withTimeout(ffmpeg.readFile('output.mp4'), 20_000, 'leer archivo optimizado')

    let blob: Blob
    if (data instanceof Uint8Array) {
      // Copy into a plain ArrayBuffer to satisfy strict BlobPart typing
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      blob = new Blob([buffer], { type: 'video/mp4' })
    } else {
      // data is string — encode to bytes
      const encoder = new TextEncoder()
      blob = new Blob([encoder.encode(data)], { type: 'video/mp4' })
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const compressedFile = new File([blob], `${baseName}_compressed.mp4`, {
      type: 'video/mp4',
    })

    await ffmpeg.deleteFile('input.mp4')
    await ffmpeg.deleteFile('output.mp4')

    const originalMB = (file.size / 1024 / 1024).toFixed(2)
    const compressedMB = (compressedFile.size / 1024 / 1024).toFixed(2)
    const reductionPct = (
      ((file.size - compressedFile.size) / file.size) * 100
    ).toFixed(1)
    console.log(
      `Video comprimido: ${originalMB}MB → ${compressedMB}MB (-${reductionPct}%)`
    )

    return compressedFile
  } catch (err) {
    console.warn('videoCompressor: ffmpeg failed or timeout, returning original file', err)
    return file
  } finally {
    try {
      ffmpeg.terminate()
    } catch {
      // terminate() may throw if not fully loaded — ignore
    }
  }
}
