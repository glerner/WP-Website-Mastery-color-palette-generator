# WPWM Color Palette Generator
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
  * All tints and shades have contrast checking against near-white or near-black text, required to exceed WCAG AAA color contrast, while not exceeding WCAG maximum recommended contrast ("pure white" against "pure black" is hard to read, too high contrast).
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
  * Export of multiple theme variations (change the order of the generated colors)
    * Choose on the Export tab: 6 combinations (rotate Primary/Secondary/Tertiary; Accent fixed) or 24 combinations (rotate all four: P/S/T/Accent)
    * Recommendation: if one color is most eye‑catching for links/menus/buttons (often the Accent), prefer 6 variations so that Accent consistently drives interactive elements

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
* On the Export tab you can choose:
  * __6 variations__: rotates Primary/Secondary/Tertiary while keeping Accent fixed. Recommended when your Accent is the most eye‑catching color (used for links/menus/buttons).
  * __24 variations__: rotates all four roles (Primary/Secondary/Tertiary/Accent) for comprehensive exploration.

Copy the *.json and *.css files to your child theme's styles folder (create it if it doesn't exist).

Variables like --primary-dark, --error-light, etc. are defined by your `theme-variation.json` styles.css section (in the several *.json files, there is a styles section, which has a css section).

Copy the CSS from your chosen theme variation's *.css file, to your theme's style.css (don't overwrite the file, merge them).

The CSS file provides utility classes that use the color variables.

# Make color swatches appear in the Block Editor (sidebar)

Your exported `theme.json` uses CSS variables in the palette values (for example, `"color": "var(--accent-darker)"`). The editor canvas resolves them when the exporter scopes variables to both `:root` and `.editor-styles-wrapper`. However, the sidebar color picker UI (the circular swatches) lives in the admin document outside the canvas and does not inherit your theme variables by default.

Add the following dynamic, variation‑aware snippet to your active WordPress theme’s `functions.php` so the sidebar swatches always match the currently active Theme/Style Variation without hardcoding. This works with child themes via `get_stylesheet_directory()`.

```php
/**
 * Ensure the Block Editor sidebar (admin chrome, outside the canvas iframe) can resolve
 * CSS variables from the ACTIVE theme/style variation without hardcoding.
 *
 * - Includes WP resolved globals (variables + presets) via wp_get_global_stylesheet().
 * - Includes the theme's own theme.json styles.css (emitted by your exporter).
 * - Bridges --wp--preset--color--<slug> to your --<slug> alias so both resolve.
 */
function fse_enqueue_block_editor_admin_chrome_styles() {
    // 1) Resolved variables + presets from the active theme/variation/user global styles
    $globals_css = '';
    if ( function_exists('wp_get_global_stylesheet') ) {
        // Include variables + presets; reflects the ACTIVE style variation and user styles.
        $globals_css = wp_get_global_stylesheet( array( 'variables', 'presets' ) );
    }

    // 2) Theme's own inline CSS from theme.json (your exporter's styles.css)
    $inline_css = '';
    $theme_json_path = get_stylesheet_directory() . '/theme.json'; // supports child themes
    if ( file_exists( $theme_json_path ) ) {
        $json_raw = file_get_contents( $theme_json_path );
        if ( $json_raw !== false ) {
            $json = json_decode( $json_raw, true );
            if ( is_array($json) && isset($json['styles']['css']) && is_string($json['styles']['css']) ) {
                // Your exporter already scopes to :root,.editor-styles-wrapper{ ... }
                $inline_css .= $json['styles']['css'];
            }

            // 3) Bridge preset variables to your aliases so both forms resolve in admin chrome
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
}

add_action('enqueue_block_editor_assets', 'fse_enqueue_block_editor_admin_chrome_styles', 20);
```

Notes:

- The exporter already emits CSS variables to both `:root` and `.editor-styles-wrapper`, so the editor canvas resolves them. The snippet above adds them to the admin document so the sidebar swatches resolve too.
- `wp_get_global_stylesheet([ 'variables', 'presets' ])` reflects the currently active Theme/Style Variation and user Global Styles, so swatches stay in sync when you switch styles or child themes.

---

# Visitor Light/Dark Toggle (WordPress)

If your exported styles use `light-dark()` CSS function for variables, you can offer visitors a manual Light/Dark/Auto toggle that plays nicely with system preference and avoids flashes.

This repo includes a small helper and script you can copy into a theme:

- `inc/theme-color-scheme-toggle.php`
- `assets/js/color-scheme-toggle.js`

## Steps

1) Copy the files into your theme

