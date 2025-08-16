import { PaletteWithVariations } from './types';

export interface ThemeVariation {
  name: string;
  description: string;
  palette: PaletteWithVariations;
}

export const generateThemeVariations = (basePalette: PaletteWithVariations): ThemeVariation[] => {
  const { primary, secondary, tertiary, accent, error, warning, success } = basePalette;

  const variations: ThemeVariation[] = [
    {
      name: 'Original',
      description: 'Primary-Secondary-Tertiary',
      palette: {
        primary,
        secondary,
        tertiary,
        accent,
        error,
        warning,
        success,
      },
    },
    {
      name: 'Variant A',
      description: 'Primary-Tertiary-Secondary',
      palette: {
        primary,
        secondary: tertiary,
        tertiary: secondary,
        accent,
        error,
        warning,
        success,
      },
    },
    {
      name: 'Variant B',
      description: 'Secondary-Primary-Tertiary',
      palette: {
        primary: secondary,
        secondary: primary,
        tertiary,
        accent,
        error,
        warning,
        success,
      },
    },
    {
      name: 'Variant C',
      description: 'Secondary-Tertiary-Primary',
      palette: {
        primary: secondary,
        secondary: tertiary,
        tertiary: primary,
        accent,
        error,
        warning,
        success,
      },
    },
    {
      name: 'Variant D',
      description: 'Tertiary-Primary-Secondary',
      palette: {
        primary: tertiary,
        secondary: primary,
        tertiary: secondary,
        accent,
        error,
        warning,
        success,
      },
    },
    {
      name: 'Variant E',
      description: 'Tertiary-Secondary-Primary',
      palette: {
        primary: tertiary,
        secondary: secondary,
        tertiary: primary,
        accent,
        error,
        warning,
        success,
      },
    },
  ];

  return variations;
};