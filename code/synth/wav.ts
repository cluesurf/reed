// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Tiny WAV encoder. Serializes a mono Float32Array of
 * audio samples (range [-1, 1]) to a 16-bit PCM WAV
 * Uint8Array.
 *
 * No dependencies; safe to run in browser and Node.
 *
 * The format is the standard RIFF / WAVE container:
 *
 *   "RIFF" (4 bytes)
 *   total size minus 8 (4 bytes, LE)
 *   "WAVE" (4 bytes)
 *   "fmt " (4 bytes)
 *   16 (4 bytes, LE) — fmt chunk size
 *   1 (2 bytes, LE) — PCM format
 *   channels (2 bytes, LE)
 *   sample rate (4 bytes, LE)
 *   byte rate (4 bytes, LE) — sampleRate * channels * 2
 *   block align (2 bytes, LE) — channels * 2
 *   16 (2 bytes, LE) — bits per sample
 *   "data" (4 bytes)
 *   data size (4 bytes, LE) — samples.length * 2
 *   PCM samples (2 bytes each, LE)
 */

export type WavInput = {
  samples: Float32Array
  sampleRate: number
}

export function encodeWav(input: WavInput): Uint8Array {
  const { samples, sampleRate } = input
  const channels = 1
  const bytesPerSample = 2
  const dataLen = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLen)
  const view = new DataView(buffer)

  // RIFF header.
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)
  writeAscii(view, 8, 'WAVE')

  // fmt sub-chunk.
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // sub-chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * bytesPerSample, true)
  view.setUint16(32, channels * bytesPerSample, true)
  view.setUint16(34, bytesPerSample * 8, true)

  // data sub-chunk.
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataLen, true)

  // Samples (clamped + scaled to 16-bit signed int).
  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    const intSample = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return new Uint8Array(buffer)
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
