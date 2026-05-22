<br/>
<br/>
<br/>
<br/>
<br/>
<br/>

<p align='center'>
  <img src='https://github.com/cluesurf/reed/blob/make/view/reed.svg?raw=true' height='256'/>
</p>

<h3 align='center'>@cluesurf/reed</h3>
<p align='center'>
  A Voicebox Emulator θ
</p>

<br/>
<br/>
<br/>

## Overview

Reed parses [Talk](https://github.com/cluesurf/talk)-encoded ASCII
phonetic input into structured phones, syllables, and utterances, then
synthesizes them into audio via an articulatory vocal-tract model
(Kelly-Lochbaum waveguide + LF glottal source) or a Klatt-style formant
synthesizer.

The library ships pre-canned phonologies for English, Spanish, Arabic,
Hindi, and Mandarin, with a full IPA chart mapping for adding others.
The internal model carries source-offset metadata through every pipeline
stage, so an editor surface can highlight the input span that produced
any output sample.

Use it as a research tool for articulatory phonology, a teaching aid for
visualizing speech production, or as the metadata layer in front of a
mature TTS engine.

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

## Phone Features

Every parsed phone carries a structured `PhoneFeatures` descriptor:

```typescript
type PhoneFeatures = {
  kind: 'consonant' | 'vowel'
  site?: ConsonantSite // bilabial | alveolar | velar | ...
  mold?: ConsonantMold // plosive | fricative | nasal | ...
  height?: VowelHeight // close | mid | open | ...
  backness?: VowelBackness // front | central | back
  rounded?: boolean
  voiced?: boolean
  aspirated?: boolean
  // ...
}
```

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
