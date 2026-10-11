# Generating the hero head-turn clip

The hero can play a short clip of you turning your head, scrubbed frame by
frame against cursor position. I can't generate video — you generate the
clip, I turn it into frames.

## 1. Generate the clip

Use Veo (or any image-to-video model) with **`assets/saravana-portrait.jpeg`**
as the input image.

The hero maps the pointer's **angle around the face** to a frame, so the
clip needs to cover a full circle of gaze directions — not just left and
right. The head should roll once around the compass.

**Prompt:**

> A young man with a short dark beard slowly rolls his gaze in one smooth
> continuous circle: first to his far right, then down, then to his far
> left, then up, and finally back to centre looking at the camera. He turns
> only his head; his shoulders stay still and square to camera throughout.
> Neutral confident expression, mouth closed, eyes following the direction
> of the turn. Static locked-off camera, no zoom, no push in. Plain evenly
> lit studio background. Photorealistic, sharp focus, no motion blur.

**Settings:**

| Setting | Value | Why |
|---|---|---|
| Duration | 10 seconds | room for a full circle plus a centre hold |
| Aspect | 16:9 is fine | a portrait crop gets taken out of the middle |
| Motion | low / minimal | camera must not drift |

**What matters most:**

- **One continuous circle, one direction.** Right → down → left → up, and
  don't double back. The build maps frame index to angle, so a reversal
  reads as the head snapping the wrong way.
- **Shoulders locked.** Only the head moves. Body sway makes the silhouette
  jitter between frames.
- **Camera locked.** A drifting or breathing camera is the most common
  failure — the whole frame slides as you move the cursor.
- **Don't sweat the background colour.** Earlier drafts of this file asked
  for flat burnt orange to match the hero. That turned out not to matter:
  `MATTE=1` cuts the subject out properly, so a normal studio-gray backdrop
  works fine. What *does* hurt is a backdrop that's close to skin tone or
  heavily vignetted.
- **Eyes open, minimal blinking.** Blinks have to be routed around by hand
  when picking frames.

If the head turns so far it distorts at the extremes, trim the clip before
running the extractor — a smaller sweep that holds up beats a wide one that
warps.

## 2. Build the frames

The simplest form drops the file in the project root and runs:

```bash
./tools/build-hero-frames.sh my-veo-clip.mp4
```

That writes `assets/frames/frame_0.webp` … `frame_63.webp` plus
`center.webp`, sampling evenly across the clip and leaving the background
alone. In practice a real clip needs the crop, matte and frame-selection
flags below.

### The clip this project currently ships

`good3.mp4` is now the active source for the cursor-driven hero. Build the
transparent 4:3 frames with the checked-in selection, crop, and green key:

```bash
bash tools/build-good3-hero.sh
```

The build crops to `960x720` at `x=160`, keys the green screen, and clears
the upper-right cursor cue while preserving the shoulders. The 64 views
follow good3's counter-clockwise direction order, and the pointer angle is
mapped to match; `center.webp` uses the neutral opening pose. The hero draws
the frames directly, so the old white-shirt cleanup
pass is not part of this build.

The source moves unevenly, so the builder assigns source intervals to each
pointer sector by eye instead of sampling the whole clip in timeline order.
The pointer's face anchor is also lower for good3, where the eyes sit about
43% down the crop.

### Earlier good1 frame set

`good1.mp4` — 1280×720, 10s, a full 360° sweep (right → down → left → up).
This is the command that produced `assets/veo-frames/`, which is what the
hero reads:

```bash
SEL="40,43,47,50,54,57,61,64,68,71,74,78,81,84,88,91,\
95,98,101,104,107,110,113,116,120,123,126,129,132,135,138,141,\
145,148,151,154,157,160,163,166,170,173,176,179,182,185,188,191,\
195,197,199,201,203,205,208,210,212,214,215,216,217,218,34,37"

COUNT=64 WIDTH=1000 QUALITY=88 OUT=assets/veo-frames \
  CROP=960:720:170:0 MATTE=1 SELECT="$SEL" CENTER_SRC=5 \
  ./tools/build-hero-frames.sh good1.mp4

QUALITY=88 ./tools/clean-hero-shirt.sh
```

The second pass is not optional — see "Evening out the shirt" below. Both
passes encode, so the frames go through WebP twice; q88 is chosen so the
second generation still holds the collar's fold line, which is the first
thing to go soft. q74 visibly mushed it.

The crop is wide (960 of the 1280 source) because the shoulders span
roughly x=200–1100 in frame. A narrower crop slices them off and the hero
shows a bust with two hard vertical cuts down the sides. The result is a
4:3 frame, not a portrait one — `.hero-frames` in `styles.css` is sized to
suit that, so changing the crop aspect means revisiting it.

Two things there are worth understanding before you regenerate from a new
clip.

**Why `SELECT` instead of even sampling.** Output frame index maps to
*pointer angle*, so frame 0 must be looking right, 16 down, 32 left, 48 up.
Even sampling only lands on those if the head sweeps at a perfectly
constant rate — `good1.mp4` doesn't, and it opens on a few seconds of
resting center. The compass frames were found by eye:

| Direction | Source frame |
|---|---|
| right | 40 |
| down-right | 68 |
| down | 95 |
| down-left | 120 |
| left | 145 |
| up-left | 170 |
| up | 195 |
| up-right | 212 |

