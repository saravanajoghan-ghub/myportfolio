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
OUT="${OUT:-assets/frames}"
CROP="${CROP:-}"
ERASE="${ERASE:-}"          # transparent x:y:w:h region after keying
KEY_COLOR="${KEY_COLOR:-}"
KEY_MODE="${KEY_MODE:-rgb}"          # rgb colorkey or yuv chromakey
KEY_SIMILARITY="${KEY_SIMILARITY:-0.05}"
KEY_BLEND="${KEY_BLEND:-0.03}"
DESPILL="${DESPILL:-0.8}"             # green spill removal for chromakey
DESPILL_EXPAND="${DESPILL_EXPAND:-0.12}"
DESPILL_RGB="${DESPILL_RGB:-0}"       # also despill after an RGB colorkey
# FEATHER: alternative to KEY_COLOR for clips whose background isn't flat
# enough to color-key cleanly (textured, vignetted, or close in hue to
# skin). Instead of keying by color, it cuts a soft-edged oval alpha
# matte at fixed screen coordinates — same look regardless of background.
FEATHER="${FEATHER:-}"
FEATHER_CX="${FEATHER_CX:-0.5}"   # oval center, fraction of width/height
FEATHER_CY="${FEATHER_CY:-0.45}"
FEATHER_RX="${FEATHER_RX:-0.56}"  # oval radius, fraction of width/height
FEATHER_RY="${FEATHER_RY:-0.56}"
FEATHER_INNER="${FEATHER_INNER:-0.45}"  # fully opaque inside this radius
FEATHER_OUTER="${FEATHER_OUTER:-1.05}"  # fully transparent past this radius
# MATTE: proper cutout. Keeps a pixel when it is saturated (skin), dark
# (hair), or bright (a white shirt) — a studio-gray backdrop is none of
# those. Thresholds are in 0-255; measure the actual clip before changing
# them (see tools/VEO-PROMPT.md for a one-liner that samples a pixel).
MATTE="${MATTE:-}"
MATTE_SAT_LO="${MATTE_SAT_LO:-16}"       # below this saturation -> background
MATTE_SAT_HI="${MATTE_SAT_HI:-30}"       # above -> solid subject
MATTE_DARK_HI="${MATTE_DARK_HI:-105}"    # below this luma -> subject (hair)
MATTE_DARK_LO="${MATTE_DARK_LO:-60}"
MATTE_BRIGHT_LO="${MATTE_BRIGHT_LO:-180}" # above this luma -> subject (shirt)
MATTE_BRIGHT_HI="${MATTE_BRIGHT_HI:-205}"
MATTE_DESPECKLE="${MATTE_DESPECKLE:-3}"  # drops isolated mask specks, px
MATTE_EDGE="${MATTE_EDGE:-2}"            # final edge softening, px
# SELECT: explicit comma-separated list of source frame numbers, in output
# order. Use instead of even sampling when the clip's head turn isn't
# uniformly paced — frame index maps to pointer ANGLE, so an even sample of
# an unevenly-paced sweep points the head the wrong way. The list may
# revisit or jump backwards (handy for closing a loop the clip doesn't).
SELECT="${SELECT:-}"
# CENTER_SRC: source frame number for center.webp (the resting, look-at-camera
# pose). Defaults to the middle of the output set.
CENTER_SRC="${CENTER_SRC:-}"

if [[ -z "$SRC" ]]; then
  echo "usage: $0 <clip.mp4>   (env: COUNT=$COUNT WIDTH=$WIDTH QUALITY=$QUALITY OUT=$OUT CROP=$CROP KEY_COLOR=$KEY_COLOR FEATHER=$FEATHER)" >&2
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

echo "source   : $SRC"
echo "duration : ${DUR}s"
[[ -n "$CROP" ]] && echo "crop     : $CROP"
[[ -n "$ERASE" ]] && echo "erase    : transparent region $ERASE"
[[ -n "$KEY_COLOR" ]] && echo "key      : $KEY_COLOR"
[[ -n "$FEATHER" ]] && echo "feather  : oval matte, no color key"
[[ -n "$MATTE" ]] && echo "matte    : sat/luma cutout + floodfill hole fill"

mkdir -p "$OUT"

