import {
  hexToRgb,
  rgbToHex,
  luminance,
  generateShades,
} from './colorUtils';
import { Palette, Color } from './types';

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   h       The hue
 * @param   s       The saturation
 * @param   l       The lightness
 * @return  Array   The RGB representation
 */
const hslToRgb = (
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } => {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

/**
 * Generates a single random color with a target luminance.
 * It tries a few times to find a color within the desired luminance range.
 *
 * @returns A Color object with its hex value.
 */
const generateRandomColorWithMediumLuminance = (): Color => {
  const MAX_ATTEMPTS = 10;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const h = Math.random(); // Hue [0, 1]
    const s = 0.6 + Math.random() * 0.3; // Saturation [0.6, 0.9] for vibrant colors
    const l = 0.4 + Math.random() * 0.2; // Lightness [0.4, 0.6] for mid-range

    const rgb = hslToRgb(h, s, l);
    const lum = luminance(rgb.r, rgb.g, rgb.b);

    // Target luminance range Y ≈ 0.3-0.6
    if (lum >= 0.3 && lum <= 0.6) {
      return {
        name: 'Base', // Placeholder name
        hex: rgbToHex(rgb.r, rgb.g, rgb.b),
      };
    }
  }

  // Fallback to a guaranteed safe color if no suitable random color is found
  console.warn(
    'Could not generate a random color in the target luminance range. Using fallback.'
  );
  return { name: 'Base', hex: '#7a9a4f' }; // A safe mid-luminance color
};

/**
 * Generates a random color palette using the analogous-complementary harmony rule.
 * This serves as a fallback if AI-based generation fails.
 *
 * The harmony is defined as:
 * - Primary: A random base color with medium luminance.
 * - Secondary: Analogous color (+30° hue shift).
 * - Tertiary: Analogous color (-30° hue shift).
 * - Accent: Complementary color (+180° hue shift).
 *
 * All colors are generated to have a similar medium luminance.
 *
 * @returns A complete Palette object.
 */
export const generateAnalogousComplementaryPalette = (): Palette => {
  const primaryColor = generateRandomColorWithMediumLuminance();
  const { r, g, b } = hexToRgb(primaryColor.hex);

  // Convert base color to HSL to manipulate hue
  const r_norm = r / 255,
    g_norm = g / 255,
    b_norm = b / 255;
  const max = Math.max(r_norm, g_norm, b_norm),
    min = Math.min(r_norm, g_norm, b_norm);
  let h = (max + min) / 2;
  let s = h;
  const l = h;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r_norm:
        h = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0);
        break;
      case g_norm:
        h = (b_norm - r_norm) / d + 2;
        break;
      case b_norm:
        h = (r_norm - g_norm) / d + 4;
        break;
    }
    h /= 6;
  }

  const baseHue = h;

  const createColorFromHue = (
    hueShift: number,
    name: string
  ): { name: string; hex: string } => {
    // Normalize hue to be within [0, 1]
    const newHue = (baseHue + hueShift / 360 + 1) % 1;
    const rgb = hslToRgb(newHue, s, l);
    return { name, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
  };

  const palette: Palette = {
    primary: { name: 'Primary', hex: primaryColor.hex },
    secondary: createColorFromHue(30, 'Secondary'), // Analogous +30°
    tertiary: createColorFromHue(-30, 'Tertiary'), // Analogous -30°
    accent: createColorFromHue(180, 'Accent'), // Complementary +180°
    // Default semantic colors
    error: { name: 'Error', hex: '#d32f2f' },
    warning: { name: 'Warning', hex: '#f57c00' },
    success: { name: 'Success', hex: '#388e3c' },
  };

  return palette;
};