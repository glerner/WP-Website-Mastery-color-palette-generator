# Technical Details (Developers)

This document covers environment variables, build scripts, deep WordPress integration details, and helper snippets.

## Environment and Configuration

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

Important: Do NOT put secret API keys in `NEXT_PUBLIC_*` variables; they are exposed to the browser.

---

## API Keys (Secrets)

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

## Development Workflow

- Color math runs in the browser for instant feedback (see `helpers/colorUtils.tsx`).
- Thresholds and ranges are centralized in `helpers/config.ts` (e.g., `AAA_MIN`, `LIGHTER_MIN_Y`).
- Server-side tasks (if added) should handle secrets and heavy operations.

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

## Exporting WordPress Theme Variations (Deep Dive)

The app exports palettes as WordPress `theme.json` Style Variations.

- Single archive (ZIP) containing multiple variations.
- Variations permute primary/secondary/tertiary (and optionally accent) roles.
- Export options: 6 variations (rotate P/S/T; Accent fixed) or 24 variations (rotate P/S/T/A).
- Copy the `styles/*.json` and the shared utilities CSS into your theme’s `styles/` folder.
- Variables like `--primary-dark`, `--error-light` are defined via each variation JSON’s `styles.css` block.

---

## Block Editor Sidebar Swatches (Admin Chrome)

Your exported `theme.json` assigns colors not with Hex color numbers (or HSL or RGB) but with CSS variables (e.g., `"color": "var(--accent-darker)"` ). The editor canvas resolves them when variables are scoped to both `:root` and `.editor-styles-wrapper`. The sidebar color picker UI (swatches) lives in the admin document and doesn’t inherit by default.

Use the provided helper from this repo to include variables and presets into the admin chrome:

- Copy `inc/fse-editor-chrome-styles.php` into your active (child) theme’s `inc/` folder.
- In your theme `functions.php` add:

```php
require_once get_stylesheet_directory() . '/inc/fse-editor-chrome-styles.php';
add_action('enqueue_block_editor_assets', 'fse_enqueue_block_editor_admin_chrome_styles', 20);
```

Notes:
- The exporter emits variables to both `:root` and `.editor-styles-wrapper` so the editor canvas resolves them.
- The helper includes resolved globals (variables + presets) for the active Style Variation and bridges where needed so swatches match.

---

## Visitor Light/Dark Toggle (WordPress)

If your exported styles use the CSS `light-dark()` function, you can offer a Light/Dark/Auto toggle that plays nicely with system preference and avoids flashes.

Included helper and script:

- `inc/theme-color-scheme-toggle.php`
- `assets/js/color-scheme-toggle.js`

### Steps

1) Copy files into your theme

- `inc/theme-color-scheme-toggle.php` → your theme’s `inc/`
- `assets/js/color-scheme-toggle.js` → e.g. `assets/js/color-scheme-toggle.js`

2) Wire it in `functions.php`

```php
// add to functions.php of your (child) theme
require get_stylesheet_directory() . '/inc/theme-color-scheme-toggle.php';
add_action( 'wp_head', 'wpwm_output_initial_color_scheme', 0 );
add_action( 'wp_enqueue_scripts', 'wpwm_enqueue_theme_color_scheme_toggle' );
add_filter( 'body_class', 'wpwm_body_class_color_scheme' ); // optional
```

If you put the JS elsewhere, filter its URI:

```php
add_filter( 'wpwm_color_scheme_toggle_src', function( $src ){
  return get_stylesheet_directory_uri() . '/path/to/your/color-scheme-toggle.js';
});
```

3) Minimal CSS hooks (theme-level)

```css
:root { color-scheme: light dark; }
html[data-color-scheme="light"] { color-scheme: light; }
html[data-color-scheme="dark"]  { color-scheme: dark; }
```

Your variables can use `light-dark(lightValue, darkValue)`, e.g.:

```css
:root {
  --bg: light-dark(white, #0b0b0c);
  --fg: light-dark(#0c0c0d, white);
}
body { background: var(--bg); color: var(--fg); }
```

4) Add a menu item as the toggle

Create a custom link in your main menu and add the CSS class `js-theme-toggle`. The script upgrades it into a cyclic toggle (Auto → Dark → Light → Auto) and persists the choice.

---

## Notice/Message Styling (Palette-Aware)

To display informational messages using the current palette colors, use the `.noticeInline` CSS class from the component's module CSS.

### CSS Variables (Use These)

The app dynamically sets these variables on `:root` based on the generated palette:

| Variable | Purpose |
|----------|---------|
| `--notice-bg` | Background color (from warning-light variation) |
| `--notice-fg` | Foreground/text color (auto-calculated for contrast) |
| `--notice-border` | Border color (derived from bg) |

### Usage

1. **In a component with CSS modules**, add to the module CSS:

```css
.noticeInline {
  background: var(--notice-bg);
  color: var(--notice-fg);
  border: 1px solid var(--notice-border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: var(--cf-text-s);
  margin: 4px 0;
}
```

2. **In JSX**, use the class:

```tsx
<div className={styles.noticeInline}>
  Your message here.
</div>
```

### Do NOT Use

These legacy/duplicate variables exist but should be avoided/deprecated:

- `--warning-bg`, `--warning-fg`, `--warning-border` — duplicates of notice
- `--cf-notice`, `--notice` — base color only, no bg/fg/border
- Inline styles with hardcoded colors or `noticeBgHex` props

### Where Variables Are Set

`generator.tsx` sets `--notice-bg`, `--notice-fg`, `--notice-border` (and error/success equivalents) in a `useEffect` that runs when `paletteWithVariations` changes. See the `setTriplet()` helper around line 1896.

### Text Color Selection Algorithm

The `ensureAAAContrast` function (`helpers/ensureAAAContrast.tsx`) uses **actual contrast ratio calculations** against `NEAR_BLACK` and `NEAR_WHITE`, not a simple luminance threshold. This is the correct algorithm for choosing text color.

The `chooseForeground` function (`helpers/themeRuntime.ts`) applies the same contrast-ratio-based approach but uses the user's `textOnLight`/`textOnDark` values. When those values are invalid (not yet loaded, or user is modifying them in the Starting Colors tab), it falls back to `NEAR_BLACK`/`NEAR_WHITE`.

**Why contrast ratio, not luminance threshold?**

A simple `Y > 0.5` luminance check fails for mid-tone backgrounds (e.g., yellow `#C3BA3C` with Y ≈ 0.48). Contrast ratio comparison correctly picks the text color that provides better readability regardless of where the background falls on the luminance scale.

---

## Troubleshooting (Dev)

- Port busy: run `npm run dev -- --port 5174` and open http://localhost:5174
- Env not applied: confirm values in `.env.local` and restart `npm run dev`.
- Type errors: check `helpers/ensureAAAContrast.tsx`, `helpers/colorUtils.tsx`, `helpers/config.ts` for consistent imports/exports.
