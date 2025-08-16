export type ColorType = 'primary' | 'secondary' | 'tertiary' | 'accent';
export type SemanticColorType = 'error' | 'warning' | 'success';

export interface Color {
  name: string;
  hex: string;
}

export interface Palette {
  primary: Color;
  secondary: Color;
  tertiary: Color;
  accent: Color;
  error: Color;
  warning: Color;
  success: Color;
}

export interface ColorWithVariations extends Color {
  variations: Color[];
}

export interface PaletteWithVariations {
  primary: ColorWithVariations;
  secondary: ColorWithVariations;
  tertiary: ColorWithVariations;
  accent: ColorWithVariations;
  error: ColorWithVariations;
  warning: ColorWithVariations;
  success: ColorWithVariations;
}