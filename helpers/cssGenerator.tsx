import { PaletteWithVariations } from './types';
import { ensureAAAContrast } from './ensureAAAContrast';

export const generateCssClasses = (palette: PaletteWithVariations): string => {
  let css = '/*\n';
  css += '  NOTE: For developer use only. WordPress does not load these generated CSS files by default.\\n';
  css += "  Only your theme's main style.css is used by WordPress automatically.\\n";
  css += '  You may copy/paste variables and classes from this file into your theme if desired.\\n';
  css += '*/\n';
  css += '/* Color Palette CSS Classes */\n';
  css += '/* Generated with optimal contrast ratios */\n';
  css += '/* Only includes adjusted colors with proper contrast optimization */\n\n';
  
  // WordPress preset color variables on :root
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const appendVar = (name: string, value: string) => `  --wp--preset--color--${name}: ${value};\n`;
  css += ':root{\n';
  // Base colors: ONLY export variations (contrast-adjusted). Do not export base color vars.
  ['primary','secondary','tertiary','accent'].forEach((ct) => {
    (palette as any)[ct].variations.forEach((v: { name: string; hex: string }) => {
      const slug = `${ct}-${toSlug(v.name)}`;
      css += appendVar(slug, v.hex);
      const { textColor } = ensureAAAContrast(v.hex);
      // Paired readable-on-background text color
      css += appendVar(`on-${slug}`, textColor);
    });
  });
  // Semantic: export exactly ONE preset var per semantic, choosing light/dark
  const pickSemanticHex = (ct: 'error'|'warning'|'success') => {
    const v = (palette as any)[ct].variations as { name: string; hex: string }[];
    const byName = Object.fromEntries(v.map((x) => [toSlug(x.name), x.hex]));
    if (ct === 'warning') {
      return byName['light'] ?? byName['lighter'] ?? byName['dark'] ?? byName['darker'] ?? null;
    }
    // error/success prefer dark; fallback to light; no base fallback
    return byName['dark'] ?? byName['darker'] ?? byName['light'] ?? byName['lighter'] ?? null;
  };
  (['error','warning','success'] as const).forEach((ct) => {
    const chosen = pickSemanticHex(ct);
    if (chosen) {
      css += appendVar(ct, chosen);
      const { textColor } = ensureAAAContrast(chosen);
      css += appendVar(`on-${ct}`, textColor);
    }
  });
  css += '}\n\n';
  
  // Generate classes for main color variations (excluding base colors)
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];
    
    // Only variation classes for main colors (no base color classes)
    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      const contrastSolution = ensureAAAContrast(variation.hex);
      css += `.bg-${colorType}-${variation.name} {\n`;
      css += `  background-color: ${variation.hex};\n`;
      css += `  color: ${contrastSolution.textColor};\n`;
      css += `}\n\n`;

      // WP compatible utility classes using preset vars
      const slug = `${colorType}-${toSlug(variation.name)}`;
      css += `.has-${slug}-background-color{ background-color: var(--wp--preset--color--${slug}); }\n`;
      css += `.has-${slug}-color{ color: var(--wp--preset--color--${slug}); }\n\n`;
      // readable text variable for these backgrounds
      css += `.has-on-${slug}-color{ color: var(--wp--preset--color--on-${slug}); }\n\n`;
    });
  });
  
  // Generate classes for semantic colors (include base + variations)
  ['error', 'warning', 'success'].forEach((colorType) => {
    // Use the chosen semantic var for classes
    const chosenHex = `var(--wp--preset--color--${colorType})`;
    // Base semantic class using chosen var with contrast ensured via utility not possible here; keep color only
    css += `.bg-${colorType} {\n`;
    css += `  background-color: ${chosenHex};\n`;
    css += `}\n\n`;

    // WP base classes
    css += `.has-${colorType}-background-color{ background-color: var(--wp--preset--color--${colorType}); }\n`;
    css += `.has-${colorType}-color{ color: var(--wp--preset--color--${colorType}); }\n\n`;

    // Paired readable text util for semantics
    css += `.has-on-${colorType}-color{ color: var(--wp--preset--color--on-${colorType}); }\n\n`;
  });
  
  // Add utility classes for text colors only
  css += '/* Utility classes for text colors only */\n';
  
  // Text classes for main color variations (excluding base colors)
  ['primary', 'secondary', 'tertiary', 'accent'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];
    
    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      css += `.text-${colorType}-${variation.name} {\n`;
      css += `  color: ${variation.hex};\n`;
      css += `}\n\n`;
    });
  });
  
  // Text classes for semantic colors (include base + variations)
  ['error', 'warning', 'success'].forEach((colorType) => {
    const colorData = palette[colorType as keyof PaletteWithVariations];
    
    css += `.text-${colorType} {\n`;
    css += `  color: ${colorData.hex};\n`;
    css += `}\n\n`;
    
    colorData.variations.forEach((variation: { name: string; hex: string }) => {
      css += `.text-${colorType}-${variation.name} {\n`;
      css += `  color: ${variation.hex};\n`;
      css += `}\n\n`;
    });
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