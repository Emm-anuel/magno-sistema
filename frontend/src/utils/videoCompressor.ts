import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export interface VideoCompressOptions {
  maxResolution?: '720p' | '480p' // default: '720p'
  crf?: number                     // 23–35, default: 28
}

export async function compressVideo(
  file: File,
  onProgress: (percent: number) => void,
  options?: VideoCompressOptions
): Promise<File> {
  const resolution = options?.maxResolution ?? '720p'
  const crf = options?.crf ?? 28

  try {
    const ffmpeg = new FFmpeg()

    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    })

    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100))
    })

    await ffmpeg.writeFile('input.mp4', await fetchFile(file))

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

    await ffmpeg.exec(args)

    const data = await ffmpeg.readFile('output.mp4')

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
    console.warn('videoCompressor: ffmpeg failed, returning original file', err)
    return file
  }
}
