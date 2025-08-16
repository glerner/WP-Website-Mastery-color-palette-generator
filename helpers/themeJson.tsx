import { PaletteWithVariations } from './types';
import { AA_SMALL_MIN } from './config';
import { generateThemeVariations } from './generateThemeVariations';

// Calculate relative luminance for a color
const getLuminance = (hex: string): number => {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;

  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
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
  const minContrast = AA_SMALL_MIN; // AA standard
  
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
      slug: 'warning',
      color: palette.warning.hex,
      name: 'Warning',
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