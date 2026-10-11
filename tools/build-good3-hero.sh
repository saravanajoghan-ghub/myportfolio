#!/usr/bin/env bash
# Build the interactive hero views from good3.mp4.
#
# The source's last few seconds use a direction cue at the upper-right of
# the frame. ERASE removes that cue after chroma keying; the crop retains the
# full shoulders. Each sector uses a short, stable source interval so the
# pointer-facing views stay in compass order.
set -euo pipefail

SRC="${1:-good3.mp4}"
OUT="${OUT:-assets/veo-frames}"

command -v awk >/dev/null || { echo "error: awk not installed" >&2; exit 1; }

# good3's selected views run counter-clockwise: right, up, left, down.
# The page flips the vertical pointer angle to match that order. The samples
# span each turn so neighboring frames blend through real in-between poses.
# Source is 24 fps; each pair is the inclusive start/end frame.
read -r SELECT_FRAMES CENTER_FRAME <<< "$(awk 'BEGIN {
  start[0]=312; end[0]=330; # right -> up-right
  start[1]=330; end[1]=348; # up-right -> up
  start[2]=348; end[2]=366; # up -> up-left
  start[3]=366; end[3]=384; # up-left -> left
  start[4]=384; end[4]=402; # left -> down-left
  start[5]=96;  end[5]=102; # down-left, eyes open and glancing left
  start[6]=88;  end[6]=96;  # downward gaze before the left glance
  start[7]=58;  end[7]=66;  # rightward gaze before the blink/dip
  for (sector=0; sector<8; sector++) {
    for (i=0; i<8; i++) {
      frame=start[sector]+int((end[sector]-start[sector])*i/7+0.5);
      printf "%s%d", (sector || i) ? "," : "", frame;
    }
  }
  printf " %d\n", 8; # center, neutral at 0.33s
}')"

COUNT=64 WIDTH=960 QUALITY=88 OUT="$OUT" \
  CROP=960:720:160:0 ERASE=760:0:200:360 \
  KEY_COLOR=0x3da76b KEY_MODE=chroma \
  KEY_SIMILARITY=0.07 KEY_BLEND=0.04 \
  SELECT="$SELECT_FRAMES" CENTER_SRC="$CENTER_FRAME" \
  "$(dirname "$0")/build-hero-frames.sh" "$SRC"

echo "Built good3 direction views in $OUT."
