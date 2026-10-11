#!/usr/bin/env bash
# ============================================================
# Build assets/veo-frames/patch.webp — the collar patch that
# hero-frames.js draws over every live frame.
#
#   ./tools/build-hero-patch.sh
#
# Run this after build-hero-frames.sh, and re-run it whenever
# the frame set is rebuilt: the patch is derived from the
# frames and is wrong for a different clip.
#
# WHY THIS EXISTS
# ---------------
# build-hero-frames.sh keeps a pixel when it is saturated
# (skin), dark (hair) or bright (shirt). The shadowed crease
# where the collar meets the neck is none of those — it is
# mid-luma and desaturated, the same values as the backdrop —
# and it opens sideways into real background, so the script's
# floodfill cannot classify it as an interior hole either.
# About half the frames lose a bite of collar to this.
#
# It cannot be fixed by repairing alpha alone: WebP discards
# RGB under fully transparent pixels, so a hole has no colour
# left to recover. The missing pixels have to come from a
# frame that still has them.
#
# HOW
# ---
# The body barely moves across the sweep, so the resting frame
# can supply them. Two masks keep the patch honest:
#
#   detect - where to look for holes. Pixels the median says
#            are body in >85% of frames (a hole is a minority
#            at any given pixel, so the median votes it out),
#            below the chin, and excluding the central neck
#            column, which moves with the head and has no
#            holes to fix.
#
#   paint  - where the patch may actually draw. Looser (>45%),
#            because the collar tip is genuinely ambiguous —
#            about half the frames have collar there — and at
#            85% the patch stopped just short of it and left a
#            3px sliver of background showing.
#
# The patch covers only the dilated hole zones, never the
# silhouette edges, so the live frame still owns the outline.
# ============================================================
set -euo pipefail

DIR="${DIR:-assets/veo-frames}"
COUNT="${COUNT:-64}"
OUT="${OUT:-$DIR/patch.webp}"
DETECT_PCT="${DETECT_PCT:-85}"   # median threshold for finding holes
PAINT_PCT="${PAINT_PCT:-45}"     # median threshold for drawing them
CHIN_Y="${CHIN_Y:-490}"          # nothing above this row is body
NECK_X0="${NECK_X0:-440}"        # central neck column, left edge
NECK_W="${NECK_W:-120}"          # ... and its width
DILATE="${DILATE:-10}"           # grow hole zones by this, px
FEATHER="${FEATHER:-5}"          # soften the patch boundary, px

command -v magick >/dev/null || { echo "error: ImageMagick 7 (magick) not installed" >&2; exit 1; }
[[ -f "$DIR/center.webp" ]] || { echo "error: no $DIR/center.webp — run build-hero-frames.sh first" >&2; exit 1; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
W=$(identify -format '%w' "$DIR/center.webp")
H=$(identify -format '%h' "$DIR/center.webp")
echo "frames   : $DIR ($COUNT @ ${W}x${H})"

# --- consensus: per-pixel median alpha over the whole sweep -------------
magick "$DIR"/frame_*.webp -alpha extract -evaluate-sequence median "$T/median.png"

# --- detect mask: consensus body, below the chin, minus the neck column -
magick -size "${W}x$((CHIN_Y - 10))" xc:black \
       \( -size "${W}x20" gradient:black-white \) \
       \( -size "${W}x$((H - CHIN_Y - 10))" xc:white \) -append "$T/vgate.png"
magick \( -size "${NECK_X0}x${H}" xc:white \) \
       \( -size "${NECK_W}x${H}" xc:black \) \
       \( -size "$((W - NECK_X0 - NECK_W))x${H}" xc:white \) +append \
       -blur 0x10 "$T/colgate.png"
magick "$T/median.png" -threshold "${DETECT_PCT}%" -morphology Erode Disk:1 \
       "$T/vgate.png"   -compose multiply -composite \
       "$T/colgate.png" -compose multiply -composite "$T/detect.png"

# --- union of every frame's holes --------------------------------------
magick -size "${W}x${H}" xc:black "$T/holes.png"
for ((i = 0; i < COUNT; i++)); do
  f="$DIR/frame_$i.webp"
  [[ -f "$f" ]] || continue
  magick "$f" -alpha extract -threshold 75% -negate "$T/h.png"
  magick "$T/h.png" "$T/detect.png" -compose multiply -composite -threshold 50% "$T/one.png"
  magick "$T/holes.png" "$T/one.png" -compose lighten -composite "$T/holes.png"
done
echo "holes    : $(magick "$T/holes.png" -format '%[fx:mean*100]%% of frame, bbox %@' info:)"

# --- patch = dilated hole zones, clipped to where painting is allowed ---
magick "$T/holes.png" -morphology Close Disk:4 -morphology Dilate "Disk:$DILATE" \
       -blur "0x$FEATHER" "$T/zone.png"
magick "$T/median.png" -threshold "${PAINT_PCT}%" -morphology Close Disk:3 "$T/paint.png"
magick "$T/zone.png" "$T/paint.png" -compose multiply -composite "$T/mask.png"

magick "$DIR/center.webp" -alpha extract "$T/mask.png" -compose multiply -composite "$T/alpha.png"
magick "$DIR/center.webp" "$T/alpha.png" -alpha off -compose CopyOpacity -composite \
       -define webp:lossless=true "$OUT"

echo "patch    : $OUT ($(stat -c%s "$OUT") bytes, lossless)"
echo
echo "Refresh the page — hero-frames.js picks it up automatically."
