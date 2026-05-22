<br/>
<br/>
<br/>
<br/>
<br/>
<br/>

<!--
<p align='center'>
  <img src='https://github.com/cluesurf/reed/blob/make/view/reed.svg?raw=true' height='256'/>
</p> -->

<h3 align='center'>@cluesurf/reed</h3>
<p align='center'>
  A Voicebox Emulator Ф
</p>

<br/>
<br/>
<br/>

## Overview

Reed is a simple TypeScript library, parsing
[Talk](https://github.com/cluesurf/talk)-encoded ASCII phonetic input
into structured phones, syllables, and utterances, then synthesizes them
into audio via an articulatory vocal-tract model (Kelly-Lochbaum
waveguide + LF glottal source) or a Klatt-style formant synthesizer.

The library ships pre-canned phonologies for English, Spanish, Arabic,
Hindi, and Mandarin, with a full IPA chart mapping for adding others.
The internal model carries source-offset metadata through every pipeline
stage, so an editor surface can highlight the input span that produced
any output sample.

An experimental codebase distilling decades of acoustic-phonetics work
into a runnable pipeline. Useful as a phonological metadata layer, an
articulator visualizer, or a starting point in front of a mature TTS
engine.

## Sources

| Algorithm / Technique                                 | Reason                                                                        | Paper                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2-pole cascade + parallel formant filters             | Standard speech-synthesis filter architecture; explicit Hz control over F1-F5 | [Klatt 1980, _Software for a cascade/parallel formant synthesizer_](https://doi.org/10.1121/1.383940)        |
| Adult-male F1/F2/F3 vowel targets                     | Canonical reference frequencies for the cardinal vowels                       | [Peterson & Barney 1952, _Control methods used in a study of the vowels_](https://doi.org/10.1121/1.1906875) |
| Fricative spectral peaks + approximant formant tables | Place-of-articulation acoustic targets per consonant                          | Stevens 1998, _Acoustic Phonetics_ (MIT Press)                                                               |
| Kelly-Lochbaum digital waveguide                      | Physical vocal-tract wave-propagation model from area functions               | Kelly & Lochbaum 1962, _Speech synthesis_                                                                    |
| Source-filter decomposition                           | Conceptual basis for separating the glottal source from the tract filter      | Fant 1960, _Acoustic Theory of Speech Production_                                                            |
| Liljencrants-Fant glottal pulse                       | Parametric voicing-source generation with one shape knob (Rd)                 | Liljencrants & Fant 1985, LF model (STL-QPSR)                                                                |
| Formant locus theory                                  | F2 transitions as the primary place-of-articulation perceptual cue            | [Liberman et al. 1954, _The role of consonant-vowel transitions_](https://doi.org/10.1037/h0054594)          |
| Cosine-on-grid tongue + lip diameter formulas         | Practical articulator → cross-section mapping for the tract                   | [Pink Trombone (Neil Thapen)](https://dood.al/pinktrombone/)                                                 |
| Per-language phoneme inventories                      | Cross-linguistic phonological reference for inventory definitions             | [PHOIBLE](https://phoible.org)                                                                               |
| IPA chart consonant + vowel coverage                  | Verifying Talk's IPA encoding completeness across languages                   | Ladefoged & Maddieson 1996, _The Sounds of the World's Languages_                                            |
| Vowel area functions                                  | Anatomically grounded vowel tract shapes for the cardinal vowels              | Story 1996, _Vocal tract area functions for an adult male speaker_                                           |

## Installation

```bash
pnpm add @cluesurf/reed
```

## Quick Start

```typescript
import { parse, synthesizeVowel, encodeWav } from '@cluesurf/reed'
import { writeFileSync } from 'node:fs'

const utterances = parse('hElO wOrld.')
console.log(utterances[0].words[0].syllables)

const samples = synthesizeVowel({
  vowel: 'a',
  duration: 1.0,
  sampleRate: 24_000,
  frequency: 130,
})
const wav = encodeWav({ samples, sampleRate: 24_000 })
writeFileSync('vowel-a.wav', wav)
```

## Parse

Turn Talk ASCII into a structured utterance tree with phonology
validation. Throws a typed error with a source offset if any phone isn't
in the inventory.

```typescript
import { parse, english } from '@cluesurf/reed'

const utterances = parse('kat.', { phonology: english })
// → [{
//     words: [{ syllables: [{ onset: [...], nucleus: [...], coda: [...] }] }],
//     intonation: 'declarative',
//     trailingPunctuation: '.',
//     source: { start: 0, end: 4 },
//   }]
```

Available phonologies: `english`, `spanish`, `arabic`, `hindi`,
`mandarin`. Build your own with `definePhonology`:

```typescript
import { definePhonology } from '@cluesurf/reed'

const tiny = definePhonology({
  name: 'tiny',
  phones: ['p', 'b', 't', 'd', 'a', 'i'],
})
```

Error modes for unknown phones: `throw` (default), `warn`, `ignore`.

```typescript
parse('taQ', { phonology: english, onUnknownPhone: 'warn' })
```

## Synthesize Vowels

Articulatory K-L tract driven by Pink-Trombone-style diameter shapes:

```typescript
import { synthesizeVowel, vowelDiameters } from '@cluesurf/reed'

const samples = synthesizeVowel({
  vowel: 'i', // 'i' | 'e' | 'a' | 'o' | 'u' | 'schwa'
  duration: 0.8,
  sampleRate: 24_000,
  frequency: 130,
  tenseness: 0.6,
})
```

Get the raw diameter array for the vowel's tract shape:

```typescript
const diameters = vowelDiameters('a', 44) // 44-segment array
```

## Synthesize Consonant + Vowel

Klatt-style formant synthesizer with explicit F1/F2/F3 trajectories per
consonant drawn from Klatt 1980 + Stevens 1998 + Peterson & Barney.

```typescript
import { synthesizeConsonantVowel } from '@cluesurf/reed'

const samples = synthesizeConsonantVowel({
  consonant: 'p', // any Talk consonant glyph
  vowel: 'a',
  duration: 0.65,
  sampleRate: 24_000,
  frequency: 130,
})
```

The articulatory consonant renderer is also available via
`synthesizeArticulatoryCv` for research / visualization.

## IPA Coverage

Every base IPA pulmonic consonant + the full IPA vowel chart maps to a
Talk encoding. See `note/library/reed/talk-ipa-mapping.md` for the
exhaustive table. Modifier marks (`h~` aspiration, `w~` labialization,
`y~` palatalization, `G~` velarization, `Q~` pharyngealization, `R~`
retroflexion, `!` ejective, `_` long, `@` syllabic, tone marks) layer
features onto base glyphs.

## WAV Output

```typescript
import { encodeWav } from '@cluesurf/reed'

const wav = encodeWav({ samples, sampleRate: 24_000 })
writeFileSync('out.wav', wav)
```

## Testing

Run the test suite:

```bash
pnpm test
```

Generate the sample audio files used to validate the synth output:

```bash
# Per-vowel /i e a o u/ WAVs + a chained version.
tsx task/make-test-audio.ts

# Per-consonant CV-syllable WAVs (44 consonants × /a/) + chained.
tsx task/make-test-consonants.ts

# Bundle the WAVs into shareable MP4s (vowels.mp4, consonants.mp4)
# over still images. Requires ffmpeg on PATH.
bash task/make-test-video-sample.sh
```

Outputs land in [`base/test/`](./base/test/):

- `vowel-{i,e,a,o,u,schwa}.wav`
- `consonant-<slug>.wav` for every IPA consonant
- `vowels-chained.wav`, `consonants-chained.wav`
- `vowels.mp4`, `consonants.mp4`

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE).

## ClueSurf

Made by [ClueSurf](https://clue.surf), meditating on the universe ¤.
Follow the work on [YouTube](https://youtube.com/@cluesurf),
[X](https://x.com/cluesurf),
[Instagram](https://instagram.com/cluesurf),
[Substack](https://cluesurf.substack.com),
[Facebook](https://facebook.com/cluesurf), and
[LinkedIn](https://linkedin.com/company/cluesurf), and browse more of
our open-source work here on [GitHub](https://github.com/cluesurf).
