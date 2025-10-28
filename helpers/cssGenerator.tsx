import { PaletteWithVariations } from './types';

type Band = 'lighter' | 'light' | 'dark' | 'darker';
type SemanticPerScheme = { light: Band; dark: Band };
type SemanticBandSelection = { error: SemanticPerScheme; warning: SemanticPerScheme; success: SemanticPerScheme };

export const generateCssClasses = (
  palette: PaletteWithVariations,
  semanticBandSelection?: SemanticBandSelection,
  opts?: { textOnDark?: string; textOnLight?: string; themeAliases?: Array<{ slug: string; color: string; name?: string }> }
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

  // Utility helpers
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const stepCounterpart = (step: string): string | null => {
    if (step === 'lighter') return 'darker';
    if (step === 'light') return 'dark';
    if (step === 'dark') return 'light';
    if (step === 'darker') return 'lighter';
    return null; // e.g., base or unknown
  };
  const lightTextAlias = 'var(--text-on-light)';
  const darkTextAlias = 'var(--text-on-dark)';

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
  // Informational comments for developers consuming this CSS
  css += '/* Variables like --primary-dark, --error-light, etc. are defined by your theme.json styles.css for each style variation. */\n';
  css += '/* This file provides utility classes that use those variables. */\n\n';
  // Include theme alias variables, if provided (from the uploaded theme.json)
  if (Array.isArray(opts?.themeAliases) && opts!.themeAliases!.length) {
    css += '/* Alias variables from your uploaded theme.json (copy to your child theme style.css). Best to assign generated proper-contrast Palette colors e.g. --accent: var(--accent-light); or --base: var(--text-on-dark); */\n';
    css += ':root, .editor-styles-wrapper {\n';
    opts!.themeAliases!.forEach(({ slug, color }) => {
      if (!slug || !color) return;
      css += `  --${slug}: ${color};\n`;
    });
    css += '}\n\n';
  }

  css += ':root, .editor-styles-wrapper {\n';
  css += '  /* Hint to browsers that both color schemes are supported */\n';
  css += '  color-scheme: light dark;\n';
  css += '  /* Compatibility mappings for parent themes expecting preset color slugs */\n';
  css += '  /* These only apply when copied into your theme\'s style.css */\n';
  css += '  /* Don\'t re-define the CSS variables WordPress generates from theme.json (--wp--preset--*); that can cause mismatches.\n';
  css += '   * Examples (commented on purpose):\n';
  css += '   * --wp--preset--color--base: var(--text-on-dark, #ffffff);\n';
  css += '   * --wp--preset--color--contrast: var(--text-on-light, #000000);\n';
  css += '   */\n';
  css += '  /* Background convenience aliases */\n';
  css += '  --bg-primary: var(--primary-dark);\n';
  css += '  --bg-secondary: var(--secondary-dark);\n';
  css += '  --bg-tertiary: var(--tertiary-dark);\n';
  css += '  --bg-accent: var(--accent-dark);\n';
  css += '}\n\n';

  // Global note about !important for WP preset classes
  css += '/* WordPress gives all .has-* class colors !important, so !important is required to override. */\n\n';

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
      // Include .has-<family>-background-color on the 'dark' step for compatibility
      const extra = step === 'dark' ? `, .has-${colorType}-background-color` : '';
      // In @supports, always place the USER-SELECTED band first, and the opposite band second
      const lightVar = `var(--${slug})`;
      const darkVar = hasCounterpart ? `var(--${colorType}-${counterpart})` : `var(--${slug})`;
      css += `.bg-${colorType}-${step}, .has-${slug}-background-color${extra} {\n`;
      css += `  /* Fallback for browsers without light-dark(): */\n`;
      css += `  background-color: var(--${slug}) !important;\n`;
      css += `  color: ${(step === 'lighter' || step === 'light') ? lightTextAlias : darkTextAlias} !important;\n`;
      css += `  @supports (color: light-dark(black, white)) {\n`;
      css += `    /* Modern color scheme aware version: */\n`;
      css += `    background-color: light-dark(${lightVar}, ${darkVar}) !important;\n`;
      css += `    color: light-dark(${(step === 'lighter' || step === 'light') ? lightTextAlias : darkTextAlias}, ${(step === 'lighter' || step === 'light') ? darkTextAlias : lightTextAlias}) !important;\n`;
      css += `  }\n`;
      css += `}\n\n`;
    });
  });

  // Generate classes for semantic colors using LIGHT/DARK bands selected by the user
  ;(['error', 'warning', 'success'] as const).forEach((colorType) => {
    const ctOut = colorType === 'warning' ? 'notice' : colorType;
    const sel = semanticBandSelection?.[colorType];
    const lightBand = (sel?.light as Band) || 'light';
    const darkBand = (sel?.dark as Band) || 'dark';
    const lightVar = `var(--${ctOut}-${lightBand})`;
    const darkVar = `var(--${ctOut}-${darkBand})`;
    const lightText = (lightBand === 'lighter' || lightBand === 'light') ? lightTextAlias : darkTextAlias;
    const darkText = (darkBand === 'lighter' || darkBand === 'light') ? lightTextAlias : darkTextAlias;

    // Group unbanded and -light selectors together
    const lightSelectors = `.bg-${ctOut}, .bg-${ctOut}-light, .has-${ctOut}-background-color, .has-${ctOut}-light-background-color`;
    css += `${lightSelectors} {\n`;
    css += `  /* Fallback for browsers without light-dark(): */\n`;
    css += `  background-color: ${lightVar} !important;\n`;
    css += `  color: ${lightText} !important;\n`;
    css += `  @supports (color: light-dark(black, white)) {\n`;
    css += `    background-color: light-dark(${lightVar}, ${darkVar}) !important;\n`;
    css += `    color: light-dark(${lightText}, ${darkText}) !important;\n`;
    css += `  }\n`;
    css += `}\n\n`;

    // Separate rule for -dark selectors
    const darkSelectors = `.bg-${ctOut}-dark, .has-${ctOut}-dark-background-color`;
    css += `${darkSelectors} {\n`;
    css += `  /* Fallback for browsers without light-dark(): */\n`;
    css += `  background-color: ${darkVar} !important;\n`;
    css += `  color: ${darkText} !important;\n`;
    css += `  @supports (color: light-dark(black, white)) {\n`;
    css += `    background-color: light-dark(${lightVar}, ${darkVar}) !important;\n`;
    css += `    color: light-dark(${lightText}, ${darkText}) !important;\n`;
    css += `  }\n`;
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
      const selectedVar = `var(--${slug})`;
      const oppositeVar = hasCounterpart ? `var(--${colorType}-${counterpart})` : selectedVar;
      css += `.text-${colorType}-${step} {\n`;
      css += `  /* Fallback for browsers without light-dark(): */\n`;
      css += `  color: ${selectedVar};\n`;
      css += `  @supports (color: light-dark(black, white)) {\n`;
      css += `    /* Modern color scheme aware version: */\n`;
      css += `    color: light-dark(${selectedVar}, ${oppositeVar});\n`;
      css += `  }\n`;
      css += `}\n\n`;
    });
  });

  // Text classes for semantic colors using light/dark vars
  ['error', 'warning', 'success'].forEach((colorType) => {
    const ctOut = colorType === 'warning' ? 'notice' : colorType;
    const lightVar = `var(--${ctOut}-light)`;
    const darkVar = `var(--${ctOut}-dark)`;
    css += `.text-${ctOut} {\n`;
    css += `  /* Fallback for browsers without light-dark(): */\n`;
    css += `  color: ${darkVar};\n`;
    css += `  @supports (color: light-dark(black, white)) {\n`;
    css += `    /* Modern color scheme aware version: */\n`;
    css += `    color: light-dark(${lightVar}, ${darkVar});\n`;
    css += `  }\n`;
    css += `}\n\n`;
  });

  return css;
};

export const generateFilenameSuffix = (palette: PaletteWithVariations): string => {
  // Only include the four main families to keep filenames concise
  const hexValues = [
    palette.primary.hex.replace('#', ''),
    palette.secondary.hex.replace('#', ''),
    palette.tertiary.hex.replace('#', ''),
    palette.accent.hex.replace('#', ''),
  ];

  return hexValues.join('-');
};
