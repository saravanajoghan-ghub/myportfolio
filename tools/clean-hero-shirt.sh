#!/usr/bin/env bash
# ============================================================
# Even out the shirt across the hero frame set.
#
#   ./tools/clean-hero-shirt.sh            # rewrites the frames in place
#   DIR=src OUT=/tmp/x ./tools/clean-hero-shirt.sh   # write elsewhere
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
# RELIGHT, don't flatten. Each frame's broad illumination is
# divided out and the SET'S MEAN illumination put back:
#
#     out = rgb * mean_field / field_i
#
# so the shirt is lit the same way in every frame while keeping
# the shading a real photograph has. The ratio is ~1 everywhere
# except where the cast shadow actually moved, so most of the
# picture is left alone.
#
# An earlier version divided by field_i and multiplied by a
# CONSTANT. That is flat-fielding, and it is wrong here: it
# removes all structure above the field scale, and the collar
# IS structure at that scale. Each wing went to the same level
# as the chest, which killed the fold line and left the wing's
# cast shadow sitting on the shirt as a bare grey triangle
# with nothing to explain it. Relighting to the mean cannot do
# that — the collar's own contribution is in the numerator and
# the denominator both, so it divides out.
#
# FIELD is the scale of "illumination", and it has to stay well
# above the size of anything that is a real object. The collar
# is ~120px across at this frame size, so a 45px field treated
# each wing as lighting; 170px does not. Raising it is what
# fixed the collar. STRENGTH then applies only part of the
# correction, so a mis-estimated field can never swing a region
# far.
#
# Measured on good1.mp4: over a fixed always-inside patch of
# shirt the relight takes the frame-to-frame level spread from
# sd 1.37 to 1.13 (of 255) and the mean deviation from the set
# mean from 5.40 to 5.29. That is small, because most of what
# moves on this shirt is CLOTH — folds shifting as the body
# sways — not light, and no relight can touch that. Worth
# keeping as a cheap guard on a different clip, not worth
# making more aggressive: the aggressive version is exactly
# what ate the collar.
#
# The shirt is isolated by HSB saturation, not max-min:
# absolute saturation is low for dark skin too, so a max-min
# threshold ate the neck and beard. Plus a brightness floor,
# and a cutoff above the chin.
#
# Holes: the matte drops the shadowed crease where the collar
# meets the neck (mid-luma and desaturated like the backdrop,
# and it opens sideways into real background, so the build
# script's floodfill cannot call it interior). Those are filled
# here, from the frame's own local shirt tone. Fill geometry
# comes from a median across the sweep: a hole is a minority at
# any given pixel, so the median votes it out.
#
# Fields are estimated at FIELD_SCALE resolution with the sigma
# scaled to match. A field is low-frequency by construction, so
# this is the same field for a fraction of the work.
# ============================================================
set -euo pipefail

DIR="${DIR:-assets/veo-frames}"
OUT="${OUT:-$DIR}"
COUNT="${COUNT:-64}"
QUALITY="${QUALITY:-82}"
FIELD="${FIELD:-170}"        # illumination scale, px. Keep well above the
                             # collar's ~120px or the collar becomes "light".
STRENGTH="${STRENGTH:-80}"   # % of the relight to apply
FIELD_SCALE="${FIELD_SCALE:-25}" # % resolution the field is estimated at
SATMAX="${SATMAX:-18}"       # HSB saturation %, above this is skin
LUMAMIN="${LUMAMIN:-46}"     # luma %, below this is hair or deep shadow
CHIN_Y="${CHIN_Y:-515}"      # nothing above this row is shirt
CONSENSUS="${CONSENSUS:-70}" # median-alpha % that counts as body

command -v magick >/dev/null || { echo "error: ImageMagick 7 (magick) not installed" >&2; exit 1; }
[[ -f "$DIR/center.webp" ]] || { echo "error: no $DIR/center.webp — run build-hero-frames.sh first" >&2; exit 1; }
mkdir -p "$OUT"

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
W=$(identify -format %w "$DIR/center.webp")
H=$(identify -format %h "$DIR/center.webp")
FW=$((W * FIELD_SCALE / 100))
FH=$((H * FIELD_SCALE / 100))
FSIG=$(awk -v f="$FIELD" -v s="$FIELD_SCALE" 'BEGIN{printf "%.1f", f*s/100}')
echo "frames   : $DIR (${W}x${H})"
echo "field    : sigma ${FIELD}px, estimated at ${FW}x${FH} (sigma ${FSIG}), ${STRENGTH}% applied"

# The set, in the order everything below walks it: the live frames plus the
# resting frame, which has to be relit with them or it would not match the
# frame the scrubber hands over to.
SET=()
for ((i = 0; i < COUNT; i++)); do
  [[ -f "$DIR/frame_$i.webp" ]] && SET+=("frame_$i")
