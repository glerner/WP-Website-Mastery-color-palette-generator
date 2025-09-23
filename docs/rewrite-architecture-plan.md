# Rewrite Architecture Plan (MVC with WP + TSX)

This document captures the current generator behavior, output destinations, terminology, and a plan for rewriting the codebase using a Model–View–Service–Controller design with WordPress/PHP on the server and TypeScript/TSX in the client.

## Main Output

- WordPress Theme Variation JSON files, and supporting CSS files, plus instructions.

## Current Outputs and Where They Go

- ZIP archive produced by the Export action in `pages/generator.tsx` via `handleExportGzipAll()`.
  - Filename: `<themename>-<suffix>.zip`.

- Inside the ZIP:
  - `styles/<titleSlug>-<code>.json`
    - Produced by `helpers/themeJson.tsx` → `buildWpVariationJson()`.
    - Purpose: WordPress Theme Variation JSON.
    - Contains:
      - `settings.color.palette` entries that reference CSS variables (no hex values here).
      - `styles.css`: a single inlined CSS string that defines every palette variable with hex values. Required by JSON schema to be a single line.
        - Includes: `--text-on-dark`, `--text-on-light`.
        - Includes all family bands: `--{primary|secondary|tertiary|accent}-{lighter|light|dark|darker}`.
        - Includes semantic bands: `--{error|notice|success}-{light|dark}`.
        - Includes compatibility aliases for base/contrast as variable references (themes/twentytwentythree and twentytwentyfour rely on these defined).
      - This is the only place that contains hex numbers. Switching the active Theme Variation in WordPress changes all colors site‑wide without editing theme files.
      - Exception: Prior palette entries selected by user put Hex color numbers in the HTML. This approach puts CSS variable in the HTML. Will need a utility to change Hex numbers in the HTML into CSS variables in the HTML.

  - `styles/<titleSlug>-<code>.css`
    - Produced by `helpers/cssGenerator.tsx` → `generateCssClasses()`.
    - Purpose: Optional CSS utilities file for use in themes (may be merged into a child theme `style.css`). WordPress does not auto-load this.
    - Contains:
      - A minimal `:root` header and utility classes that reference CSS variables only (no hex values).

  - `README.txt`
    - Instructions for how to use the JSON and CSS with WordPress.

  - `inc/fse-editor-chrome-styles.php`
    - Helper to improve the block editor sidebar swatches (optional).

## Current Code Locations (Key Functions)

- Theme Variation JSON builder: `helpers/themeJson.tsx`
  - `buildWpVariationJson(palette, title, themeConfig, { semanticBandSelection, textOnDark, textOnLight })`
    - Emits the Theme Variation JSON including the inlined `styles.css` string with all hex palette variables.
  - `generateThemeJson(...)` exists for older flows and is not used by the Export zip.

- CSS utilities generator: `helpers/cssGenerator.tsx`
  - `generateCssClasses(palette, semanticBandSelection, { textOnDark, textOnLight })`
    - Emits utility classes that rely on CSS variables exported by the JSON file above.

- Export assembly and file names: `pages/generator.tsx`
  - `handleExportGzipAll()`
    - Calls `buildWpVariationJson()` and `generateCssClasses()` for each variant.
    - Writes `styles/<titleSlug>-<code>.json` and `styles/<titleSlug>-<code>.css` into the zip.

## Planned Rewrite: Model – View – Service – Controller

- Model (TS/TSX)
  - Palette model: `primary|secondary|tertiary|accent` base colors; semantic colors: `error|notice(warning)|success`.
  - Variations: bands `lighter|light|dark|darker` with explicit `variation.step` property.
  - Constraints: enforce AAA small-text contrast for text tokens against chosen backgrounds.

- View (TSX UI)
  - Panels: Instructions, AI, Manual, Palette, Adjust, Export, Demo, Landing.
  - Responsibilities:
    - Show current palette and exact selections.
    - Allow per-scheme semantic band selection.
    - Preview light/dark using `light-dark()` and fallbacks.

- Services
  - Generation service (TS): color utilities, band generation, semantic generation.
  - Export service (TS): assembles Theme Variation JSON and utilities CSS; zips outputs.
  - Validation service (TS): luminance/contrast checks; migration of legacy selection state; guards around `variation.step`.

- Controller
  - Orchestrates user actions (e.g., Export) → invokes services → returns artifacts (zip) → updates UI.
  - Server side (PHP/WordPress): endpoints/hooks for installing/applying Theme Variations or integrating with WP Admin where appropriate.

- Server (PHP/WordPress API)
  - Provide endpoints to import/export variations.
  - Optional: register additional admin screens for managing variations.

