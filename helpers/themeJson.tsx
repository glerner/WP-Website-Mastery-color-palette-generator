import { PaletteWithVariations } from './types';
import { AAA_MIN, LIGHTER_MAX_Y, DARKER_MIN_Y } from './config';
import { generateThemeVariations } from './generateThemeVariations';

// Calculate relative luminance for a color
const getLuminance = (hex: string): number => {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;

  const arr = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  const [rs, gs, bs] = arr;
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Validate base/contrast luminance relationship and band limits.
// Returns potentially swapped base/contrast and a list of issues.
export const validateBaseContrast = (
  baseHex: string,
  contrastHex: string
): { baseHex: string; contrastHex: string; swapped: boolean; issues: string[] } => {
  let swapped = false;
  const issues: string[] = [];
  let base = baseHex;
  let contrast = contrastHex;
  const baseLum = getLuminance(base);
  const contrastLum = getLuminance(contrast);
  if (baseLum < contrastLum) {
    swapped = true;
    const tmp = base; base = contrast; contrast = tmp;
    issues.push('Base and contrast appeared reversed for a light theme. They were swapped for export.');
  }
  // After swap check thresholds
  const bLum = getLuminance(base);
  const cLum = getLuminance(contrast);
  if (bLum < LIGHTER_MAX_Y) {
    issues.push(`Base should be near-white (Y >= ${LIGHTER_MAX_Y.toFixed(2)}). Consider choosing a lighter base.`);
  }
  if (cLum > DARKER_MIN_Y) {
    issues.push(`Contrast should be near-black (Y <= ${DARKER_MIN_Y.toFixed(2)}). Consider choosing a darker contrast.`);
  }
  return { baseHex: base, contrastHex: contrast, swapped, issues };
};

// Build a single WordPress style variation JSON (schema v2) from a palette
// - title: exact theme/variation title to use
// - fossil: optional theme.json-like object; we read settings.typography
// - palette entries include:
//   * base (#D6D2CE) and contrast (#1A1514) unless overridden by fossil.settings.color.palette
//   * for primary/secondary/tertiary/accent: lighter, light, base, dark, darker
//   * semantic colors: error, warning, success (single entries)
type Band = 'lighter' | 'light' | 'dark' | 'darker';
type SemanticPerScheme = { light: Band; dark: Band };
type SemanticBandSelection = { error: SemanticPerScheme; warning: SemanticPerScheme; success: SemanticPerScheme };

export const buildWpVariationJson = (
  palette: PaletteWithVariations,
  title: string,
  themeConfig?: any,
  opts?: { semanticBandSelection?: SemanticBandSelection; textOnDark?: string; textOnLight?: string }
): string => {
  const schema = typeof themeConfig?.$schema === 'string' ? themeConfig.$schema : 'https://schemas.wp.org/trunk/theme.json';
  let version: number = 3;
  const v = themeConfig?.version;
  if (typeof v === 'number' && Number.isFinite(v)) {
    version = v;
  } else if (typeof v === 'string') {
    const m = v.match(/^\d+(?:\.\d+)?$/);
    if (m) version = parseInt(v, 10);
  }

  // Extract base/contrast from theme config if available; otherwise defaults
  let baseColor = '#D6D2CE';
  let contrastColor = '#1A1514';
  const fossilPalette: Array<{ slug?: string; color?: string }> = themeConfig?.settings?.color?.palette || [];
  if (Array.isArray(fossilPalette) && fossilPalette.length) {
    for (const entry of fossilPalette) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.slug === 'base' && entry.color) baseColor = entry.color;
      if (entry.slug === 'contrast' && entry.color) contrastColor = entry.color;
    }
  }

  // Validate/swap base vs contrast if necessary (base should be lighter than contrast)
  const baseLum = getLuminance(baseColor);
  const contrastLum = getLuminance(contrastColor);
  if (baseLum < contrastLum) {
    // Likely a dark theme swap; auto-correct to keep downstream logic consistent
    const tmp = baseColor;
    baseColor = contrastColor;
    contrastColor = tmp;
    console.warn('Swapped base and contrast to ensure base is lighter than contrast for export.');
  }

  // Contrast checks are handled elsewhere in the app using configured thresholds.

  // We intentionally DO NOT import/export typography, gradients, or duotone in variation JSON
  // Only palette is included to keep style variations minimal and compatible.

  // Helper to map variations; prefer logical 'step' (lighter|light|dark|darker) when present
  // generateShades() yields items like { name: `${colorName}-${step}`, hex, step }
  // For export, we need to key by the step so lookups like map['lighter'] work.
  const byName = (arr: { name: string; hex: string; step?: string }[]) =>
    Object.fromEntries(
      arr.map((x) => [((x as any).step || x.name).toLowerCase(), x.hex])
    );

  /**
   * Collect all four variants for a family (lighter, light, dark, darker) as palette entries.
   * No filtering is applied here; we only marshal already-generated values.
   */
  const collectFamilyVariants = (
    key: 'primary' | 'secondary' | 'tertiary' | 'accent',
    label: string,
    labelShort: string
  ) => {
    const vars = (palette as any)[key]?.variations || [];
    const map = byName(vars);
    const out: Array<{ slug: string; color: string; name: string }> = [];
    const add = (slug: string, color?: string, name?: string) => {
      if (!color) return;
      out.push({ slug, color, name: name || label });
    };
    add(`${key}-lighter`, map['lighter'], `${labelShort} Lighter`);
    add(`${key}-light`, map['light'], `${labelShort} Light`);
    add(`${key}-dark`, map['dark'], `${labelShort} Dark`);
    add(`${key}-darker`, map['darker'], `${labelShort} Darker`);
    return out;
  };

  const paletteEntries: Array<{ slug: string; color: string; name: string }> = [];
  // Order: lighter(all), light(all), dark(all), darker(all)
  const familyOrder: Array<'primary' | 'secondary' | 'tertiary' | 'accent'> = ['primary','secondary','tertiary','accent'];
  const steps: Array<{ step: 'lighter'|'light'|'dark'|'darker'; labelSuffix: string }> = [
    { step: 'dark', labelSuffix: 'Dark' },
    { step: 'darker', labelSuffix: 'Darker' },
    { step: 'light', labelSuffix: 'Light' },
    { step: 'lighter', labelSuffix: 'Lighter' },
  ];
  const labels: Record<string, { full: string; short: string }> = {
    primary: { full: 'Primary', short: 'P' },
    secondary: { full: 'Secondary', short: 'S' },
    tertiary: { full: 'Tertiary', short: 'T' },
    accent: { full: 'Accent', short: 'A' },
  };
  const maps: Record<string, Record<string, string>> = {};
  familyOrder.forEach((k) => {
    const vars = (palette as any)[k]?.variations || [];
    maps[k] = byName(vars);
  });
  steps.forEach(({ step, labelSuffix }) => {
    familyOrder.forEach((k) => {
      const hex = maps[k]?.[step];
      if (hex) {
        const short = (labels as Record<string, { full: string; short: string }>)[k]?.short ?? (k?.[0]?.toUpperCase() ?? '');
        const slug = `${k}-${step}`;
        // Reference our custom CSS variables (defined in theme.json styles.css entries
        paletteEntries.push({ slug, color: `var(--${slug})`, name: `${short} ${labelSuffix}` });
      }
    });
  });
  // Semantic singles next – respect selected bands when available
  const pickSemantic = (ct: 'error' | 'warning' | 'success') => {
    const vars = ((palette as any)[ct]?.variations || []) as { name: string; hex: string; step?: string }[];
    const map = byName(vars);
    const sel = opts?.semanticBandSelection?.[ct];
    if (sel) {
      // Single exported value cannot be conditional; use dark for error/success, light for warning
      const preferred: Band = ct === 'warning' ? sel.light : sel.dark;
      const fromSel = map[preferred];
      if (fromSel) return fromSel;
    }
    // Fallback: prefer dark for error/success, light for warning, then others, then base hex
    if (ct === 'warning') {
      return map['light'] ?? map['lighter'] ?? (palette as any)[ct]?.hex ?? map['dark'] ?? map['darker'] ?? (palette as any)[ct]?.hex;
    }
    return map['dark'] ?? map['darker'] ?? map['light'] ?? map['lighter'] ?? (palette as any)[ct]?.hex;
  };
  // Semantics: reference banded dark variables; 'warning' semantic is exported as 'notice'
  paletteEntries.push(
    { slug: 'error', color: 'var(--error-dark)', name: 'Error' },
    { slug: 'notice', color: 'var(--notice-dark)', name: 'Notice' },
    { slug: 'success', color: 'var(--success-dark)', name: 'Success' },
  );
  // Also expose light/dark variants as separate slugs for semantic colors
  paletteEntries.push(
    { slug: 'error-light', color: 'var(--error-light)', name: 'Error Light' },
    { slug: 'error-dark', color: 'var(--error-dark)', name: 'Error Dark' },
    { slug: 'notice-light', color: 'var(--notice-light)', name: 'Notice Light' },
    { slug: 'notice-dark', color: 'var(--notice-dark)', name: 'Notice Dark' },
    { slug: 'success-light', color: 'var(--success-light)', name: 'Success Light' },
    { slug: 'success-dark', color: 'var(--success-dark)', name: 'Success Dark' },
  );
  // Then text on dark (base) and text on light (contrast)
  paletteEntries.push(
    { slug: 'base', color: 'var(--base)', name: 'Text on Dark' },
    { slug: 'contrast', color: 'var(--contrast)', name: 'Text on Light' },
  );
  // Finally transparent convenience color
  paletteEntries.push({ slug: 'transparent', color: 'transparent', name: 'Transparent' });

  // Build a one-line :root CSS string for this variation with concrete hex values
  const buildOneLineCss = () => {
    const families: Array<'primary'|'secondary'|'tertiary'|'accent'> = ['primary','secondary','tertiary','accent'];
    const stepsList: Array<'lighter'|'light'|'dark'|'darker'> = ['lighter','light','dark','darker'];
    const tokDark = (opts?.textOnDark && /^#[0-9a-f]{6}$/i.test(opts.textOnDark)) ? opts!.textOnDark! : '#FFFFF0';
    const tokLight = (opts?.textOnLight && /^#[0-9a-f]{6}$/i.test(opts.textOnLight)) ? opts!.textOnLight! : '#1B2227';
    const pieces: string[] = [];
    pieces.push(`--text-on-dark: ${tokDark}`);
    pieces.push(`--text-on-light: ${tokLight}`);
    // family steps
    families.forEach((k) => {
      const vars = ((palette as any)[k]?.variations || []) as { name: string; hex: string; step?: string }[];
      const map = byName(vars);
      stepsList.forEach((st) => {
        const hex = map[st];
        if (hex) pieces.push(`--${k}-${st}: ${hex}`);
      });
    });
    // semantics light/dark
    const mkLD = (ct: 'error'|'warning'|'success') => {
      const vars = ((palette as any)[ct]?.variations || []) as { name: string; hex: string; step?: string }[];
      const map = byName(vars);
      const sel = opts?.semanticBandSelection?.[ct];
      const light = sel?.light ? (map[sel.light] ?? undefined) : (map['light'] ?? map['lighter'] ?? undefined);
      const dark = sel?.dark ? (map[sel.dark] ?? undefined) : (map['dark'] ?? map['darker'] ?? undefined);
      return { light, dark } as { light?: string; dark?: string };
    };
    const err = mkLD('error');
    const noti = mkLD('warning');
    const succ = mkLD('success');
    if (err.light) pieces.push(`--error-light: ${err.light}`);
    if (err.dark) pieces.push(`--error-dark: ${err.dark}`);
    if (noti.light) pieces.push(`--notice-light: ${noti.light}`);
    if (noti.dark) pieces.push(`--notice-dark: ${noti.dark}`);
    if (succ.light) pieces.push(`--success-light: ${succ.light}`);
    if (succ.dark) pieces.push(`--success-dark: ${succ.dark}`);
    // Note: No fallback semantic single variables (e.g., --error) are emitted here by design.
    // base/contrast variables
    pieces.push(`--base: ${baseColor}`);
    pieces.push(`--contrast: ${contrastColor}`);
    return `:root{ ${pieces.join('; ')}; }`;
  };

  const out: any = {
    $schema: schema,
    version,
    title,
    settings: {
      color: {
        palette: paletteEntries,
      },
    },
    styles: {
      css: buildOneLineCss(),
    },
  };
  // No typography, gradients, or duotone are exported here by design.

  // Validate and sanitize the structure to match expected WordPress theme.json shape
  const sanitize = (input: any) => {
    const warn = (msg: string) => console.warn(`[themeJson] ${msg}`);
    const allowedTop = new Set(['$schema', 'version', 'title', 'settings', 'styles']);
    const allowedSettings = new Set(['color']);
    const allowedStyles = new Set(['css']);
    const allowedColor = new Set(['palette']);

    // Top-level
    const top: any = {};
    for (const k of Object.keys(input || {})) {
      if (!allowedTop.has(k)) warn(`Unexpected top-level key '${k}' was dropped.`);
    }
    top.$schema = input.$schema;
    top.version = input.version;
    top.title = input.title;

    // settings
    top.settings = top.settings || {};
    const inSettings = (input && input.settings) || {};
    for (const k of Object.keys(inSettings)) {
      if (!allowedSettings.has(k)) warn(`Unexpected settings key '${k}' was dropped.`);
    }

    // settings.color
    const inColor = (inSettings && inSettings.color) || {};
    const color: any = {};
    for (const k of Object.keys(inColor)) {
      if (!allowedColor.has(k)) warn(`Unexpected settings.color key '${k}' was dropped.`);
    }
    color.palette = Array.isArray(inColor.palette) ? inColor.palette : (input?.settings?.color?.palette || []);
    if (!Array.isArray(color.palette)) {
      warn('settings.color.palette is missing or invalid; replacing with empty array.');
      color.palette = [];
    }
    // gradients/duotone are intentionally not included in variations

    const outSettings: any = {};
    outSettings.color = color;
    // typography is intentionally not included in variations
    top.settings = outSettings;

    // styles
    const inStyles = (input && input.styles) || {};
    const outStyles: any = {};
    for (const k of Object.keys(inStyles)) {
      if (!allowedStyles.has(k)) warn(`Unexpected styles key '${k}' was dropped.`);
    }
    if (typeof inStyles.css === 'string') {
      outStyles.css = inStyles.css;
    }
    if (Object.keys(outStyles).length) {
      top.styles = outStyles;
    }

    return top;
  };

  const cleaned = sanitize(out);
  return JSON.stringify(cleaned, null, 2);
};

// Calculate contrast ratio between two colors
const getContrastRatio = (color1: string, color2: string): number => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

// Check if a color meets AA contrast requirements against both black AND white
const meetsContrastRequirements = (hex: string): boolean => {
  const contrastWithBlack = getContrastRatio(hex, '#000000');
  const contrastWithWhite = getContrastRatio(hex, '#ffffff');
  const minContrast = AAA_MIN; // use project-configured threshold

  // Require AA contrast against BOTH black AND white to filter out problematic middle-luminance colors
  return contrastWithBlack >= minContrast && contrastWithWhite >= minContrast;
};

export const generateThemeJson = (palette: PaletteWithVariations): string => {
  const themeVariations = generateThemeVariations(palette);

  // Filter base colors that meet contrast requirements
  const baseColors = [
    { key: 'primary', color: palette.primary, slug: 'primary', name: 'Primary' },
    { key: 'secondary', color: palette.secondary, slug: 'secondary', name: 'Secondary' },
    { key: 'tertiary', color: palette.tertiary, slug: 'tertiary', name: 'Tertiary' },
    { key: 'accent', color: palette.accent, slug: 'accent', name: 'Accent' },
  ].filter(({ color }) => meetsContrastRequirements(color.hex));

  // Create palette entries for base colors and their variations
  const paletteEntries = [];

  // Add filtered base colors
  baseColors.forEach(({ slug, color, name }) => {
    paletteEntries.push({
      slug,
      color: color.hex,
      name,
    });
  });

  // Add variations for filtered base colors
  baseColors.forEach(({ key, color, name }) => {
    color.variations.forEach((v: any) => {
      paletteEntries.push({
        slug: `${key}-${v.name}`,
        color: v.hex,
        name: `${name} ${v.name}`,
      });
    });
  });

  // Add semantic colors (single colors only, no variations)
  paletteEntries.push(
    {
      slug: 'error',
      color: palette.error.hex,
      name: 'Error',
    },
    {
      slug: 'notice',
      color: palette.warning.hex,
      name: 'Notice',
    },
    {
      slug: 'success',
      color: palette.success.hex,
      name: 'Success',
    }
  );

  const theme = {
    $schema: 'https://schemas.wp.org/trunk/theme.json',
    version: 3,
    title: 'Generated Color Palette',
    settings: {
      color: {
        palette: paletteEntries,
      },
    },
    styles: {
      color: {
        background: 'var(--wp--preset--color--background)',
        text: 'var(--wp--preset--color--foreground)',
      },
    },
    styleVariations: themeVariations.map((variation) => {
      // Filter variation colors that meet contrast requirements
      const filteredVariationColors = baseColors.map(({ slug, name }) => {
        const variationColor = (variation.palette as any)[slug.replace('-', '')];
        return {
          slug,
          color: variationColor.hex,
          name,
        };
      });

      return {
        name: variation.name,
        title: `${variation.name} (${variation.description})`,
        settings: {
          color: {
            palette: filteredVariationColors,
          },
        },
        styles: {
          color: {
            background: 'var(--wp--preset--color--background)',
            text: 'var(--wp--preset--color--foreground)',
          },
          elements: {
            button: {
              color: {
                background: 'var(--wp--preset--color--primary)',
                text: 'var(--wp--preset--color--primary-foreground)',
              },
            },
            link: {
              color: {
                text: 'var(--wp--preset--color--primary)',
              },
            },
          },
        },
      };
    }),
  };

  return JSON.stringify(theme, null, 2);
};