done
SET+=("center")
[[ ${#SET[@]} -gt 1 ]] || { echo "error: no frame_*.webp in $DIR" >&2; exit 1; }

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

# --- pass 1: shirt mask and illumination field per frame ----------------
# shirt = opaque AND desaturated AND bright AND below the chin
echo -n "  fields  "
for n in "${SET[@]}"; do
  F="$DIR/$n.webp"
  magick "$F" -alpha off -colorspace Gray "$T/L_$n.png"
  magick "$F" -alpha off -colorspace HSB -channel G -separate -negate \
         -threshold "$((100 - SATMAX))%" "$T/desat.png"
  magick "$T/L_$n.png" -threshold "${LUMAMIN}%" "$T/bright.png"
  magick "$F" -alpha extract -threshold 60% "$T/op_$n.png"
  magick "$T/desat.png" "$T/bright.png" -compose multiply -composite \
         "$T/op_$n.png" -compose multiply -composite \
         "$T/vgate.png"  -compose multiply -composite \
         -morphology Open Disk:3 -morphology Close Disk:6 "$T/m_$n.png"

  # field from shirt pixels only: blur(L*M)/blur(M), so skin and hair next
  # to the collar cannot drag the field down. Estimated small, see header.
  magick "$T/L_$n.png" "$T/m_$n.png" -compose multiply -composite \
         -resize "${FW}x${FH}!" -blur "0x$FSIG" "$T/num.png"
  magick "$T/m_$n.png" -resize "${FW}x${FH}!" -blur "0x$FSIG" "$T/den.png"
  # Denominator floor: where almost no shirt is in range the ratio is noise,
  # and dividing by ~0 would hand back a field of pure white.
  magick "$T/num.png" \( "$T/den.png" -evaluate max 8% \) \
         -compose divide -composite "$T/f_$n.png"
  printf '.'
done
echo

# --- the set's mean illumination: what every frame is relit TO ----------
magick "$T"/f_frame_*.png -evaluate-sequence mean "$T/fref.png"
magick "$T/fref.png" -resize "${W}x${H}!" "$T/ref.png"

clean_one() {
  local n="$1" O="$2"
  magick "$DIR/$n.webp" -alpha off "$T/rgb.png"
  magick "$T/f_$n.png" -resize "${W}x${H}!" "$T/fi.png"
  magick "$T/m_$n.png" -blur 0x5 "$T/msoft.png"

  # out = rgb * ref / fi. Halved before the divide and doubled after, so the
  # intermediate cannot run past white and clip where a frame needs lifting.
  magick "$T/rgb.png" "$T/ref.png" -compose multiply -composite \
         -evaluate multiply 0.5 "$T/t1.png"
  magick "$T/t1.png" "$T/fi.png" -compose divide -composite \
         -evaluate multiply 2 "$T/relit.png"
  magick "$T/rgb.png" "$T/relit.png" \
         -compose blend -define compose:args="${STRENGTH},$((100 - STRENGTH))" \
         -composite "$T/mix.png"
  magick "$T/rgb.png" "$T/mix.png" "$T/msoft.png" -composite "$T/merged.png"

  # --- fill matte holes with the shirt's own local tone -----------------
  # parens matter: a bare -negate here applies to every image in the list,
  # which inverts body too and makes "hole" the whole background.
  # Open drops specks; Dilate then swallows the hole's own feathered rim —
  # without it the rim keeps its grey RGB at partial alpha and shows as a
  # thin orange hairline once the inside is filled.
  magick "$T/body.png" \( "$T/op_$n.png" -negate \) -compose multiply -composite \
         -morphology Open Disk:2 -morphology Dilate Disk:5 "$T/hole.png"
  magick "$T/merged.png" "$T/m_$n.png" -compose multiply -composite -blur 0x30 "$T/fnum.png"
  magick "$T/m_$n.png" -blur 0x30 -evaluate max 8% "$T/fden.png"
  magick "$T/fnum.png" "$T/fden.png" -compose divide -composite "$T/fill.png"
  magick "$T/hole.png" -blur 0x2 "$T/paste.png"
  magick "$T/merged.png" "$T/fill.png" "$T/paste.png" -composite "$T/final.png"
  magick "$DIR/$n.webp" -alpha extract \( "$T/hole.png" -blur 0x1.5 \) \
         -compose lighten -composite "$T/a2.png"

  magick "$T/final.png" "$T/a2.png" -alpha off -compose CopyOpacity -composite \
         -quality "$QUALITY" -define webp:method=6 "$O"
}

i=0
for n in "${SET[@]}"; do
  clean_one "$n" "$T/o.webp"
  mv "$T/o.webp" "$OUT/$n.webp"
  i=$((i + 1))
  printf '\r  cleaned %d/%d' "$i" "${#SET[@]}"
done
echo

echo "done     : $OUT  ($(du -sh "$OUT" | cut -f1))"
echo
echo "Bump REV in hero-frames.js, then refresh."
