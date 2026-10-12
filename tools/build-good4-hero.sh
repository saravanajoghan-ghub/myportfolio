#!/usr/bin/env bash
# Build a smooth cursor-facing hero sweep from good4.mp4.
set -euo pipefail

SRC="${1:-good4.mp4}"
OUT="${OUT:-assets/veo-frames}"

# Cursor order is clockwise: right, down-right, down, down-left, left,
# up-left, up, up-right, then back to right. good4 follows that order in time.
# The final sector runs through the clip's neutral return and loops back into
# the opening right-facing pose, keeping the 360-degree seam soft.
read -r SELECT_FRAMES CENTER_FRAME <<< "$(awk 'BEGIN {
  start[0]=42;  end[0]=60;  # right -> down-right
  start[1]=60;  end[1]=90;  # down-right -> down
  start[2]=90;  end[2]=112; # down -> down-left
  start[3]=112; end[3]=144; # down-left -> left
  start[4]=144; end[4]=165; # left -> up-left
  start[5]=165; end[5]=198; # up-left -> up
  start[6]=198; end[6]=210; # up -> up-right
  start[7]=210; end[7]=282; # up-right -> neutral -> right across loop
  for (sector=0; sector<8; sector++) {
    for (i=0; i<8; i++) {
      frame=start[sector]+int((end[sector]-start[sector])*i/8+0.5);
      frame=((frame%240)+240)%240;
      printf "%s%d", (sector || i) ? "," : "", frame;
    }
  }
  printf " %d\n", 0; # opening neutral frame
}')"

# Hero frames are displayed larger than their 960px source width on desktop;
# use a high WebP quality to retain facial detail during that enlargement.
COUNT=64 WIDTH=960 QUALITY=96 OUT="$OUT" \
  CROP=960:720:160:0 \
  UNSHARP=5:5:0.6:3:3:0.2 \
  KEY_COLOR=0x498f58 KEY_MODE=rgb \
  KEY_SIMILARITY=0.10 KEY_BLEND=0.04 \
  DESPILL_RGB=1 \
  SELECT="$SELECT_FRAMES" CENTER_SRC="$CENTER_FRAME" \
  "$(dirname "$0")/build-hero-frames.sh" "$SRC"

echo "Built good4 direction views in $OUT."