- Copy `inc/theme-color-scheme-toggle.php` to your theme’s `inc/` folder
- Copy `assets/js/color-scheme-toggle.js` to your theme, e.g. `assets/js/color-scheme-toggle.js`

2) Wire it in `functions.php`

```php
// add to functions.php of your (child) theme
/**
 * Light/Dark/Auto visitor toggle hooks:
 * - wpwm_output_initial_color_scheme: prints a tiny inline bootstrap in <head> to set
 *   html[data-color-scheme] pre-paint to avoid flashes.
 * - wpwm_enqueue_theme_color_scheme_toggle: enqueues the small front-end JS that manages
 *   the toggle control and persists preference to localStorage.
 * - wpwm_body_class_color_scheme (optional): adds a placeholder body class for SSR parity.
 */
require get_stylesheet_directory() . '/inc/theme-color-scheme-toggle.php';
add_action( 'wp_head', 'wpwm_output_initial_color_scheme', 0 );
add_action( 'wp_enqueue_scripts', 'wpwm_enqueue_theme_color_scheme_toggle' );
add_filter( 'body_class', 'wpwm_body_class_color_scheme' ); // optional
```

If you put the JS in a different location, filter its URI:

```php
add_filter( 'wpwm_color_scheme_toggle_src', function( $src ){
  return get_stylesheet_directory_uri() . '/path/to/your/color-scheme-toggle.js';
});
```

3) Minimal CSS hooks (theme-level)

Add these to ensure `light-dark()` responds to your current mode, and that manual overrides work:

```css
:root { color-scheme: light dark; }
html[data-color-scheme="light"] { color-scheme: light; }
html[data-color-scheme="dark"]  { color-scheme: dark; }
```

Your variables can continue to use `light-dark(lightValue, darkValue)`, for example:

```css
:root {
  --bg: light-dark(white, #0b0b0c);
  --fg: light-dark(#0c0c0d, white);
}
body { background: var(--bg); color: var(--fg); }
```

4) Add a menu item as the toggle

Create a custom link in your main menu (Appearance → Menus or Navigation), and add the CSS class `js-theme-toggle` to that item. The script will upgrade it into a cyclic toggle (Auto → Dark → Light → Auto), persist choice to `localStorage`, and keep the label in sync.

Optionally, add a span to control the label area without replacing icons:

```html
<a href="#" class="js-theme-toggle"><svg><!-- your icon --></svg> <span data-label>Auto</span></a>
```

5) Behavior details

- The helper prints a tiny inline bootstrap in `<head>` to set `html[data-color-scheme]` before first paint, preventing flashes.
- The JS listens for clicks on elements with `.js-theme-toggle` or `[data-theme-toggle]` and cycles a stored preference: `auto` | `dark` | `light`.
- When set to `auto`, it reflects the system’s `prefers-color-scheme` dynamically (listens for changes and updates).
- Adds convenience classes on `<html>`: `has-dark-scheme` / `has-light-scheme`.
- Labels are localized via `WPWM_TOGGLE_LABELS` and can be filtered in PHP.

6) Progressive enhancement

Browsers that fully support `color-scheme` and `light-dark()` will seamlessly honor the manual mode using `html[data-color-scheme]`. Older browsers will at minimum respect the `color-scheme` hint; your palette should still be readable thanks to variable defaults.

---

# Troubleshooting

* __Port busy__: run `npm run dev -- --port 5174` and open http://localhost:5174
* __Env not applied__: confirm values are in `.env.local` (not committed) and restart `npm run dev`.
* __Type errors__: check recent edits in `helpers/ensureAAAContrast.tsx`, `helpers/colorUtils.tsx`, and `helpers/config.ts` for consistent imports/exports.

## Copyright
Copyright (c) AZ WP Website Consulting LLC, 2025
