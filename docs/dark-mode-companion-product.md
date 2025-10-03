# Dark Mode via light-dark() — Companion Product Proposal

This document outlines a viable approach to generate a dark-mode palette using CSS `light-dark()` with user-selected tint/shade pairs. It also describes a potential companion product that imports a user’s `theme.json`, shows tint/shade ribbons per color, and outputs CSS variables and `light-dark()` mappings with fallbacks.

## Summary

- **Approach**: For each color token, let the user pick a “lighter” and a “darker” swatch from a tint/shade ribbon. Emit variables and a computed token using `light-dark()`.
- **Accessibility assertion**: All tints/shades provided by the generator are curated to work with AAA+ contrast against the specified near-black and near-white text colors.
- **Compatibility**: Ship a media-query fallback for browsers that do not support `light-dark()` yet.

## Why this works

- **Maintains brand intent**: Users select perceptually appropriate light/dark counterparts instead of automatic inversion.
- **Simple token model**: Each token gets `--token-light`, `--token-dark`, and a computed `--token` using `light-dark()`.
- **Composable with current app**: Integrates with the existing generator and UI logic in `helpers/cssGenerator.tsx` and complements toggling in `inc/theme-color-scheme-toggle.php` and `assets/js/color-scheme-toggle.js`.

## Proposed UX Flow

- **Import theme.json**
  - Parse `settings.color.palette` (and optionally gradients/duotone if desired).
  - Map palette entries to color slugs and base colors.

- **Tint/Shade Ribbons**
  - For each base color, render a perceptual ladder (recommend OKLCH/CIELAB-derived steps for better uniformity).
  - Specify two reference text colors up front:
    - `text-on-light` (near-black for light surfaces)
    - `text-on-dark` (near-white for dark surfaces)
  - Automatically filter the ladder to swatches that fall within a contrast band:
    - Minimum: AAA+ against the appropriate reference text color.
    - Maximum: a configurable "too harsh" upper bound to avoid excessive contrast.
    - Give the user 3-10 options that are perceptually different from each other
      - flag if aren't 3 (text-on-light or text-on-dark are too far from black/white);
      - split the full range of acceptable contrast tints/shades into no more than 10 choices
  - User picks from the filtered options:
    - a “lighter” representative
    - a “darker” representative
  - Optional: pick nearby variants for hover/active/border.

- **Contrast Filtering**
  - Instead of a live contrast meter, the UI only presents tints/shades that satisfy the configured contrast band against `text-on-light` and `text-on-dark`.
  - If the band or reference text colors change, the filtered options update accordingly.

- **Export**
  - CSS variables with `light-dark()` and media-query fallbacks.
  - Optionally export both “role” tokens (e.g., `--surface`, `--text`) and “palette” tokens (e.g., `--brand-500`).

## Output Format

Example for a token `--brand`:

```css
:root {
  /* authoring variables */
  --brand-light: oklch(0.72 0.14 250);
  --brand-dark:  oklch(0.58 0.11 250);

  /* computed token (browsers with light-dark) */
  --brand: light-dark(var(--brand-light), var(--brand-dark));
}

/* Fallback for browsers without light-dark */
:root { --brand: var(--brand-light); }
@media (prefers-color-scheme: dark) {
  :root { --brand: var(--brand-dark); }
}
```

For role-based tokens:

```css
:root {
  --surface-light: oklch(0.98 0.01 95);
  --surface-dark:  oklch(0.18 0.01 95);
  --surface: light-dark(var(--surface-light), var(--surface-dark));

  --text-light: oklch(0.12 0.02 95);   /* near-black */
  --text-dark:  oklch(0.98 0.01 95);   /* near-white */
  --text: light-dark(var(--text-light), var(--text-dark));
}

:root { --surface: var(--surface-light); --text: var(--text-light); }
@media (prefers-color-scheme: dark) {
  :root { --surface: var(--surface-dark); --text: var(--text-dark); }
}
```

## Accessibility

- **AAA+ contrast claim**
  - All tints/shades supplied by the generator are curated to achieve AAA+ contrast against the specified near-black and near-white text colors. The UI filters available tints/shades to those within the configured contrast band (AAA+ minimum up to a "too harsh" maximum), ensuring users only select compliant options.

- **What to validate**
  - Text on primary surfaces, elevated surfaces, and interactive backgrounds.
  - Focus/outline colors vs. their backgrounds.
  - Disabled and subtle text vs. surfaces (ensure intended contrast for readability or intentional de-emphasis).

## Open Questions and Design Notes

- **Shadows**
  - Dark mode often uses lower alpha and wider, softer blurs. Consider two tokens per elevation: `--shadow-ambient`, `--shadow-key`, and map them via `light-dark()` with tuned opacities.
  - Avoid simply reusing light-mode shadow alphas; they can look heavy on dark backgrounds.

