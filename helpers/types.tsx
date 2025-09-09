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

// Foreground tone used to render a swatch in the strip/UI
export type TextTone = 'light' | 'dark';

// Exact swatch metrics captured at click-time to ensure Palette/Export match Adjust exactly
export interface SwatchPick {
  colorKey: ColorType | SemanticColorType;
  step: 'lighter' | 'light' | 'dark' | 'darker';

  // Identity of which item in the currently displayed strip was picked
  indexDisplayed: number;

  // Exact color values
  hex: string; // #RRGGBB
  hsl: { h: number; s: number; l: number };
  y: number; // WCAG relative luminance [0..1]

  // Contrast metrics against the app's actual text tokens
  contrastVsTextOnLight: number; // ratio vs text-on-light
  contrastVsTextOnDark: number;  // ratio vs text-on-dark
  textToneUsed: TextTone;        // which tone was used to render the swatch in the strip
}