# --- build the shared filter chain -------------------------------------
# In SELECT mode every source frame is decoded and picked from afterwards;
# otherwise an fps filter samples COUNT frames evenly across the clip.
if [[ -n "$SELECT" ]]; then
  PRE=""
else
  # (awk rather than bc — bc isn't installed everywhere)
  FPS=$(awk -v c="$COUNT" -v d="$DUR" 'BEGIN{printf "%.6f", c/d}')
  echo "sampling : $COUNT frames @ ${FPS} fps -> ${WIDTH}px wide webp q$QUALITY"
  PRE="fps=${FPS},"
fi
if [[ -n "$CROP" ]]; then
  PRE+="crop=${CROP},"
fi
if [[ -z "$FEATHER" && -z "$MATTE" && -n "$KEY_COLOR" ]]; then
  if [[ "$KEY_MODE" == "chroma" ]]; then
    PRE+="chromakey=${KEY_COLOR}:${KEY_SIMILARITY}:${KEY_BLEND},despill=type=green:mix=${DESPILL}:expand=${DESPILL_EXPAND},"
  else
    PRE+="colorkey=${KEY_COLOR}:${KEY_SIMILARITY}:${KEY_BLEND},"
    if [[ "$DESPILL_RGB" == "1" ]]; then
      PRE+="despill=type=green:mix=${DESPILL}:expand=${DESPILL_EXPAND},"
    fi
  fi
fi
PRE+="scale=${WIDTH}:-2:flags=lanczos"

if [[ -n "$MATTE" ]]; then
  R="r(X\,Y)"; G="g(X\,Y)"; B="b(X\,Y)"
  LUM="((${R}+${G}+${B})/3)"
  SAT="(max(max(${R}\,${G})\,${B})-min(min(${R}\,${G})\,${B}))"
  K_SAT="clip((${SAT}-${MATTE_SAT_LO})/(${MATTE_SAT_HI}-${MATTE_SAT_LO})\,0\,1)"
  K_DARK="clip((${MATTE_DARK_HI}-${LUM})/(${MATTE_DARK_HI}-${MATTE_DARK_LO})\,0\,1)"
  K_BRIGHT="clip((${LUM}-${MATTE_BRIGHT_LO})/(${MATTE_BRIGHT_HI}-${MATTE_BRIGHT_LO})\,0\,1)"
  KEYX="255*max(max(${K_SAT}\,${K_DARK})\,${K_BRIGHT})"
  HARD="lut=y='if(gt(val\,128)\,255\,0)'"
  # Interior holes are the hard part: eye sclera and shadowed shirt creases
  # are mid-luma and desaturated, i.e. the exact same colour as the backdrop,
  # so no threshold can keep them. What distinguishes them is topology —
  # real background touches the frame edge, holes don't. So flood the
  # background inward from the top corners and treat everything the flood
  # never reached as subject. Seeds must land on background: the top corners
  # always do, and both are seeded because hair touching the top edge splits
  # the background into two regions.
  FC="[0:v]${PRE},format=gbrp,split=2[fg][k];"
  FC+="[k]geq=r='${KEYX}':g='${KEYX}':b='${KEYX}',format=gray,"
  FC+="${HARD},boxblur=${MATTE_DESPECKLE}:1,${HARD},"
  FC+="floodfill=x=0:y=0:s0=0:d0=128,"
  FC+="floodfill=x=$((WIDTH - 1)):y=0:s0=0:d0=128,"
  FC+="lut=y='if(eq(val\,128)\,0\,255)',boxblur=${MATTE_EDGE}:1[a];"
  FC+="[fg][a]alphamerge[out]"
elif [[ -n "$FEATHER" ]]; then
  # Soft-edged oval alpha matte, computed per-pixel from frame geometry
  # (X/Y/W/H) rather than color — works on any background, including the
  # textured/vignetted ones that defeat colorkey because they overlap
  # skin tones in RGB space.
  DIST="hypot((X-W*${FEATHER_CX})/(W*${FEATHER_RX})\,(Y-H*${FEATHER_CY})/(H*${FEATHER_RY}))"
  MASK="if(lte(${DIST}\,${FEATHER_INNER})\,255\,if(gte(${DIST}\,${FEATHER_OUTER})\,0\,255*(1-(${DIST}-${FEATHER_INNER})/(${FEATHER_OUTER}-${FEATHER_INNER}))))"
  FC="[0:v]${PRE},format=rgba,split=2[fg][base];[base]geq=lum='${MASK}',format=gray[a];[fg][a]alphamerge[out]"
