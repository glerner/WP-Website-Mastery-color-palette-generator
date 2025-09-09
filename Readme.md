# WPWM Color Palette Generator Project
by WP-Website-Mastery.com

Color palette theme.json generator, automatically contrast adjusting. Select tints-shades from those that match WCAG AAA contrast. Generates WordPress Theme Variation palettes.

[See it run](https://gl-color-palette-generator.vercel.app)
[Github](https://github.com/glerner/WP-Website-Mastery-color-palette-generator.git)

#color-palette #wcag-contrast #wcag-aaa #theme-colors #wp-theme-variations

The WPWM Color Palette Generator focuses on creating a functional color palette system with AI assistance and WordPress theme integration. The core functionality includes
* AI-Assisted Color Generation
  * Questionnaire for gathering business/brand context
  * AI generation of color palettes that will look good for this business with these clients
  * Return of Primary, Secondary, Tertiary, and Accent colors with hex values and names
* Manual Color Management
  * Manual entry of the four core colors, and automatic fill-in any missing colors (using a selection from a list of common color harmonies)
  * Automatic generation of color tints/shades (not calling them "variations" since also using "WordPress Theme Variations").
    * Correct luminance ordering (white  → lighter → light → clear-gap-between-light-and-dark → dark → darker → black)
  * All tints and shades have contrast checking against white or black text, required to exceed WCAG AAA color contrast, while not exceeding WCAG maximum recommended contrast ("pure white" against "pure black" is hard to read, too high contrast).
    * adjustable luminance target levels for lighter, light, dark, darker -- you select your favorite from several shown
* Extended Color Set
  * Addition of utility colors (error, notice, success)
  * Neutral color variations
* Display and Preview
  * Visual display of the complete color palette
  * Sample content preview with demo text
  * Preview of different color combinations
* WordPress Integration
  * Export of color palettes as theme.json Theme Variations
  * Export of multiple theme variations (change the order of the generated colors, 6 combinations of primary, secondary and tertiary colors, or 24 combinations with accent colors )

# Quick Start (Local)

* __Install dependencies__

```bash
npm install
```

* __Run the dev server__ (Vite on http://localhost:5173)

```bash
npm run dev
```

Keep the terminal running. Stop with 'q' then Enter, or you can press ctrl+c.
After restarting your machine or IDE, run `npm run dev` again.

* __Build and preview production bundle__

```bash
npm run build
npm run preview
```

---

# Environment and Configuration

Configuration is centralized in `helpers/config.ts`. Non-secret UI tuning can be overridden via `.env.local` using `NEXT_PUBLIC_` variables.

Examples (create `./.env.local`):

```bash
# Accessibility thresholds (safe for client)
NEXT_PUBLIC_AAA_MIN_CONTRAST=7.05
NEXT_PUBLIC_AA_SMALL_MIN_CONTRAST=4.5

# Generation targets (safe for client)
NEXT_PUBLIC_TINT_TARGET_COUNT=10
NEXT_PUBLIC_SHADE_TARGET_COUNT=10
NEXT_PUBLIC_LIGHTER_MIN_Y=0.50
```

__Important__: Do NOT put secret API keys in `NEXT_PUBLIC_*` variables; they are exposed to the browser.

---

# API Keys (Secrets)

If you add AI-powered base color generation or other provider calls, keep keys server-side only.

Local development (never commit `.env.local`):

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
CLAUDE_API_KEY=...
```

Use these only in server code (API routes/functions). The browser should call your server endpoint, not the provider directly.

Production: set the same env vars in your hosting environment’s secret manager (e.g., Vercel/Netlify/Render dashboards, or your own server process manager). Do not expose secrets to the client.

---

# Development Workflow

* __Color math runs in the browser__ for instant feedback (see `helpers/colorUtils.tsx`).
* __Thresholds and ranges__ are centralized in `helpers/config.ts` and surfaced as short constants (e.g., `AAA_MIN`, `LIGHTER_MIN_Y`).
* __Server-side tasks__ (if added) should handle secrets and heavy operations (e.g., AI calls, ZIP export streaming).

Scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 5173"
  }
}
```

---

# Exporting WordPress Theme Variations

The app supports exporting palettes as WordPress `theme.json` Theme Variations. Planned/desired behavior:

* __Single archive (ZIP)__ containing multiple theme variations.
* Each variation includes a `theme.json` and corresponding CSS.
* Variations will permute primary/secondary/tertiary (and optionally accent) roles.

See `endpoints/` and related helpers for export implementation details. If hosting within WordPress, you can proxy export via a WP REST endpoint and deliver the ZIP as a download.

---

# Troubleshooting

* __Port busy__: run `npm run dev -- --port 5174` and open http://localhost:5174
* __Env not applied__: confirm values are in `.env.local` (not committed) and restart `npm run dev`.
* __Type errors__: check recent edits in `helpers/ensureAAAContrast.tsx`, `helpers/colorUtils.tsx`, and `helpers/config.ts` for consistent imports/exports.
