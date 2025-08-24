import { PaletteWithVariations } from './types';
import { ensureAAAContrast } from './ensureAAAContrast';
import { NEAR_WHITE_HEX, NEAR_BLACK_HEX } from './config';

export const generateCssClasses = (palette: PaletteWithVariations): string => {
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
  // Semantic: export exactly ONE preset var per semantic, choosing light/dark
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
    if (ct === 'warning') {
      // Prefer light, then lighter; if neither exists, fall back to base hex; then darks
      const baseHex = (palette as any)[ct].hex as string | undefined;
      return byStep['light'] ?? byStep['lighter'] ?? baseHex ?? byStep['dark'] ?? byStep['darker'] ?? null;
    }
    // error/success prefer dark; fallback to light; no base fallback
    return byStep['dark'] ?? byStep['darker'] ?? byStep['light'] ?? byStep['lighter'] ?? null;
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
  css += `  --text-on-dark: ${NEAR_WHITE_HEX};        /* near-white for dark backgrounds */\n`;
  css += `  --text-on-light: ${NEAR_BLACK_HEX};       /* near-black for light backgrounds */\n`;
  css += '}\n\n';

  // Generate classes for main color variations (excluding base colors)
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];

    // Only variation classes for main colors (no base color classes)
    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      const contrastSolution = ensureAAAContrast(variation.hex);
      // Use normalized step slug (lowercase) for class names
      const varSlug = toSlug(variation.name);
      const step = varSlug.startsWith(`${colorType}-`) ? varSlug.slice(colorType.length + 1) : varSlug;
      const slug = `${colorType}-${step}`;
      const alias = contrastSolution.textColor.toUpperCase() === NEAR_WHITE_HEX.toUpperCase() ? 'text-on-dark' : 'text-on-light';

      // Merge .bg-* and .has-*-background-color into a single rule
      css += `.bg-${colorType}-${step}, .has-${slug}-background-color {\n`;
      css += `  background-color: var(--wp--preset--color--${slug});\n`;
      css += `  color: var(--${alias});\n`;
      css += `}\n\n`;
    });
  });

  // Generate classes for semantic colors (include base + variations)
  ['error', 'warning', 'success'].forEach((colorType) => {
    // Use the chosen semantic var for classes
    const chosenVar = `var(--wp--preset--color--${colorType})`;
    const chosenHex = pickSemanticHex(colorType as 'error' | 'warning' | 'success') as string | null;
    // Decide alias based on contrast against the actual chosen hex and merge selectors
    const alias = (() => {
      if (!chosenHex) return 'text-on-light';
      const { textColor } = ensureAAAContrast(chosenHex);
      return textColor.toUpperCase() === NEAR_WHITE_HEX.toUpperCase() ? 'text-on-dark' : 'text-on-light';
    })();
    css += `.bg-${colorType}, .has-${colorType}-background-color {\n`;
    css += `  background-color: ${chosenVar};\n`;
    css += `  color: var(--${alias});\n`;
    css += `}\n\n`;
  });

  // Add utility classes for text colors only
  css += '/* Utility classes for text colors only */\n';

  // Text classes for main color variations (excluding base colors)
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];

    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      const varSlug = toSlug(variation.name);
      const step = varSlug.startsWith(`${colorType}-`) ? varSlug.slice(colorType.length + 1) : varSlug;
      const slug = `${colorType}-${step}`;
      css += `.text-${colorType}-${step} {\n`;
      css += `  color: var(--wp--preset--color--${slug});\n`;
      css += `}\n\n`;
    });
  });

  // Text classes for semantic colors (base only; no variants to avoid duplicates)
  ['error', 'warning', 'success'].forEach((colorType) => {
    css += `.text-${colorType} {\n`;
    css += `  color: var(--wp--preset--color--${colorType});\n`;
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
