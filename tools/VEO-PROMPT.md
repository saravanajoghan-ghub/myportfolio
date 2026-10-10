# Generating the hero head-turn clip

The hero can play a short clip of you turning your head, scrubbed frame by
frame against cursor position. I can't generate video — you generate the
clip, I turn it into frames.

## 1. Generate the clip

Use Veo (or any image-to-video model) with **`assets/saravana-portrait.jpeg`**
as the input image.

**Prompt:**

> A young man with a short dark beard looks slowly from his far left to his
> far right, turning only his head in one smooth continuous motion. His
> shoulders stay still and square to camera. Neutral confident expression,
> mouth closed, eyes following the direction of the turn. Static locked-off
> camera, no zoom, no push in. Flat solid burnt-orange background, evenly
> lit, no shadows cast on the background. Soft even key light on the face.
> Photorealistic, sharp focus, no motion blur.

**Settings:**

| Setting | Value | Why |
|---|---|---|
| Duration | 8 seconds | 64 frames at a usable sampling rate |
| Aspect | 3:4 portrait (or 9:16) | matches the hero column |
| Motion | low / minimal | camera must not drift |
| Background | `#C84C2B` burnt orange | matches the hero gradient |

**What matters most:**

- **One single sweep.** Left → right, once. If the head turns back partway
  through, the cursor mapping reverses and it reads as a glitch.
- **Shoulders locked.** Only the head moves. Any body sway makes the
  silhouette jitter between frames.
- **Camera locked.** A drifting or breathing camera is the most common
  failure — the whole frame slides as you move the cursor.
- **Flat background.** No gradient, no vignette, no cast shadow. The frames
  sit on the hero's orange field, so a flat matching background makes the
  seam invisible.

If the result turns too far and distorts the face at the extremes, trim the
clip before running the extractor — a 30° sweep that holds up beats a 90°
one that warps.

## 2. Build the frames

Drop the file in the project root and run:

```bash
./tools/build-hero-frames.sh my-veo-clip.mp4
```

That writes `assets/frames/frame_0.webp` … `frame_63.webp` plus
`center.webp`, and the hero picks them up on the next refresh — no code
change needed.

Tuning, if the payload is too heavy:

```bash
COUNT=48 WIDTH=800 QUALITY=65 ./tools/build-hero-frames.sh my-veo-clip.mp4
```

Expect roughly **2–4 MB** total for 64 frames at 900px. For reference, the
site you pointed me at ships 64 frames at 1920×1080 for about 6 MB.

If you change `COUNT`, update `COUNT` at the top of `hero-frames.js` to match.

## 3. Fallback behaviour

Nothing breaks if you never generate the clip. `hero-frames.js` probes for
`center.webp`, and if it isn't there it does nothing — the depth-parallax
hero stays in charge. The order of preference is:

1. **Frames** — real head rotation, if `assets/frames/` exists
2. **Depth parallax** — WebGL 2.5D, if WebGL and a fine pointer are available
3. **Static cutout** — the plain `<img>`, everywhere else

Reduced-motion users always get the static cutout.