## Design Decisions (for the Rewrite)

- Single source of truth for hex values is the Theme Variation JSON’s `styles.css` string.
- `helpers/cssGenerator.tsx` (utilities CSS) must not emit hex values; only CSS variables.
- Use `variation.step` strictly and validate it; skip invalid/missing steps with a console error that includes the family name and the offending variation object.
- Background classes must pair bands explicitly inside `@supports (color: light-dark(...))`:
  - `lighter → light-dark(var(--{family}-lighter), var(--{family}-darker))`
  - `light   → light-dark(var(--{family}-light), var(--{family}-dark))`
  - `dark    → light-dark(var(--{family}-dark), var(--{family}-light))`
  - `darker  → light-dark(var(--{family}-darker), var(--{family}-lighter))`
- Fallback (no `light-dark()` support):
  - Background uses exactly the selected band `var(--{family}-{step})`.
  - Text uses the proper high-contrast token:
    - `step in {lighter, light} → var(--text-on-light)`.
    - `step in {dark, darker} → var(--text-on-dark)`.
- Semantic backgrounds:
  - In Export utilities CSS (`helpers/cssGenerator.tsx`):
    - Fallback (no `light-dark()`): use the USER-SELECTED LIGHT scheme band for the semantic background and pair the text token to contrast with that band (lighter/light → `text-on-light`; dark/darker → `text-on-dark`).
    - `@supports (color: light-dark(...))`: use the USER-SELECTED LIGHT band for the first arg and the USER-SELECTED DARK band for the second arg; pair each side with the contrasting text token respectively.
  - Editorial rule for UI/editor behavior and export: when a user picks a specific band (e.g., "P Dark") while editing in light mode, the LIGHT side of `light-dark()` uses that chosen band as the first argument and the opposite band (e.g. "P Light") as the second. Foreground tokens must contrast with each side. This applies to families and semantics.
- Keep background convenience aliases in the utilities CSS `:root` header:
  - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-accent`.
  - They must reference palette variables (e.g., `var(--primary-dark)`), not hex values.

## Application Panels (Current Behavior)

- `Instructions`, `AI`, `Manual`, `Palette`, `Adjust`, `Export`, `Demo`, `Landing` (see `pages/generator.tsx`).
- `Adjust` and `Palette` enforce and visualize AAA contrast; selections propagate to export.
- `Export` builds the ZIP with Theme Variation JSON and utilities CSS.

## Misconceptions and Bugs Being Worked Through Now

- Text color contrast logic:
  - Ensure the chosen text token always achieves AAA contrast against the selected background band in both supported and fallback paths.
  - Align families and semantics so both follow the exact fallback rules.

- Step usage ambiguity:
  - Variations must expose `variation.step` and be validated; do not infer step solely from `variation.name`.
  - Log clear errors and skip invalid entries in generators.
  - Mistake to fix: some parts of the codebase store the band in `variation.step` explicitly; other parts only set `variation.name`.
    - This mismatch is the confusion: sometimes `variation.step` exists and is reliable; sometimes only `variation.name` is available and we derive the step from the name.
    - Rewrite decision: use `variation.step` consistently across generation, UI, and export. Do not rely on naming conventions (future palettes may not use our current naming patterns, e.g., monochrome palettes).

- Duplicate routines / scattered logic:
  - Some utilities (e.g., luminance, contrast) and band pairing logic exist in multiple places.
  - Consolidate into Services to avoid divergence and bugs.

- Variable naming clarity:
  - Avoid confusing aliases; keep `--{family}-{step}` and `--{ct}-{light|dark}` as the canonical names.
  - Maintain compatibility aliases only where required (e.g., WP preset mappings, base/contrast variable aliases).

- Output confusion (screen vs files):
  - Theme Variation JSON (`styles/<titleSlug>-<code>.json`) is the only artifact with hex numbers (inside `styles.css`).
  - Utilities CSS (`styles/<titleSlug>-<code>.css`) references variables only.
  - README documents how to deploy both into `wp-content/themes/<theme>/styles/`.

## Next Steps (for the Rewrite)

1. Create Services module boundaries (generation, export, validation) and migrate duplicate logic.
2. Update `helpers/cssGenerator.tsx` to enforce strict `variation.step` usage and fixed pairings; remove all hex assignments from its header; keep convenience aliases.
3. Add comprehensive logging for skipped/invalid variations with family/step context.
4. Add tests for fallback behavior vs `@supports(light-dark)` to assert AAA contrast.
5. Add PHP endpoints (or CLI) for importing Theme Variations directly into WordPress.
6. Document theme deployment workflows in README and this doc.