- **Overlays and Scrims**
  - Use translucent overlays that differ by mode (e.g., lighter on dark surfaces, darker on light surfaces). Provide `--overlay` via `light-dark()` with separate alpha tuning.

- **Translucent Layers**
  - Translucent surfaces (cards, modals) need mode-specific alphas to prevent muddiness or glow. Provide ramped tokens like `--surface-1`, `--surface-2`, etc., each with distinct light/dark alphas.

- **Neutral Colors (Grays)**
  - Non-symmetric mapping is often required. The midpoint gray in light mode rarely corresponds one-to-one in dark mode. Curate neutral ramps separately for surfaces, borders, and text.
  - Consider distinct neutral roles: `--neutral-surface`, `--neutral-border`, `--neutral-text` rather than a single gray ladder for all use cases.

- **Auto Temper Chroma (Dark Mode)**
  - Highly saturated accents can appear neon on dark backgrounds. Offer an optional “Auto temper chroma” toggle that reduces chroma (e.g., OKLCH C −10–30%) only for the dark-side pick.
  - Apply clamping to stay in-gamut after adjustments.

- **States and Variants**
  - Plan hover/active/focus/disabled tokens. The ribbon UI can reserve adjacent swatches for state variants, or derive them algorithmically (e.g., small ΔL or ΔC adjustments) with user override.

- **Images and Brand Marks**
  - Avoid blindly applying `light-dark()` to images/logos. Provide separate assets or controlled filters. Keep these outside the color token system.

## Implementation Notes

- **Integration Points**
  - Generator UI and emission logic in `helpers/cssGenerator.tsx`.
  - Optional toggle and storage in `inc/theme-color-scheme-toggle.php` and `assets/js/color-scheme-toggle.js` for user preference persistence.

- **Color Spaces**
  - Prefer OKLCH/CIELAB ladders for ribbon generation to keep steps perceptually uniform.
  - Keep conversions accurate (linearization, gamut handling) to avoid surprises.

- **Browser Support**
  - `light-dark()` (CSS Color 5) is shipping across modern browsers but not yet universal. Always include the `prefers-color-scheme` fallback shown above.

## Deliverables (Companion Product)

- **Import**: Read `theme.json`, map palette entries to slugs.
- **UI**: Per-color tint/shade ribbons with contrast-band filtering (AAA+ minimum to a configurable "too harsh" maximum) and optional chroma temper toggle.
- **Export**: CSS variables (`--slug-light`, `--slug-dark`, `--slug`) with `light-dark()` and media-query fallback; optional role tokens.
- **Docs**: Guidance on neutrals, shadows, overlays, translucency, and accessibility checks.

## WordPress specifics: author palette vs. theme developer tokens

- **What belongs in the Block Editor palette**
  - Author-facing palette should expose a manageable set of colors (your 23 from `theme.json`) and their `light-dark()` computed tokens. These are the choices authors/editors pick from.
  - Do not expose shadows, overlays, scrims, or translucent layers in the palette selector; these are not author-chosen colors.

- **Theme-developer-only tokens**
  - Provide additional tokens for implementation detail and system feel: `--shadow-ambient`, `--shadow-key`, `--overlay`, `--scrim`, translucent surface steps (e.g., `--surface-1`..`--surface-4`), borders, focus rings, etc.
  - These are referenced by theme CSS and block styles, not by authors in the palette UI.

- **How to deliver to theme developers**
  - Ship a “developer CSS” (or section within the exported CSS) that defines these extra tokens via `light-dark()` and/or media-query fallbacks, alongside the author palette variables. Example file: `assets/css/theme-system-tokens.css`.
  - Keep naming stable and documented so theme CSS can use `var(--shadow-ambient)` etc.

- **Integration with `theme.json` and Theme Variations**
  - `theme.json` controls the author palette and many style defaults, but it does not natively define shadows/overlays as palette entries.
  - Generate system tokens from the same color picks and emit them as `:root` CSS variables (and optionally attach to `body` or `.is-light/.is-dark` if you use class-based mode switching).
  - When a Theme Variation is selected, it swaps out the `theme.json` palette. If your variation also swaps the companion CSS variables (via different CSS files or variable overrides), shadows/overlays/translucents will update automatically.
  - Recommended: bundle each Variation with a corresponding variables layer (e.g., `variations/blue/variables.css`) that overrides the system tokens and is enqueued conditionally by the theme.

## Conclusion

Using `light-dark()` with user-selected tint/shade pairs is a practical, user-controlled method to produce robust dark-mode palettes. With curated tints/shades that achieve AAA+ contrast against near-black and near-white text, plus fallbacks and guardrails, this can be delivered as a lightweight companion product to the existing Color Palette Generator.
