# WPWM Color Palette Generator
by WP-Website-Mastery.com

## Make Your Website Colors Look Great (Plain-English Guide)

This tool creates a professional color set for your website and checks contrast so text stays easy to read. It plugs into WordPress “Theme Variations”, so you can switch complete looks in one click.

- Generates WordPress Theme Variation palettes, and CSS variables for use in WordPress block editor and some page builders.
- 3 basic colors, and an accent color
- 2 light tints (-lighter and -light) and 2 dark shades (-darker and -dark) each
- 3 semantic colors (error, notice/warning, success) light and dark variants
- Automatically adjusts color contrast, only colors meeting WCAG AAA contrast get output.
- You select your preferred tints-shades from those that match WCAG AAA contrast.

## What you get
- **Better readability**: Consistent high-contrast text color (text-on-light and text-on-dark) for accessibility; if you use only these text colors, you will have WCAG AAA contrast.
- **Brand-friendly palette**: Primary, Secondary, Tertiary, Accent, plus helpful colors like Error/Notice/Success.
- **Ready for WordPress**: Generates CSS style classes your theme can use right away. The styles/<name>-*.json files use CSS variables, and define the colors for WordPress Theme Variations.
- **Multiple Theme Variations**: You pick the combination of colors (which one is the site's primary color, which one is the secondary color, etc.) that you prefer, by *previewing* them on your site. Your choice of 6 variations (with the accent color set), or 24 variations (primary, secondary, tertiary and accent can all be seen in each position).
- **Added Light-Dark Mode**: Add a companion plugin, and your website has a light and dark mode toggle. Both light mode and dark mode use colors from your Palette (not calculated colors like many light-dark plugins assign).
- **Works with the Block Editor**: and also works in some page builders. With other page builders, you may have to paste the color numbers into the builder.

### Do you want the main color to be the blue, the green, or the blue-green?
- Generates all the combinations of the 3 basic colors (primary, secondary, tertiary), plus optionally accent, with the tints and shades.
- Preview your site with the WordPress Theme Variations (add-on plugin that is better than what is built into WordPress), and select your preference.

### Future changes to your palette
- Most themes store **color numbers** in your page or post. If you change your palette, you will have to update every page element that uses a color from your palette.
- This generates Theme Variations that will store a **color variable**, such as "--primary-light" instead of a color number such as #ffdebb.
- WordPress block editor (and some page builders) will store these color variables instead of hard-coding color numbers (e.g., var(--primary-lighter) instead of #hex like #ffdebb).
- Next time you modify your color palette, you won't have to update every page element that uses a color from your palette.
- (If your plugins and blocks follow your Palette; not all do.)

### Light and Dark Mode
- Install the optional companion light-dark toggle plugin `wpwm-color-scheme-toggle`.
- This Color Palette Generator defines CSS variables that can be used with the CSS light-dark() function, so your site will be automatically adjusted for light and dark mode. Modern CSS light-dark() function with your palette colors, so colors adapt with your palette.


## What you need
- Your theme’s settings file: `theme.json` (from your parent or child theme).
  - Many themes define their own colors as 'slug' (identifiers). Uploading your file lets this export the Palette colors and define those exact color 'slugs' your theme expects.
  - If you can’t upload the actual theme.json file, use the “Twenty Twenty‑Five” option to try a standard setup.

## How to use it
1) **Upload** your theme’s `theme.json` (or choose the Twenty Twenty‑Five option).
2) **Pick your two text colors**: one for light backgrounds (Text on Light), one for dark backgrounds (Text on Dark).
3) **Adjust your brand colors**: Primary, Secondary, Tertiary, Accent. The tool keeps contrast high for readability.
4) **Fine Tune the Tints and Shades**: Pick from among the tints and shade that have excellent color contrast. Consider the gap between white and lighter, between lighter and light, between dark and darker, and between darker and black. Since you will likely use similar selections for similar colors, the index of each selection is saved for you.
4) **Export**: You’ll get a folder with multiple Theme Variation files and one utilities CSS. The utilities CSS file has classes for you to paste into your existing style.css file.
5) **Dark mode**: Your pages will use the colors you picked for your palette; if you specified "Primary Light" for an element in light mode, then your dark mode will have "Primary Dark"; if you specified an element uses "Secondary Darker" in light mode, then your dark mode will show "Secondary Lighter".
6) **Future Palettes**: You can use this tool to generate new palettes for your website. All the elements on your page where you picked a background or text color using this Palette Generator, will use the colors from your new palette, automatically. Instead of colors being hard-coded to a color number, they are now set to use a color variable; this means that if you change a color in your palette, all the elements on your page will use the new color. (Note: that is *if* the element follows your palette; not all plugins and blocks do.)
7) **CSS Classes** Since not all blocks follow your Palette colors, you can add CSS classes to blocks. Most blocks have an Advanced section in the block settings, where you put the class. The classes to use are easy to remember, for example 'bg-primary-lighter' sets the background color to Primary Lighter (and also sets the text color to Text On Light).

