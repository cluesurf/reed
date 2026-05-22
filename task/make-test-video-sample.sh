#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Bundle reed's test audio into shareable MP4s.
#
# Produces two videos in `deck/reed/base/test/`:
#
#   - vowels.mp4      — chained /i e a o u/ over vowel.png
#   - consonants.mp4  — every consonant CV syllable over
#                       vowel.png
#
# Inputs expected in `deck/reed/base/test/`:
#
#   - vowel-*.wav         (run task/make-test-audio.ts)
#   - consonant-*.wav     (run task/make-test-consonants.ts)
#   - vowel.png           (optional still image; auto-
#                         generated if absent)
#
# Usage (from deck/reed/):
#   bash task/make-test-video-sample.sh
#
# Requires `ffmpeg` on PATH. Tested with ffmpeg 6+ on macOS.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(cd "$SCRIPT_DIR/../base/test" && pwd)"

# Verify ffmpeg is available.
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[make-test-video-sample] ffmpeg not found on PATH." >&2
  echo "  Install via Homebrew: brew install ffmpeg" >&2
  exit 1
fi

# Generate black-frame fallback images if the
# per-MP4 source PNGs are missing so the script stays
# runnable before the assets are added.
VOWEL_IMAGE="$TEST_DIR/vowel.png"
CONSONANT_IMAGE="$TEST_DIR/consonants.png"
GENERATED_IMAGES=()

ensure_image() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "[make-test-video-sample] no $(basename "$path"); generating 720x720 black placeholder"
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i "color=c=black:s=720x720:d=1" \
      -frames:v 1 \
      "$path"
    GENERATED_IMAGES+=("$path")
  fi
}

ensure_image "$VOWEL_IMAGE"
ensure_image "$CONSONANT_IMAGE"

# Helper: chain a list of WAVs (by absolute paths) into a
# single WAV via ffmpeg's concat demuxer.
chain_wavs() {
  local out="$1"; shift
  local tmp_list
  tmp_list="$(mktemp -t reed-concat-XXXX).txt"
  for wav in "$@"; do
    echo "file '$wav'" >> "$tmp_list"
  done
  ffmpeg -y -hide_banner -loglevel error \
    -f concat -safe 0 -i "$tmp_list" \
    -c copy \
    "$out"
  rm -f "$tmp_list"
}

# Helper: encode an image + audio file into an MP4.
make_image_video() {
  local image="$1"
  local audio="$2"
  local output="$3"
  ffmpeg -y -hide_banner -loglevel error \
    -loop 1 -i "$image" \
    -i "$audio" \
    -c:v libx264 -pix_fmt yuv420p -preset medium -tune stillimage \
    -c:a aac -b:a 192k \
    -shortest \
    -movflags +faststart \
    "$output"
}

# ===================== Vowels =====================

VOWELS=(i e a o u)
VOWEL_PATHS=()
for v in "${VOWELS[@]}"; do
  if [[ ! -f "$TEST_DIR/vowel-$v.wav" ]]; then
    echo "[make-test-video-sample] missing: $TEST_DIR/vowel-$v.wav" >&2
    echo "  Run: tsx task/make-test-audio.ts" >&2
    exit 1
  fi
  VOWEL_PATHS+=("$TEST_DIR/vowel-$v.wav")
done

VOWEL_CHAIN="$TEST_DIR/vowels-chained-all.wav"
chain_wavs "$VOWEL_CHAIN" "${VOWEL_PATHS[@]}"
echo "[make-test-video-sample] chained → $VOWEL_CHAIN"

VOWEL_VIDEO="$TEST_DIR/vowels.mp4"
make_image_video "$VOWEL_IMAGE" "$VOWEL_CHAIN" "$VOWEL_VIDEO"
echo "[make-test-video-sample] wrote $VOWEL_VIDEO"

# =================== Consonants ===================
#
# Canonical IPA order. Slugs match task/make-test-consonants.ts.
# Capital-letter Talk glyphs get a `-cap` suffix to avoid
# case-insensitive-filesystem collisions with their
# lowercase counterparts.

CONSONANT_SLUGS=(
  # Plosives
  p b t d c J-cap k g K-cap glottal-stop
  # Nasals
  m M-cap n N-cap q
  # Fricatives
  F-cap B-cap f v T-cap D-cap s z sh zh C-cap Z-cap x G-cap X-cap H-cap Q-cap h
  # Affricates
  tx dj ch j
  # Approximants
  V-cap y w
  # Laterals
  l L-cap
  # Trills
  r R-cap
)

CONSONANT_PATHS=()
MISSING_CONSONANTS=()
for slug in "${CONSONANT_SLUGS[@]}"; do
  local_path="$TEST_DIR/consonant-$slug.wav"
  if [[ ! -f "$local_path" ]]; then
    MISSING_CONSONANTS+=("$slug")
  else
    CONSONANT_PATHS+=("$local_path")
  fi
done

if [[ ${#MISSING_CONSONANTS[@]} -gt 0 ]]; then
  echo "[make-test-video-sample] missing ${#MISSING_CONSONANTS[@]} consonant WAV(s):" >&2
  printf '   %s\n' "${MISSING_CONSONANTS[@]}" >&2
  echo "  Run: tsx task/make-test-consonants.ts" >&2
  exit 1
fi

CONSONANT_CHAIN="$TEST_DIR/consonants-chained-all.wav"
chain_wavs "$CONSONANT_CHAIN" "${CONSONANT_PATHS[@]}"
echo "[make-test-video-sample] chained → $CONSONANT_CHAIN"

CONSONANT_VIDEO="$TEST_DIR/consonants.mp4"
make_image_video "$CONSONANT_IMAGE" "$CONSONANT_CHAIN" "$CONSONANT_VIDEO"
echo "[make-test-video-sample] wrote $CONSONANT_VIDEO"

# ===================== Done =======================

if [[ ${#GENERATED_IMAGES[@]} -gt 0 ]]; then
  echo "[make-test-video-sample] note: these images were auto-generated as black placeholders:"
  for path in "${GENERATED_IMAGES[@]}"; do
    echo "  - $path"
  done
  echo "  Replace them with real images and re-run for non-blank frames."
fi
