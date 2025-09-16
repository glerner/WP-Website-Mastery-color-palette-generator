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

# Make color swatches appear in the Block Editor (sidebar)

If your exported `theme.json` uses CSS variables in the palette values (for example, `"color": "var(--accent-darker)"`), the editor canvas resolves them when the exporter scopes variables to both `:root` and `.editor-styles-wrapper`. However, the sidebar color picker UI (the circular swatches) lives in the admin document outside the canvas and does not inherit your theme variables by default.

Add the following dynamic, variation‑aware snippet to your active WordPress theme’s `functions.php` so the sidebar swatches always match the currently active Theme/Style Variation without hardcoding. This works with child themes via `get_stylesheet_directory()`.

```php
<?php
// Ensure the Block Editor sidebar (admin chrome, outside the canvas iframe) can resolve
// CSS variables from the ACTIVE theme/style variation without hardcoding.
add_action('enqueue_block_editor_assets', function () {
    // 1) Resolved variables + presets from the active theme/variation/user global styles
    $globals_css = '';
    if ( function_exists('wp_get_global_stylesheet') ) {
        // Include variables + presets; reflects the ACTIVE style variation and user styles.
        $globals_css = wp_get_global_stylesheet( array( 'variables', 'presets' ) );
    }

    // 2) Theme's own inline CSS from theme.json (exporter’s styles.css string)
    $inline_css = '';
    $theme_json_path = get_stylesheet_directory() . '/theme.json'; // supports child themes
    if ( file_exists( $theme_json_path ) ) {
        $json_raw = file_get_contents( $theme_json_path );
        if ( $json_raw !== false ) {
            $json = json_decode( $json_raw, true );
            if ( is_array($json) && isset($json['styles']['css']) && is_string($json['styles']['css']) ) {
                // Exporter scopes to :root,.editor-styles-wrapper{ ... }
                $inline_css .= $json['styles']['css'];
            }

            // 3) Bridge preset variables to your aliases so both forms resolve in sidebar
            if ( isset($json['settings']['color']['palette']) && is_array($json['settings']['color']['palette']) ) {
                $map_rules = array();
                foreach ( $json['settings']['color']['palette'] as $entry ) {
                    if ( ! empty($entry['slug']) ) {
                        $slug = sanitize_title( $entry['slug'] );
                        // --wp--preset--color--<slug>: var(--<slug>)
                        $map_rules[] = "--wp--preset--color--{$slug}: var(--{$slug})";
                    }
                }
                if ( $map_rules ) {
                    // Use :root for the admin document (sidebar chrome)
                    $inline_css .= ':root{' . implode(';', $map_rules) . ';}';
                }
            }
        }
    }

    // 4) Inject into the editor admin document (not the canvas iframe)
    $final_css = trim( ($globals_css ?: '') . "\n" . ($inline_css ?: '') );
    if ( $final_css !== '' ) {
        // Use both handles for broad compatibility across WP versions
        wp_add_inline_style( 'wp-edit-blocks',  $final_css );
        wp_add_inline_style( 'wp-block-editor', $final_css );
    }
}, 20);
```

Notes:

- The exporter already emits CSS variables to both `:root` and `.editor-styles-wrapper`, so the editor canvas resolves them. The snippet above adds them to the admin document so the sidebar swatches resolve too.
- `wp_get_global_stylesheet([ 'variables', 'presets' ])` reflects the currently active Theme/Style Variation and user Global Styles, so swatches stay in sync when you switch styles or child themes.

---

# Troubleshooting

* __Port busy__: run `npm run dev -- --port 5174` and open http://localhost:5174
* __Env not applied__: confirm values are in `.env.local` (not committed) and restart `npm run dev`.
* __Type errors__: check recent edits in `helpers/ensureAAAContrast.tsx`, `helpers/colorUtils.tsx`, and `helpers/config.ts` for consistent imports/exports.
