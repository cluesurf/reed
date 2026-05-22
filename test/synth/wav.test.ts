// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { encodeWav } from '@/synth/wav'

describe('encodeWav', () => {
  it('encodes a tiny sample as a valid RIFF/WAVE container', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1])
    const out = encodeWav({ samples, sampleRate: 8000 })
    // 44-byte header + 4 samples × 2 bytes = 52 bytes.
    expect(out.length).toBe(52)
    // RIFF magic.
    expect(String.fromCharCode(out[0]!, out[1]!, out[2]!, out[3]!)).toBe('RIFF')
    // WAVE magic.
    expect(String.fromCharCode(out[8]!, out[9]!, out[10]!, out[11]!)).toBe('WAVE')
    // 'fmt ' chunk.
    expect(String.fromCharCode(out[12]!, out[13]!, out[14]!, out[15]!)).toBe('fmt ')
    // 'data' chunk.
    expect(String.fromCharCode(out[36]!, out[37]!, out[38]!, out[39]!)).toBe('data')
  })

  it('uses 16-bit PCM with the requested sample rate', () => {
    const samples = new Float32Array([0])
    const out = encodeWav({ samples, sampleRate: 24_000 })
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
    // Format code (PCM = 1)
    expect(view.getUint16(20, true)).toBe(1)
    // Channels (mono)
    expect(view.getUint16(22, true)).toBe(1)
    // Sample rate
    expect(view.getUint32(24, true)).toBe(24_000)
    // Bits per sample
    expect(view.getUint16(34, true)).toBe(16)
  })

  it('clamps out-of-range samples', () => {
    const samples = new Float32Array([2.0, -2.0])
    const out = encodeWav({ samples, sampleRate: 8000 })
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
    // First sample (clamped to +1 → 32767)
    expect(view.getInt16(44, true)).toBe(0x7fff)
    // Second sample (clamped to -1 → -32768)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })
})
