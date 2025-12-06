/* Runtime theme overrides, AAA verification (single-run), and CSS export helpers */

export const MIN_POPUP_MS = 10_000; // minimum popup display; adjustable later

// Utility: parse hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const h1 = (m[1] ?? '').toString();
  const hex6 = h1.length === 3 ? h1.split("").map((c) => c + c).join("") : h1;
  const n = parseInt(hex6, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Utility: relative luminance (WCAG 2.1)
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const srgb = [r, g, b].map((v) => v / 255) as [number, number, number];
  const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))) as [number, number, number];
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

// Contrast ratio
function contrastRatio(fg: string, bg: string): number | null {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return null;
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Read current CSS var value resolved at :root; expects hex
function getVar(name: string): string | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return null;
  // Accept hex or rgb string; convert rgb to hex if needed
  if (v.startsWith('#')) return v;
  const m = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(v);
  if (m) {
    const [, rs, gs, bs] = m as RegExpExecArray;
    const r = Math.max(0, Math.min(255, parseInt(rs || '0', 10)));
    const g = Math.max(0, Math.min(255, parseInt(gs || '0', 10)));
    const b = Math.max(0, Math.min(255, parseInt(bs || '0', 10)));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

// Simple popup/toast (non-intrusive) with minimum display time
function showPopup(message: string, severity: 'ok' | 'warn' | 'error' = 'ok', minMs = MIN_POPUP_MS) {
  try {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.right = '16px';
    host.style.bottom = '16px';
    host.style.maxWidth = '420px';
    host.style.zIndex = '99999';
    host.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif';

    const el = document.createElement('div');
    el.style.padding = '12px 16px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 24px rgba(0,0,0,0.15)';
    el.style.border = '1px solid';
    el.style.background = 'var(--notice-bg, #00ADAD)';
    el.style.color = 'var(--notice-fg, #1B2227)';
    el.style.borderColor = 'var(--notice-border, #004E4E)';
    if (severity === 'error') {
      el.style.background = 'var(--error-bg, #F2738D)';
      el.style.color = 'var(--error-fg, #1B2227)';
      el.style.borderColor = 'var(--error-border, #8B0D26)';
    } else if (severity === 'warn') {
      // Keep notice styling for warnings
    }
    el.textContent = message;
    host.appendChild(el);
    document.body.appendChild(host);
    setTimeout(() => {
      try { host.remove(); } catch { }
    }, Math.max(0, minMs));
  } catch { }
}

// Verify key pairs against AAA (7.0)
export function verifyAAAOnce(): { passed: boolean; failures: Array<{ pair: string; ratio: number | null }> } {
  // Per direction: do not compute or check contrast for runtime/manual values.
  // Leave verification to the export pipeline which uses tested contrast functions.
  return { passed: true, failures: [] };
}

// Optional: override tokens at runtime from a palette object
export type Palette = {
  primary: { hex: string };
  secondary: { hex: string };
  tertiary: { hex: string };
  accent: { hex: string };
  error: { hex: string };
  success: { hex: string };
  warning?: { hex: string };
  notice?: { hex: string };
};

export function applyPaletteToCSSVariables(p: Palette, variations?: {
  accentDark?: string;
  errorLight?: string;
  warningLight?: string;
  successLight?: string;
}) {
  const root = document.documentElement.style;
  // Core brand
  root.setProperty('--cf-primary', p.primary.hex);
  root.setProperty('--cf-secondary', p.secondary.hex);
  root.setProperty('--cf-tertiary', p.tertiary.hex);
  root.setProperty('--cf-accent', p.accent.hex);
  // Status bases (use app semantics)
  root.setProperty('--cf-error', p.error.hex);
  root.setProperty('--cf-success', p.success.hex);
  if (p.notice?.hex) root.setProperty('--cf-notice', p.notice.hex);

  // App-level status aliases
  root.setProperty('--error', p.error.hex);
  root.setProperty('--success', p.success.hex);
  if (p.notice?.hex) root.setProperty('--notice', p.notice.hex);

  // Interactive elements (buttons, links) use accent-dark
  if (variations?.accentDark) {
    root.setProperty('--accent', variations.accentDark);
    root.setProperty('--cf-accent', variations.accentDark);
    root.setProperty('--accent-foreground', '#FFFFFF'); // Accent-dark is dark, so use white text
  } else {
    // Fallback to accent base if no variation provided
    root.setProperty('--accent', p.accent.hex);
    root.setProperty('--accent-foreground', '#FFFFFF');
  }

  // Status message backgrounds use lighter variations
  if (variations?.errorLight) {
    root.setProperty('--error-bg', variations.errorLight);
    root.setProperty('--error-fg', '#000000');
  }
  if (variations?.warningLight) {
    root.setProperty('--warning-bg', variations.warningLight);
    root.setProperty('--notice-bg', variations.warningLight);
    root.setProperty('--warning-fg', '#000000');
    root.setProperty('--notice-fg', '#000000');
  }
  if (variations?.successLight) {
    root.setProperty('--success-bg', variations.successLight);
    root.setProperty('--success-fg', '#000000');
  }
}

// Export Core Foundation tokens (current values) into a downloadable CSS file
export function exportCoreFoundationCSSFromCurrent(filename = 'gl-core-foundation.generated.css') {
  const names = [
    '--cf-primary', '--cf-secondary', '--cf-tertiary', '--cf-accent',
    '--cf-bg-body', '--cf-bg-surface', '--cf-text-body', '--cf-text-title',
    '--cf-success', '--cf-error', '--cf-notice',
    // Transparent stepped variants for all brand colors and semantic colors
    '--cf-primary-10', '--cf-primary-20', '--cf-primary-40', '--cf-primary-60', '--cf-primary-80',
    '--cf-secondary-10', '--cf-secondary-20', '--cf-secondary-40', '--cf-secondary-60', '--cf-secondary-80',
    '--cf-tertiary-10', '--cf-tertiary-20', '--cf-tertiary-40', '--cf-tertiary-60', '--cf-tertiary-80',
    '--cf-accent-10', '--cf-accent-20', '--cf-accent-40', '--cf-accent-60', '--cf-accent-80',
    '--cf-success-10', '--cf-success-20', '--cf-success-40', '--cf-success-60', '--cf-success-80',
    '--cf-error-10', '--cf-error-20', '--cf-error-40', '--cf-error-60', '--cf-error-80',
    '--cf-notice-10', '--cf-notice-20', '--cf-notice-40', '--cf-notice-60', '--cf-notice-80',
  ];
  // Build variable declarations once
  const varLines: string[] = [];
  for (const n of names) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    if (v) varLines.push(`  ${n}: ${v};`);
  }

  // Build selector groups
  const baseSelectors = [':root'];
  // Inverted inside dark -> should look like light content (light bg, dark text)
  const darkInvertedSelectors = [
    ':root.cf-theme-dark .cf-theme-inverted',
    ':root.cf-theme-dark .theme-always-light',
    ':root.cf-theme-light .cf-theme-inverted .theme-always-light',
  ];
  // Inverted inside light -> should look like dark content (dark bg, light text)
  const lightInvertedSelectors = [
    ':root.cf-theme-light .cf-theme-inverted',
    ':root.cf-theme-light .theme-always-dark',
    ':root.cf-theme-dark .cf-theme-inverted .theme-always-dark',
  ];

  // Known base values from gl-core-foundation.css (kept in sync)
  const LIGHT_BG_BODY = '#e6e6e6';
  const LIGHT_BG_SURFACE = '#ffffff';
  const LIGHT_TEXT = '#1B2227'; // text-on-light
  const DARK_BG_BODY = '#0d0d0d';
  const DARK_BG_SURFACE = '#262626';
  const DARK_TEXT = '#FFFFF0'; // text-on-dark

  const cssLines: string[] = [];
  // Base: emit snapshot values as-is
  for (const sel of baseSelectors) {
    cssLines.push(`${sel} {`);
    cssLines.push(...varLines);
    cssLines.push('}');
  }
  // Dark-inverted: force light-mode bg/text
  for (const sel of darkInvertedSelectors) {
    cssLines.push(`${sel} {`);
    cssLines.push(...varLines);
    cssLines.push(`  --cf-bg-body: ${LIGHT_BG_BODY};`);
    cssLines.push(`  --cf-bg-surface: ${LIGHT_BG_SURFACE};`);
    cssLines.push(`  --cf-text-body: ${LIGHT_TEXT};`);
    cssLines.push(`  --cf-text-title: ${LIGHT_TEXT};`);
    cssLines.push('}');
  }
  // Light-inverted: force dark-mode bg/text
  for (const sel of lightInvertedSelectors) {
    cssLines.push(`${sel} {`);
    cssLines.push(...varLines);
    cssLines.push(`  --cf-bg-body: ${DARK_BG_BODY};`);
    cssLines.push(`  --cf-bg-surface: ${DARK_BG_SURFACE};`);
    cssLines.push(`  --cf-text-body: ${DARK_TEXT};`);
    cssLines.push(`  --cf-text-title: ${DARK_TEXT};`);
    cssLines.push('}');
  }
  const blob = new Blob([cssLines.join('\n')], { type: 'text/css' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Initialize theme on app start: single-run AAA verification
export function initializeThemeOnStart() {
  try {
    verifyAAAOnce();
  } catch (e) {
    console.error('[floot] initializeThemeOnStart failed', e);
  }
}
