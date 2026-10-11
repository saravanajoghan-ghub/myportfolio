#!/usr/bin/env bash
# ============================================================
# Even out the shirt across the hero frame set.
#
#   ./tools/clean-hero-shirt.sh            # rewrites the frames in place
#   DRY=1 OUT=/tmp/x ./tools/clean-hero-shirt.sh   # write elsewhere
#
# Run after build-hero-frames.sh, and again whenever the frame
# set is rebuilt.
#
# WHY
# ---
# The head turn moves a cast shadow across the shirt, so the
# shoulders go light and dark as the pointer scrubs. On a
# still that reads as normal photographic shading; scrubbing
# through it reads as grime sliding around the shirt.
#
# HOW
# ---
# Flat-field correction over the shirt only: divide out a
# heavily blurred copy of its own luminance and rescale to a
# fixed TARGET. That removes LOW-frequency shading (the cast
# shadow) while leaving HIGH-frequency detail — collar edges,
# the placket, fold creases — untouched, so the collar keeps
# its shape instead of flattening into a white blob.
#
# The shirt is isolated by HSB saturation, not max-min:
# absolute saturation is low for dark skin too, so a max-min
# threshold ate the neck and beard. Plus a brightness floor,
# and a cutoff above the chin.
#
# Holes: the matte drops the shadowed crease where the collar
# meets the neck (mid-luma and desaturated like the backdrop,
# and it opens sideways into real background, so the build
# script's floodfill cannot call it interior). Those are
# filled here rather than separately, because once the shirt
# is flat the fill tone is the same everywhere — no patch
# plate, no ghost, no seam. Fill geometry comes from a median
# across the sweep: a hole is a minority at any given pixel,
# so the median votes it out.
# ============================================================
set -euo pipefail

DIR="${DIR:-assets/veo-frames}"
OUT="${OUT:-$DIR}"
COUNT="${COUNT:-64}"
QUALITY="${QUALITY:-82}"
TARGET="${TARGET:-0.90}"     # flattened shirt level, 0-1
SATMAX="${SATMAX:-18}"       # HSB saturation %, above this is skin
LUMAMIN="${LUMAMIN:-46}"     # luma %, below this is hair or deep shadow
CHIN_Y="${CHIN_Y:-515}"      # nothing above this row is shirt
FIELD="${FIELD:-45}"         # illumination blur sigma, px
CONSENSUS="${CONSENSUS:-70}" # median-alpha % that counts as body

command -v magick >/dev/null || { echo "error: ImageMagick 7 (magick) not installed" >&2; exit 1; }
[[ -f "$DIR/center.webp" ]] || { echo "error: no $DIR/center.webp — run build-hero-frames.sh first" >&2; exit 1; }
mkdir -p "$OUT"

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
W=$(identify -format %w "$DIR/center.webp")
H=$(identify -format %h "$DIR/center.webp")
echo "frames   : $DIR (${W}x${H})"

# --- vertical gate: soft edge so the shirt mask does not start abruptly --
magick -size "${W}x${CHIN_Y}" xc:black \
       \( -size "${W}x30" gradient:black-white \) \
       \( -size "${W}x$((H - CHIN_Y - 30))" xc:white \) -append "$T/vgate.png"

# --- consensus body, for hole geometry ----------------------------------
magick "$DIR"/frame_*.webp -alpha extract -evaluate-sequence median \
       -threshold "${CONSENSUS}%" -morphology Close Disk:3 "$T/cons.png"
# Eroded, so hole filling can never reach the outer silhouette — that edge
# stays the live frame's own soft matte rather than a hard filled one.
magick "$T/cons.png" "$T/vgate.png" -compose multiply -composite -threshold 50% \
       -morphology Erode Disk:7 "$T/body.png"

clean_one() {
  local F="$1" O="$2"
  magick "$F" -alpha extract "$T/a.png"
  magick "$F" -alpha off "$T/rgb.png"
  magick "$T/rgb.png" -colorspace Gray "$T/L.png"
  magick "$T/rgb.png" -colorspace HSB -channel G -separate "$T/sat.png"

  # shirt = opaque AND desaturated AND bright AND below the chin
  magick "$T/sat.png" -negate -threshold "$((100 - SATMAX))%" "$T/desat.png"
  magick "$T/L.png" -threshold "${LUMAMIN}%" "$T/bright.png"
  magick "$T/a.png" -threshold 60% "$T/op.png"
  magick "$T/desat.png" "$T/bright.png" -compose multiply -composite \
         "$T/op.png"    -compose multiply -composite \
         "$T/vgate.png" -compose multiply -composite \
         -morphology Open Disk:3 -morphology Close Disk:6 "$T/m.png"
  magick "$T/m.png" -blur 0x5 "$T/msoft.png"

  # illumination field from shirt pixels only: blur(L*M)/blur(M), so skin
  # and hair next to the collar cannot drag the field down
  magick "$T/L.png" "$T/m.png" -compose multiply -composite -blur "0x$FIELD" "$T/num.png"
  magick "$T/m.png" -blur "0x$FIELD" "$T/den.png"
  magick "$T/num.png" "$T/den.png" -compose divide -composite "$T/field.png"

  magick "$T/rgb.png" "$T/field.png" -compose divide -composite \
         -evaluate multiply "$TARGET" "$T/flat.png"
  magick "$T/rgb.png" "$T/flat.png" "$T/msoft.png" -composite "$T/merged.png"

  # --- fill matte holes with the flattened shirt's own local tone -------
  # parens matter: a bare -negate here applies to every image in the list,
  # which inverts body too and makes "hole" the whole background
  # Open drops specks; Dilate then swallows the hole's own feathered rim —
  # without it the rim keeps its grey RGB at partial alpha and shows as a
  # thin orange hairline once the inside is filled.
  magick "$T/body.png" \( "$T/op.png" -negate \) -compose multiply -composite \
         -morphology Open Disk:2 -morphology Dilate Disk:5 "$T/hole.png"
  magick "$T/merged.png" "$T/m.png" -compose multiply -composite -blur 0x30 "$T/fnum.png"
  magick "$T/m.png" -blur 0x30 "$T/fden.png"
  magick "$T/fnum.png" "$T/fden.png" -compose divide -composite "$T/fill.png"
  magick "$T/hole.png" -blur 0x2 "$T/paste.png"
  magick "$T/merged.png" "$T/fill.png" "$T/paste.png" -composite "$T/final.png"
  magick "$T/a.png" \( "$T/hole.png" -blur 0x1.5 \) -compose lighten -composite "$T/a2.png"

  magick "$T/final.png" "$T/a2.png" -alpha off -compose CopyOpacity -composite \
         -quality "$QUALITY" -define webp:method=6 "$O"
}

for ((i = 0; i < COUNT; i++)); do
  f="$DIR/frame_$i.webp"
  [[ -f "$f" ]] || continue
  clean_one "$f" "$T/o.webp"
  mv "$T/o.webp" "$OUT/frame_$i.webp"
  printf '\r  cleaned %d/%d' "$((i + 1))" "$COUNT"
done
echo
clean_one "$DIR/center.webp" "$T/o.webp"
mv "$T/o.webp" "$OUT/center.webp"

echo "done     : $OUT  ($(du -sh "$OUT" | cut -f1))"
echo
echo "Refresh the page — the hero picks these up automatically."