## Install on WordPress
1) Unzip the exported file. Copy all files in the exported `styles/` folder into:
   `wp-content/themes/your-(child-)theme/styles/` (create the folder if needed)
2) In your dashboard, open **Site Editor → Styles → Browse styles**, and select a new style.
3) Recommended: open `styles/<YourTitle>-utilities.css`, copy the block of color variables like:
   ```css
   :root, .editor-styles-wrapper {
     --your-color-name: #hex;
   }
   ```
   Paste it into your theme’s `style.css`. You can assign your theme's color variables from the contrast‑tested palette values, for example:
   ```css
   :root, .editor-styles-wrapper {
     --base: var(--text-on-dark);
     --contrast: var(--text-on-light);
     --accent: var(--accent-light);
     --your-heading: var(--primary-dark);
     --your-button-background: var(--accent-darker);
     --your-button-text: var(--text-on-dark);
   }
   ```

## Using Generated Palettes in WordPress Site Editor

### Recommended Approach
Use WordPress's built-in color picker in the Site Editor instead of CSS utility classes.

**Why?**
- The Site Editor automatically resolves palette colors from the active variation
- CSS utility classes (`.bg-primary-light`, etc.) require `style.css` to be loaded
- The Site Editor iframe may not load `style.css` until after a hard refresh

### Best Practice
1. Apply variations using the [Theme Variation Display plugin](https://github.com/glerner/wpwm-theme-variation-display)
2. In Site Editor, use **Design > Colors > Background/Text** to select colors
3. WordPress will use `var(--wp--preset--color--primary-light)` which resolves correctly from the active variation

### Alternative: CSS Utility Classes
If you prefer using CSS classes in templates:
- Classes like `.bg-primary-light` work on the frontend
- In Site Editor, you may need to hard refresh (Ctrl+Shift+R) after applying a variation
- Or use **Advanced > Additional CSS Classes** and refresh the editor

## Page Builders

If your builder supports CSS variables, you can use the variable names shown at the top of styles/<YourTitle>-utilities.css (e.g., `var(--primary-light)` ).

### Elementor

If you're using a *block theme*, Elementor respects the global CSS variables WordPress makes (e.g., --wp--preset--color--primary-lighter) from the Color Palette Generator theme.json files. Elementor will display them in its color picker.

- Elementor stores global colors as CSS variables (e.g., --e-global-color-primary) in the active Kit.
- Respects colors defined in theme.json (e.g., --wp--preset--color--primary).
- Custom CSS variables prefixed with --e-global-color-* are recognized and appear in the color picker.

### Beaver Builder

While Beaver Builder does not directly import a color palette from a `theme.json` file, you can achieve similar results by defining custom CSS variables in your theme or child theme and then using them in Beaver Builder's color picker by entering the variable name (e.g., var(--css-var-name)) in the input field at the top of the color picker.

This method allows you to integrate colors defined in theme.json or styles.css into Beaver Builder's interface, ensuring consistency across your site.

You will find these variable names in your exported styles/<YourTitle>-utilities.css file.

Beaver Builder uses color variables in your pages/posts, so updating your color palette is easy and shows in your existing site.

- Automatically converts Global Colors into CSS variables like --fl-global-primary-color.
- Supports custom prefixes via the Prefix option (e.g., --my-prefix-primary-color).
- Allows direct input of CSS variables (e.g., var(--my-color)) in the color picker.

### Oxygen Builder
- Uses CSS variables extensively; all global colors and typography settings are stored as variables.
- Variables are scoped globally or per template, enabling dynamic, theme-wide changes.

### Bricks Builder
- Leverages CSS variables for global styles, including colors, fonts, and spacing.
- Supports integration with theme.json and allows defining custom variables in the theme.

These builders promote maintainability by centralizing color definitions, reducing reliance on hardcoded values in HTML or the database.

## Notes
- You only need one main text color in the palette. If your theme uses a second text color (most often for shadows or other decorative elements), define it in your CSS.
- Fonts are not changed by this tool; keep them in your `theme.json`, theme settings or `style.css`.
- Don’t worry about technical terms — just think of your existing color names as “your colors”, and map our tested palette variables to them for better readability.

For developer setup and advanced details, see: `docs/technical-details.md`.

## Additional Information

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
