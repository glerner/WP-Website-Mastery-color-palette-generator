import { PaletteWithVariations } from './types';
import { ensureAAAContrast } from './ensureAAAContrast';
import { NEAR_WHITE_HEX, NEAR_BLACK_HEX } from './config';

type Band = 'lighter' | 'light' | 'dark' | 'darker';
type SemanticPerScheme = { light: Band; dark: Band };
type SemanticBandSelection = { error: SemanticPerScheme; warning: SemanticPerScheme; success: SemanticPerScheme };

export const generateCssClasses = (
  palette: PaletteWithVariations,
  semanticBandSelection?: SemanticBandSelection
): string => {
  let css = '/* ';
  css += 'NOTE: For developer use only. WordPress does not load these generated CSS files by default.\n';
  css += "  Only your (child) theme's main style.css is used by WordPress automatically.\n";
  css += '  You may copy/paste variables and classes from this file into your child theme\'s style.css if desired.\n';
  css += 'Also, you can export these to any other program with colors, e.g. Figma\n';
  css += '*/\n';
  css += '/* Color Palette CSS Classes */\n';
  css += '/* Generated with optimal contrast ratios */\n';
  css += '/* Only includes adjusted colors with proper contrast optimization */\n\n';

  // WordPress preset color variables on :root
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const appendVar = (name: string, value: string) => `  --wp--preset--color--${name}: ${value};\n`;
  const stepCounterpart = (step: string): string | null => {
    if (step === 'lighter') return 'darker';
    if (step === 'light') return 'dark';
    if (step === 'dark') return 'light';
    if (step === 'darker') return 'lighter';
    return null; // e.g., base or unknown
  };
  const lightTextAlias = 'var(--text-on-light)';
  const darkTextAlias = 'var(--text-on-dark)';

  // Emit a visible warning into the generated CSS output
  css += '/* IMPORTANT: Do NOT paste the :root block below into your theme\'s style.css. */\n';
  css += '/* WordPress automatically generates wp--preset--color variables from theme.json. */\n';
  css += '/* Do not overwrite the variables that WordPress generates. */\n';
  css += ':root{\n';
  // Base colors: ONLY export variations (contrast-adjusted). Do not export base color vars.
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((ct) => {
    (palette as any)[ct].variations.forEach((v: { name: string; hex: string }) => {
      // Normalize variation step name to avoid doubled family in slug, e.g.,
      // "primary-primary-lighter" -> "primary-lighter"
      const varSlug = toSlug(v.name);
      const step = varSlug.startsWith(`${ct}-`) ? varSlug.slice(ct.length + 1) : varSlug;
      const slug = `${ct}-${step}`;
      css += appendVar(slug, v.hex);
      // No on-* variables exported; use utilities to set readable text color per use site
    });
  });
  // Semantic: export exactly ONE preset var per semantic, choosing based on provided selection when available
  const pickSemanticHex = (ct: 'error' | 'warning' | 'success') => {
    const v = (palette as any)[ct].variations as { name: string; hex: string }[];
    // Normalize keys to step-only (strip leading family if present)
    const byStep = Object.fromEntries(
      v.map((x) => {
        const slug = toSlug(x.name);
        const step = slug.startsWith(`${ct}-`) ? slug.slice(ct.length + 1) : slug;
        return [step, x.hex];
      })
    ) as Record<string, string>;
    const sel = semanticBandSelection?.[ct];
    if (sel) {
      // theme.json style single var can't be conditional; pick dark for error/success, light for warning by convention
      const preferred: Band = ct === 'warning' ? sel.light : sel.dark;
      const picked = byStep[preferred];
      if (picked) return picked;
    }
    // Fallback heuristics when selection missing
    if (ct === 'warning') {
      const baseHex = (palette as any)[ct].hex as string | undefined;
      return byStep['light'] ?? byStep['lighter'] ?? baseHex ?? byStep['dark'] ?? byStep['darker'] ?? null;
    }
    return byStep['dark'] ?? byStep['darker'] ?? byStep['light'] ?? byStep['lighter'] ?? null;
  };
  // For light/dark output, compute separate semantic choices
  const pickSemanticHexLD = (ct: 'error' | 'warning' | 'success') => {
    const v = (palette as any)[ct].variations as { name: string; hex: string }[];
    const byStep = Object.fromEntries(
      v.map((x) => {
        const slug = toSlug(x.name);
        const step = slug.startsWith(`${ct}-`) ? slug.slice(ct.length + 1) : slug;
        return [step, x.hex];
      })
    ) as Record<string, string>;
    const baseHex = (palette as any)[ct].hex as string | undefined;
    const sel = semanticBandSelection?.[ct];
    const lightChoice = sel?.light ? (byStep[sel.light] ?? null) : (byStep['light'] ?? byStep['lighter'] ?? baseHex ?? null);
    const darkChoice = sel?.dark ? (byStep[sel.dark] ?? null) : (byStep['dark'] ?? byStep['darker'] ?? baseHex ?? null);
    return { lightChoice, darkChoice } as { lightChoice: string | null; darkChoice: string | null };
  };
  (['error', 'warning', 'success'] as const).forEach((ct) => {
    const chosen = pickSemanticHex(ct);
    if (chosen) {
      css += appendVar(ct, chosen);
      // No on-* variables for semantics either
    }
  });
  css += '}\n';
  css += '/* Close WordPress preset :root block (do not paste into style.css) */';
  css += '\n\n\n\n';

  // these are not WordPress presets; safe to copy to your style.css if needed
  css += '/* these are *not* WordPress presets, safe to copy to your style.css as needed */\n\n';
  css += ':root {\n';
  css += `  color-scheme: light dark;\n`;
  css += `  --text-on-dark: ${NEAR_WHITE_HEX};        /* near-white for dark backgrounds */\n`;
  css += `  --text-on-light: ${NEAR_BLACK_HEX};       /* near-black for light backgrounds */\n`;
  css += '}\n\n';

  // Generate classes for main color variations (excluding base colors)
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];

    // Only variation classes for main colors (no base color classes)
    // Build a quick map of available steps for counterpart lookups
    const stepsMap = new Set(
      colorData.variations.map((v: { name: string }) => {
        const vs = toSlug(v.name);
        return vs.startsWith(`${colorType}-`) ? vs.slice(colorType.length + 1) : vs;
      })
    );

    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      // Use normalized step slug (lowercase) for class names
      const varSlug = toSlug(variation.name);
      const step = varSlug.startsWith(`${colorType}-`) ? varSlug.slice(colorType.length + 1) : varSlug;
      const slug = `${colorType}-${step}`;
      const counterpart = stepCounterpart(step);
      const hasCounterpart = counterpart ? stepsMap.has(counterpart) : false;

      // Merge .bg-* and .has-*-background-color into a single rule
      css += `.bg-${colorType}-${step}, .has-${slug}-background-color {\n`;
      if (hasCounterpart) {
        css += `  background-color: light-dark(var(--wp--preset--color--${slug}), var(--wp--preset--color--${colorType}-${counterpart}));\n`;
        css += `  color: light-dark(${lightTextAlias}, ${darkTextAlias});\n`;
      } else {
        // Fallback to single value when no clear counterpart exists
        css += `  background-color: var(--wp--preset--color--${slug});\n`;
        // Use contrast-based utility for single mode as a fallback
        const { textColor } = ensureAAAContrast(variation.hex);
        const alias = textColor.toUpperCase() === NEAR_WHITE_HEX.toUpperCase() ? darkTextAlias : lightTextAlias;
        css += `  color: ${alias};\n`;
      }
      css += `}\n\n`;
    });
  });

  // Generate classes for semantic colors (include base + variations)
  ['error', 'warning', 'success'].forEach((colorType) => {
    const { lightChoice, darkChoice } = pickSemanticHexLD(colorType as 'error' | 'warning' | 'success');
    const chosenFallback = pickSemanticHex(colorType as 'error' | 'warning' | 'success') as string | null;
    const lightHex = lightChoice ?? chosenFallback ?? NEAR_WHITE_HEX;
    const darkHex = darkChoice ?? chosenFallback ?? NEAR_BLACK_HEX;
    css += `.bg-${colorType}, .has-${colorType}-background-color {\n`;
    css += `  background-color: light-dark(${lightHex}, ${darkHex});\n`;
    css += `  color: light-dark(${lightTextAlias}, ${darkTextAlias});\n`;
    css += `}\n\n`;
  });

  // Add utility classes for text colors only
  css += '/* Utility classes for text colors only */\n';

  // Text classes for main color variations (excluding base colors)
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];

    // Set up available steps map again for lookups
    const stepsMap = new Set(
      colorData.variations.map((v: { name: string }) => {
        const vs = toSlug(v.name);
        return vs.startsWith(`${colorType}-`) ? vs.slice(colorType.length + 1) : vs;
      })
    );

    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      const varSlug = toSlug(variation.name);
      const step = varSlug.startsWith(`${colorType}-`) ? varSlug.slice(colorType.length + 1) : varSlug;
      const slug = `${colorType}-${step}`;
      const counterpart = stepCounterpart(step);
      const hasCounterpart = counterpart ? stepsMap.has(counterpart) : false;
      css += `.text-${colorType}-${step} {\n`;
      if (hasCounterpart) {
        css += `  color: light-dark(var(--wp--preset--color--${slug}), var(--wp--preset--color--${colorType}-${counterpart}));\n`;
      } else {
        css += `  color: var(--wp--preset--color--${slug});\n`;
      }
      css += `}\n\n`;
    });
  });

  // Text classes for semantic colors (base only; no variants to avoid duplicates)
  ['error', 'warning', 'success'].forEach((colorType) => {
    const { lightChoice, darkChoice } = pickSemanticHexLD(colorType as 'error' | 'warning' | 'success');
    const chosenFallback = pickSemanticHex(colorType as 'error' | 'warning' | 'success') as string | null;
    const lightHex = lightChoice ?? chosenFallback ?? NEAR_WHITE_HEX;
    const darkHex = darkChoice ?? chosenFallback ?? NEAR_BLACK_HEX;
    css += `.text-${colorType} {\n`;
    css += `  color: light-dark(${lightHex}, ${darkHex});\n`;
    css += `}\n\n`;
  });

  return css;
};

export const generateFilenameSuffix = (palette: PaletteWithVariations): string => {
  const hexValues = [
    palette.primary.hex.replace('#', ''),
    palette.secondary.hex.replace('#', ''),
    palette.tertiary.hex.replace('#', ''),
    palette.accent.hex.replace('#', ''),
    palette.error.hex.replace('#', ''),
    palette.warning.hex.replace('#', ''),
    palette.success.hex.replace('#', ''),
  ];

  return hexValues.join('-');
};
