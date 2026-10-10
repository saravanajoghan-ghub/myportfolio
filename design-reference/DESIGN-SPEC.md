# Design Reference — "Personal Portfolio Framer Website"

Source: https://www.behance.net/gallery/255990499/Personal-Portfolio-Framer-Website
Authors: Sk Nahid Hasan, Sk Mehedi Hasan, UIX Masum (+1) · Published 2026-09-20
Tools listed by the authors: Figma, Framer, Webflow

**This is third-party reference material for layout/structure only.** The photography,
mock logos ("Logoipsum"), and copy belong to the original authors — replace all of it with
your own face, your own projects, and your own text. Also replace the persona name
"Michael" everywhere.

---

## 1. Style tokens (taken from frame `05-typography-and-colors.jpg`, verified by pixel sampling)

### Color
| Role | Hex | Notes |
|---|---|---|
| Theme / accent orange | `#F63E04` | Buttons, asterisk bullets, arrows, star ratings, link arrows |
| Black | `#0A0A0A` | Headings, dark cards, footer bar, primary buttons |
| Grey (secondary text) | `#686868` | Second half of two-tone headlines, body copy |
| White | `#FFFFFF` | Cards |
| Page background | `#F7F7F7` | Off-white body background behind all sections |
| Warm cream (deck bg) | `#F8EDE9` | Used on the Behance case-study boards, optional on site |

Hero gradient sampled from the live screens: deep burnt orange `#B04728` → bright
`#DF532E`, with the subject photo multiplied/duotoned into it.

> Note: the original board mislabels the grey swatch as `Black Defoliate #F63E04`.
> That is a typo in the source deck — the actual swatch is neutral grey `#686868`.

### Type
- Typeface: **Sora** or **Geist** (board reads "Sora/Geist"). Both are free on Google Fonts / Vercel.
- Weights used: **Regular (400), Medium (500), Semi Bold (600)**. No thin, no black.
- Display headlines are set in **ALL CAPS**, semi-bold, very tight tracking (≈ -0.02em)
  and tight leading (≈ 0.95–1.0).
- Signature headline treatment: **two-tone** — first phrase in `#0A0A0A`, trailing phrase
  in `#686868`, e.g. "MY IMPACT THROUGH **USER EXPERIENCE**", "POWERFUL DESIGN **SERVICES
  FOR YOUR BRAND**", "FOCUSED ON DESIGN **THAT DELIVERS RESULTS**".
- Body copy: Regular, ~14–15px, `#686868`, generous line-height (~1.6).
- Small labels / eyebrows: ALL CAPS, ~11–12px, with an orange asterisk `✳` glyph prefix,
  sitting in a light grey pill (`#EFEFEF`, fully rounded, ~6px 12px padding).

### Grid (from frame `07-grid-system.jpg`)
- Frame width: **1600px**
- Side margin: **152px**
- Column width: **86px**
- Gutter: **24px**
- → 12 columns (12 × 86 + 11 × 24 = 1296px content area inside the 1600px frame).

### Recurring component details
- Card radius ~8–12px; the hero media card and contact block use ~20–24px.
- Cards are white on `#F7F7F7` with a hairline border, almost no shadow.
- Project/work cards: image on top, then a light grey caption bar split left/right —
  `✳ PROJECTNAME` on the left, `/Category` on the right.
- Buttons: full-black or full-white pill-less rectangles with a **square orange tile on the
  right holding a ↗ arrow** (see "VIEW ALL PROJECTS", "GET STARTED NOW").
- Faint `+` crosshair marks and thin guide lines are drawn over the hero and some
  sections as a deliberate "design grid" motif.

---

## 2. Page structure, in scroll order

Each item maps to a file in `full-page-sections/`.

1. **Nav + Hero** — `01-hero-nav-trustedby.jpg`
   - Sticky top bar inside the orange block: wordmark `Portfolioa®` left; centre links
     Hemo / About / Work `(12)` / Services `(08)` / Contact with superscript counts;
     hamburger right.
   - Full-bleed orange hero with the subject's photo cut out over a giant ghosted
     repetition of the name. `©2026` small above a huge white ALL-CAPS first name.
   - Left: 3-line ALL-CAPS tagline. Right: floating white "featured work" card
     (image + `✳ ZENTIX  /Web Design` caption).
   - Bottom right: black "Let's Talk" card — avatar, name, role, orange-less ↗ button.
2. **Trusted by** — logo strip, label "TRUSTED BY / LEADING BRANDS" at left, 5 greyscale logos.
3. **Impact / About** — eyebrow pill "✳ BETTER DIGITAL JOURNEYS.", two-tone headline
   "MY IMPACT THROUGH USER EXPERIENCE", large asterisk ornament, portrait tile,
   intro paragraph, and two stat cards (`37+` Projects Completed, `72+` Happy Clients).
4. **Services** — `02-impact-stats-services.jpg`, `03-...`
   - Eyebrow "✳ OUR SERVICES" + two-tone headline.
   - Four rows, each a hairline-separated band: `✳ /001` index · title · description ·
     a wrapped set of grey tag chips · a 16:10 image at right with a tiny control strip.
   - Rows: UI/UX Design, Mobile App Design, Product Design, Motion Graphics.
