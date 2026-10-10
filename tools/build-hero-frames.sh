#!/usr/bin/env bash
# ============================================================
# Turn a short head-turn clip into the frame set hero-frames.js
# expects.
#
#   ./tools/build-hero-frames.sh my-veo-clip.mp4
#
# Produces assets/frames/frame_0.webp ... frame_63.webp plus
# center.webp (the resting pose, taken from the middle).
#
# The clip should be a single continuous head turn, left to
# right, against a flat background. See tools/VEO-PROMPT.md.
# ============================================================
set -euo pipefail

SRC="${1:-}"
COUNT="${COUNT:-64}"
WIDTH="${WIDTH:-900}"      # output frame width in px
QUALITY="${QUALITY:-72}"   # webp quality
OUT="assets/frames"

if [[ -z "$SRC" ]]; then
  echo "usage: $0 <clip.mp4>   (env: COUNT=$COUNT WIDTH=$WIDTH QUALITY=$QUALITY)" >&2
  exit 1
fi
if [[ ! -f "$SRC" ]]; then
  echo "error: no such file: $SRC" >&2
  exit 1
fi
command -v ffmpeg >/dev/null || { echo "error: ffmpeg not installed" >&2; exit 1; }

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
if [[ -z "$DUR" ]] || awk -v d="$DUR" 'BEGIN{exit !(d<=0)}'; then
  echo "error: could not read duration from $SRC" >&2
  exit 1
fi

# sample COUNT frames spread evenly across the whole clip
# (awk rather than bc — bc isn't installed everywhere)
FPS=$(awk -v c="$COUNT" -v d="$DUR" 'BEGIN{printf "%.6f", c/d}')

echo "source   : $SRC"
echo "duration : ${DUR}s"
echo "sampling : $COUNT frames @ ${FPS} fps -> ${WIDTH}px wide webp q$QUALITY"

rm -rf "$OUT"
mkdir -p "$OUT"

# the fps filter sets the output rate and -frames:v caps the count, so no
# -vsync/-fps_mode needed (and -vsync was removed in ffmpeg 7)
# -f image2 is required: without it libwebp writes ONE animated .webp
# instead of a numbered sequence
ffmpeg -loglevel error -y -i "$SRC" \
  -vf "fps=${FPS},scale=${WIDTH}:-2:flags=lanczos" \
  -frames:v "$COUNT" \
  -c:v libwebp -quality "$QUALITY" -compression_level 6 -preset picture \
  -f image2 -start_number 0 "$OUT/frame_%d.webp"

MID=$((COUNT / 2))
if [[ ! -f "$OUT/frame_$MID.webp" ]]; then
  echo "error: extraction produced too few frames" >&2
  exit 1
fi
cp "$OUT/frame_$MID.webp" "$OUT/center.webp"

GOT=$(find "$OUT" -name 'frame_*.webp' | wc -l)
TOTAL=$(du -sh "$OUT" | cut -f1)
echo "done     : $GOT frames + center.webp  ($TOTAL)"
[[ "$GOT" -lt "$COUNT" ]] && echo "warning  : expected $COUNT, got $GOT — clip may be shorter than assumed"
echo
echo "Refresh the page — the hero will pick these up automatically."
