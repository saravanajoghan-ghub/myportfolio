#!/usr/bin/env bash
# Assemble the keyed good2 frame set into pointer compass order.
#
#   INPUT=/tmp/keyed-good2 OUT=assets/veo-frames ./tools/assemble-hero-directions.sh
#
# good2 has right, down, and up poses but no left-facing pose. The left
# sector mirrors the right-facing frames. Mirroring switches at the neutral
# front pose so the flip itself is not visible.
set -euo pipefail

INPUT="${INPUT:-}"
OUT="${OUT:-}"
[[ -n "$INPUT" && -n "$OUT" ]] || {
  echo "usage: INPUT=<keyed 64-frame dir> OUT=<destination> $0" >&2
  exit 1
}
[[ "$INPUT" != "$OUT" ]] || {
  echo "error: INPUT and OUT must be different directories" >&2
  exit 1
}
[[ -f "$INPUT/center.webp" && -f "$INPUT/frame_63.webp" ]] || {
  echo "error: INPUT must contain center.webp and frame_0.webp ... frame_63.webp" >&2
  exit 1
}
command -v magick >/dev/null || { echo "error: ImageMagick 7 (magick) not installed" >&2; exit 1; }
mkdir -p "$OUT"

while IFS=: read -r dst src flip; do
  if [[ "$flip" == 1 ]]; then
    magick "$INPUT/frame_$src.webp" -flop -quality 92 "$OUT/frame_$dst.webp"
  else
    cp "$INPUT/frame_$src.webp" "$OUT/frame_$dst.webp"
  fi
done < <(awk 'BEGIN {
  for (i = 0; i < 64; i++) {
    # Pointer angle order: right, down, left, up. The green-screen clip
    # contains distinct lateral, downward, and upward gaze passes.
    if (i <= 4)       { src = 18 + i / 4; flip = 0 }
    else if (i <= 8)  { src = 22 + (i - 4) / 4; flip = 0 }
    else if (i <= 16) { src = 22 + 6 * (i - 8) / 8; flip = 0 }
    else if (i <= 24) { src = 28 - 6 * (i - 16) / 8; flip = 1 }
    else if (i <= 32) { src = 22 - 4 * (i - 24) / 8; flip = 1 }
    else if (i <= 40) { src = 18 + 13 * (i - 32) / 8; flip = 1 }
    else if (i <= 48) { src = 31; flip = 1 - int((i - 40) / 4) }
    else if (i <= 56) { src = 31 - 23 * (i - 48) / 8; flip = 0 }
    else              { src = 8 + 10 * (i - 56) / 8; flip = 0 }
    printf "%d:%d:%d\n", i, int(src + 0.5), flip
  }
}')

cp "$INPUT/center.webp" "$OUT/center.webp"
echo "assembled: $OUT (right, down, mirrored left, up)"