5. **Portfolio** — `03-`, `04-`
   - Eyebrow "✳ PORTFOLIO" + "OUR PROJECTS." two-tone.
   - Deliberately **staggered/asymmetric** grid — cards of different heights and widths
     offset vertically, one full-width banner card. Caption bar under each.
   - Ends with the "VIEW ALL PROJECTS ↗" button (orange left edge bar + orange arrow tile).
6. **Design process** — `04-`, `05-`
   - Centred eyebrow + centred two-tone headline "DESIGN PROCESS THAT WORKS".
   - Four **black cards staggered in a descending/alternating stair pattern**, each with an
     orange geometric glyph (4-point star, asterisk, plus, cross), title, description:
     Prototyping, Wire Framing, UI Design, Improvement.
7. **Why choose me** — `05-`
   - Eyebrow "✳ WHY CHOOSE ME" at far left, big two-tone headline.
   - Mixed bento row: two stacked white stat cards (`7+` Design Experience, `98%` Client
     Satisfaction) · a tall testimonial card with stacked avatars, "1.2k+ Happy Clients",
     orange ★★★★★ + 4.9/5, quote, author · a gradient portrait card with role caption ·
     a small "Fast & Reliable" card with an orange lightning bolt.
8. **Video** — `06-` — wide rounded media block, centred white circular ▶ with
   "Watch My Work" beneath, `©2026 <Name>` bottom-centre.
9. **Testimonials** — `06-` — eyebrow "✳ DESIGNS CLIENTS LOVE", two-tone headline left,
   small paragraph right. Below, a **horizontally scrolling marquee of vertically offset
   testimonial cards** that bleed off both edges (avatar+name+role header, orange stars,
   `+` expander, quote).
10. **Pricing** — `07-` — eyebrow "✳ PRICING", headline, and a **MONTHLY / PROJECT BASED
    toggle** (grey track, black active pill) right-aligned. Two black panels: left
    "COMPLETE PACKAGE" with a Delivery Time / Revisions / File Format spec list; right
    "ONE-TIME PAYMENT" with `$2,490 /Project`, a bulleted feature list with orange ↗
    bullets, a satisfaction-guarantee note, and a white "GET STARTED NOW" button with the
    orange arrow tile.
11. **Blog / Insights** — `07-`, `08-` — eyebrow "✳ DESIGN INSIGHTS", two-tone headline,
    paragraph right. One large featured post card (image with "INSIGHTS" chip, date and
    title over a dark gradient foot) plus two small image cards and two text-only
    post entries with dates.
12. **Contact** — `08-` — full-width rounded photographic block (vivid teal/red gradient
    portrait). Left: white card titled "Reach Out to Me" with a dark photo header strip
    and Full Name* / E-mail* / Message* fields and a black submit button. Right: eyebrow
    "✳ CONTACT ME", huge white "LET'S CREATE TOGETHER", orange 4-point star, and a
    "RESULTS-DRIVEN SOLUTIONS" blurb.
13. **Footer** — `08-` — mission sentence with one phrase bolded, phone, underlined email;
    right-side white Newsletter card (email input + black button). Below, two "Navigation"
    link columns (second one is socials with ↗), and a **giant `Name ®` wordmark** at right.
    Closing full-width black bar: "© 2026 <Name>. All rights reserved."

---

## 3. Case-study boards (in `frames/`)

These are the Behance presentation boards, not website screens — useful for the style
system, not for layout:

- `01-cover-overview.png` — project cover
- `02-about-the-project.jpg` — brief, industry/year/location/services meta block
- `03-design-process-timeline.jpg` — Discovery / Design / Delivery timeline
- `04-framer-canvas-responsive.png` — the Framer canvas showing **Desktop / Tablet / Phone**
  breakpoints side by side, plus the full layer/section list
- `05-typography-and-colors.jpg` — **the type + color spec, source of §1**
- `06-ux-research-persona.jpg` — user persona board
- `07-grid-system.jpg` — **the grid spec, source of §1**
- `08-problem-and-solution.jpg` — problem/solution board (content is from a different
  project, "Paywell" — ignore it)

The layer list in `04` confirms the section order: Header, Hero Section, Service Section,
About Section, Destination Section, Choose Us Section, Tool Plan Section, Blog Section,
Testimonial Section, Subscribe Section, Footer Section.

---

## 4. Notes for building

- Mobile and tablet breakpoints exist in `04-framer-canvas-responsive.png` but are too
  small to read precisely. The phone layout visibly collapses everything to a single
  column and keeps the hero portrait full-bleed — safe to design mobile from first
  principles rather than trying to trace it.
- The hero is the piece that carries the whole design: a hard-edged cutout portrait on a
  saturated orange field, oversized ghost type behind the subject, and small floating
  cards at the corners. Your photo needs a clean background removal for this to work.
- Nothing here needs JS beyond: sticky nav, the pricing toggle, the testimonial marquee,
  the mobile menu, and scroll-reveal animations.