`SELECT` then walks 8 frames per octave between them. The last octave is
the awkward one: the clip returns to center rather than closing the circle,
and blinks while doing it (frames 219–223), so it ends `...217,218,34,37` —
borrowing from the opening turn to get back to "right". Expect one slightly
quicker transition as the cursor crosses the upper-right diagonal.

**Why `MATTE` and not a color key.** Measured off this clip: backdrop sits
at luma 117–165 / saturation 8–13, skin at saturation 40–70, hair at luma
~17, shirt at luma ~234. Nothing separates those with a single color, so
`MATTE` keeps a pixel when it's *saturated* (skin), *dark* (hair) or
*bright* (shirt), then fills interior holes by topology.

### Choosing a background removal mode

- **`KEY_COLOR=0xrrggbb`** — plain color key. Only works on a genuinely
  flat, even background. Tune with `KEY_SIMILARITY` / `KEY_BLEND`.
- **`FEATHER=1`** — soft-edged oval cut at fixed coordinates, ignoring
  colour. A blunt fallback for when the subject can't be separated at all;
  leaves a visible haze of background around the head.
- **`MATTE=1`** — the real cutout, and the right default for a studio-gray
  Veo backdrop. Thresholds: `MATTE_SAT_LO/HI`, `MATTE_DARK_LO/HI`,
  `MATTE_BRIGHT_LO/HI`.

Precedence is `MATTE` > `FEATHER` > `KEY_COLOR`.

**How the holes get filled.** This is the part that took the longest to get
right, so don't "simplify" it away. Eye sclera and shadowed shirt creases
are mid-luma and desaturated — i.e. *the same colour as the backdrop*. No
threshold can keep them, and tuning one to try just drags background back
in. Get it wrong and the eyes go transparent and glow orange through the
face.

What separates them isn't colour, it's topology: real background touches
the frame edge, an interior hole doesn't. So the mask is hardened to pure
black/white and `floodfill` runs inward from the two top corners; anything
the flood never reached is subject, whatever colour it happened to be.
That fills the eyes, the collar shadows and the gaps between hair strands
in one go, at any hole size.

Consequences worth knowing:

- **Seeds must land on background.** Top corners always do. Both are
  seeded, because hair touching the top edge splits the background into
  two disconnected regions and a single seed would only flood one of them.
- **A silhouette that touches the top edge breaks it.** If a future clip
  frames tighter, re-check — the fix is to pad the frame before keying.
- **`MATTE_DESPECKLE`** (default 3) removes isolated specks before the
  flood, so a stray lit pixel out in the background doesn't survive as
  confetti. **`MATTE_EDGE`** (default 2) softens the final edge.

An earlier version closed holes with a large blur-and-re-threshold instead,
which needed the radius to exceed half the widest hole and still couldn't
reach the shirt creases. `floodfill` replaced it and is size-independent.

If you regenerate from a different clip, re-measure before trusting any of
these. A quick way to sample a pixel:

```bash
ffmpeg -i clip.mp4 -vf "select=eq(n\,95),crop=1:1:640:300" \
  -f rawvideo -pix_fmt rgb24 -frames:v 1 - | xxd -p
```

Tuning, if the payload is too heavy:

```bash
COUNT=48 WIDTH=800 QUALITY=65 ./tools/build-hero-frames.sh my-veo-clip.mp4
```

Expect roughly **2–4 MB** total for 64 frames at 900px. For reference, the
site you pointed me at ships 64 frames at 1920×1080 for about 6 MB.

If you change `COUNT`, update `COUNT` at the top of `hero-frames.js` to match.
Also bump `REV` there whenever you rebuild: the filenames never change, so
a rebuilt set is otherwise served from cache forever.

### Evening out the shirt

`tools/clean-hero-shirt.sh` runs over the finished frame set and does two
things the build pass can't.

**Relights each frame to the set's mean illumination.** The head turn drags
a cast shadow across the shirt, so scrubbing makes the shoulders brighten
and darken — on a still that's ordinary shading, but sliding under the
pointer it reads as grime moving around the shirt. Each frame's broad
illumination field is divided out and the set's mean put back, so every
frame is lit alike while keeping the shading of a real photograph.

The trap here, and the reason the script carries a long comment: an earlier
version divided the field out and multiplied a *constant* back in. That is
flat-fielding, and it erases everything above the field scale — including
the collar, which at this frame size is a ~120px object. Both wings
levelled to the chest's tone, the fold line went, and each wing's cast
shadow was left sitting on a flat shirt as a bare grey triangle. Keep
`FIELD` (170px) well above the collar's size, and relight to the mean
rather than to a constant.

**Fills the matte's collar bites.** Where the collar meets the neck there's
a shadowed crease that is mid-luma and desaturated like the backdrop, and
it opens sideways into real background, so the build pass's floodfill can't
call it interior. Roughly half the frames lose a bite of collar there. The
geometry comes from a median across the sweep — a hole is a minority at any
given pixel — eroded so a fill can never reach the outer silhouette, and
dilated past the hole's own feathered rim, without which the rim keeps its
grey RGB at partial alpha and shows as an orange hairline.

## 3. Fallback behaviour

Nothing breaks if you never generate the clip. `hero-frames.js` probes for
`center.webp`, and if it isn't there it does nothing — the depth-parallax
hero stays in charge. The order of preference is:

1. **Frames** — real head rotation, if the configured frame directory exists
2. **Depth parallax** — WebGL 2.5D, if WebGL and a fine pointer are available
3. **Static cutout** — the plain `<img>`, everywhere else

Reduced-motion users always get the static cutout.