else
  FC="[0:v]${PRE},format=rgba[out]"
fi

# Some generated clips include a cursor cue outside the subject. Knock that
# rectangle out after keying so it doesn't appear in the portfolio while
# retaining the subject's shoulder beneath/alongside it.
if [[ -n "$ERASE" ]]; then
  IFS=: read -r EX EY EW EH <<< "$ERASE"
  [[ -n "$EX" && -n "$EY" && -n "$EW" && -n "$EH" ]] || {
    echo "error: ERASE must be x:y:w:h" >&2
    exit 1
  }
  FC="${FC/\[out\]/,drawbox=x=${EX}:y=${EY}:w=${EW}:h=${EH}:color=black@0:t=fill:replace=1[out]}"
fi

WEBP=(-c:v libwebp -quality "$QUALITY" -compression_level 6 -preset picture)

if [[ -n "$SELECT" ]]; then
  IFS=',' read -ra PICKS <<< "$SELECT"
  echo "select   : ${#PICKS[@]} explicit source frames -> ${WIDTH}px wide webp q$QUALITY"
  if [[ "${#PICKS[@]}" -ne "$COUNT" ]]; then
    echo "error: SELECT lists ${#PICKS[@]} frames but COUNT=$COUNT" >&2
    exit 1
  fi

  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT

  # Decode the whole clip through the filter chain once, to lossless PNG so
  # alpha survives, then pick from it. One decode pass beats 64 seeks.
  ffmpeg -loglevel error -y -i "$SRC" \
    -filter_complex "$FC" -map "[out]" \
    -f image2 -start_number 0 "$TMP/src_%d.png"

  # Order the picks as a fresh numbered sequence so a single encode pass
  # can read them with the image2 demuxer.
  i=0
  for n in "${PICKS[@]}"; do
    if [[ ! -f "$TMP/src_$n.png" ]]; then
      echo "error: SELECT references frame $n, which the clip does not have" >&2
      exit 1
    fi
    ln -s "$TMP/src_$n.png" "$TMP/ord_$i.png"
    i=$((i + 1))
  done

  ffmpeg -loglevel error -y -start_number 0 -i "$TMP/ord_%d.png" \
    "${WEBP[@]}" -f image2 -start_number 0 "$OUT/frame_%d.webp"

  CSRC="${CENTER_SRC:-${PICKS[$((COUNT / 2))]}}"
  if [[ ! -f "$TMP/src_$CSRC.png" ]]; then
    echo "error: CENTER_SRC=$CSRC is not a frame in the clip" >&2
    exit 1
  fi
  ffmpeg -loglevel error -y -i "$TMP/src_$CSRC.png" \
    "${WEBP[@]}" -frames:v 1 -update 1 "$OUT/center.webp"
  echo "center   : source frame $CSRC"
else
  # -f image2 is required: without it libwebp writes ONE animated .webp
  # instead of a numbered sequence
  ffmpeg -loglevel error -y -i "$SRC" \
    -filter_complex "$FC" -map "[out]" \
    -frames:v "$COUNT" \
    "${WEBP[@]}" -f image2 -start_number 0 "$OUT/frame_%d.webp"

  MID=$((COUNT / 2))
  if [[ ! -f "$OUT/frame_$MID.webp" ]]; then
    echo "error: extraction produced too few frames" >&2
    exit 1
  fi
  cp "$OUT/frame_$MID.webp" "$OUT/center.webp"
fi

GOT=$(find "$OUT" -name 'frame_*.webp' | wc -l)
TOTAL=$(du -sh "$OUT" | cut -f1)
echo "done     : $GOT frames + center.webp  ($TOTAL)"
[[ "$GOT" -lt "$COUNT" ]] && echo "warning  : expected $COUNT, got $GOT — clip may be shorter than assumed"
echo
echo "Refresh the page — the hero will pick these up automatically."
