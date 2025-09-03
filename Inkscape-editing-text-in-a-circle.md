# Inkscape: Editing Text in a Circle (using this project’s SVG)

This guide shows how to position and style text along a circular path in Inkscape, keep it bottom-centered, control the distance from the center by changing the path radius, and manage colors via swatches (since Inkscape doesn’t use CSS variables).

Examples reference `AZ-WP-Website-Consulting-LLC.svg` in the project root.

---

## Files and IDs referenced

- SVG: `AZ-WP-Website-Consulting-LLC.svg`
- Guide circle (red, usually hidden): `circle#innerGuide`
  - Example: `r="66"`, center `(cx, cy) = (75, 75)`
- Text path (bottom semicircle): `path#innerTextPath`
  - Example: `d="M 11,75 A 64,64 0 1 0 139,75"`
  - Note: the text follows whatever path is referenced by the `<textPath>` element via `xlink:href`. In our SVG, `text#textCompany > textPath#textPath1` simply describes the hierarchy (a `textPath` inside the `text`); the actual link is `xlink:href="#innerTextPath"`, which tells the text which path to follow.
- Text following the path: `text#textCompany > textPath#textPath1`
  - Key attributes: `text-anchor="middle"`, `startOffset="50%"`
- Swatches (global paints in `<defs>`): `#swatchLeft`, `#swatchRight`, `#swatchText`, `#swatchGuide`

---

## Concept: Spacer vs. Text Path

- The “red-circle-spacer” is a reference guide (`#innerGuide`). It’s a normal circle you can make visible/hidden via opacity.
- The text is attached to a separate path (`#innerTextPath`). Using a dedicated bottom semicircle keeps alignment predictable.
- Bottom semicircle pattern:
  - `M (cx - r), cy  A r,r  0 1 0  (cx + r), cy`
  - This draws a left-to-right arc through the bottom. With `text-anchor="middle"` and `startOffset="50%"`, the text is centered at the bottom midpoint.

What this means:
- `M (cx - r), cy` moves to the left point of the circle.
- `A r,r 0 1 0 (cx + r), cy` is an elliptical-arc command with:
  - `r,r`: radii (`rx`, `ry`) — here both equal to the desired text-path radius `r`.
  - `0`: x-axis rotation (we keep 0 for circles).
  - `1`: large-arc-flag (prefer the ≥180° arc).
  - `0`: sweep-flag (direction; 0 = counterclockwise, 1 = clockwise).
  - `(cx + r), cy`: endpoint on the right side of the circle.

Tip: If the arc appears on the top instead of the bottom, toggle the sweep flag (0 ↔ 1) or use `Path > Reverse` on the path in Inkscape.

---

## Attach text to the path (Inkscape UI)

1. Create your text (`Text Tool`), select it.
2. Shift+select the path (e.g., `#innerTextPath`).
3. Menu: `Text > Put on Path`.
4. With the text still selected, open `Text and Font` or the XML Editor for fine attributes.
5. In the XML for `<text>` and `<textPath>`:
   - Ensure `<text>` has `text-anchor="middle"`.
   - Ensure `<textPath>` has `startOffset="50%"`.
6. If the text appears mirrored or upside down, select the path and run `Path > Reverse`.

### Font choice for logos
- Slightly narrower sans-serif faces will occupy less horizontal space than wide sans-serifs at the same size.
- For logos, pick a font that remains highly legible at small sizes (clear counters, consistent stroke widths, good spacing).
- If space is tight, try a condensed variant or reduce letter-spacing slightly rather than dropping too much font size. Or simply shorten the text.

---

## Keep it bottom-centered

- Use a bottom semicircle for the text path.
- Set:
  - On `<text>`: `text-anchor="middle"`
  - On `<textPath>`: `startOffset="50%"`
- This removes ambiguity caused by full-circle start points and directions.

Example from this SVG:

```xml
<path id="innerTextPath" d="M 11,75 A 64,64 0 1 0 139,75" />
<text id="textCompany" style="text-anchor:middle">
  <textPath xlink:href="#innerTextPath" startOffset="50%">AZ WP Website Consulting LLC</textPath>
</text>
```

---

## Adjust distance from center (two ways)

- Preferred: change the path radius.
  - If your guide circle is radius `Rguide` and you want the text path offset outward by `Δ` (e.g., about the width of the red stroke), set:
    - `Rtext = Rguide + Δ`
  - Update the arc endpoints to `cx - Rtext` and `cx + Rtext`:
    - Example (center 75,75):
      - Before (radius 60): `d="M 15,75 A 60,60 0 1 0 135,75"`
      - After (radius 64): `d="M 11,75 A 64,64 0 1 0 139,75"`

- Quick tweak: baseline shift on the text/tspan.
  - Add to `<tspan>` or `<text>` style:
    - `style="baseline-shift:-4px"` (negative typically moves text outward for a bottom arc). Adjust value to taste.

---

## Using swatches for colors (Inkscape-compatible)

Inkscape doesn’t resolve CSS custom properties. Use swatches (paint servers) in `<defs>` and reference them by `url(#id)`.

- Defined in `<defs>`:

```xml
<linearGradient id="swatchText" inkscape:swatch="solid">
  <stop style="stop-color:#220001;stop-opacity:1" offset="0" />
</linearGradient>
```

- Applied to shapes/text:

```xml
<text fill="url(#swatchText)">
  ...
</text>
```

- To update colors project-wide, edit the `<stop style="stop-color:#...">` inside the swatch definition. All elements using `url(#swatchName)` update automatically in Inkscape and in browsers.

- Inkscape UI:
  - Select an object, open `Fill and Stroke` → choose `Swatches` (7th tab) and pick your named swatch.
  - You can manage swatches in the `Swatches` dialog; they correspond to these `<linearGradient inkscape:swatch="solid">` entries.

---

## Troubleshooting

- Text on path is mirrored/upside-down: select the path and `Path > Reverse`.
- Text not at bottom center: confirm you’re using a bottom semicircle and `startOffset="50%"` with `text-anchor="middle"`.
- Unexpected width/centering: remove `textLength`/`lengthAdjust` attributes from `<text>`/`<textPath>`.
- Transforms on text or path can shift positioning. Prefer untransformed paths for predictability.
- Ensure the text is attached to the correct path (`xlink:href="#innerTextPath"`).
- If the text is clipped, reduce the font size (Text tool) so the string fits comfortably within the bottom semicircle, or increase the text-path radius.

---

## Quick checklist

- Create a guide circle (`#innerGuide`) near your desired radius; keep it hidden or semi-transparent.
- Create a bottom semicircle path (`#innerTextPath`) at the radius you want your text to sit.
- Put text on the path; set `text-anchor: middle`, `startOffset: 50%`.
- Adjust distance by editing the path radius.
- Use swatches in `<defs>` for all fills/strokes you want to manage globally.
- Edit swatch colors to update the logo instantly across Inkscape and code.
