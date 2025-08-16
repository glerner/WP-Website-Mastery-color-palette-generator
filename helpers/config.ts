// Centralized configuration for luminance ranges, target counts, precision, and thresholds
// Values can be overridden via environment variables (NEXT_PUBLIC_* for client/browser use)

const ENV: Record<string, string | undefined> =
  (typeof globalThis !== 'undefined' && (globalThis as any).process && (globalThis as any).process.env)
    ? ((globalThis as any).process.env as Record<string, string | undefined>)
    : {};

const num = (key: string, fallback: string) => parseFloat((ENV[key] ?? fallback) as string);
const int = (key: string, fallback: string) => parseInt((ENV[key] ?? fallback) as string, 10);

// Text color variables (near-black and near-white). Adjustable if needed.
export const NEAR_BLACK_HEX = '#0A0A0A';
export const NEAR_WHITE_HEX = '#F9FAFB';
export const NEAR_BLACK_RGB = { r: 10, g: 10, b: 10 } as const;
export const NEAR_WHITE_RGB = { r: 249, g: 250, b: 251 } as const;

export const Y_TARGET_DECIMALS = int('NEXT_PUBLIC_Y_TARGET_DECIMALS', '2');
export const Y_DISPLAY_DECIMALS = int('NEXT_PUBLIC_Y_DISPLAY_DECIMALS', '3');

// Target counts
export const TINT_TARGET_COUNT = int('NEXT_PUBLIC_TINT_TARGET_COUNT', '10');
export const SHADE_TARGET_COUNT = int('NEXT_PUBLIC_SHADE_TARGET_COUNT', '10');

// Luminance ranges (defaults chosen from prior implementation)
export const LIGHTER_MIN_Y = num('NEXT_PUBLIC_LIGHTER_MIN_Y', '0.50');
export const LIGHTER_MAX_Y = num('NEXT_PUBLIC_LIGHTER_MAX_Y', '0.95');
export const LIGHTER_HEADROOM_FROM_MAX = num('NEXT_PUBLIC_LIGHTER_HEADROOM_FROM_MAX', '0.10');

export const LIGHT_MIN_Y_BASE = num('NEXT_PUBLIC_LIGHT_MIN_Y_BASE', '0.30');
export const LIGHT_MAX_Y_CAP = num('NEXT_PUBLIC_LIGHT_MAX_Y_CAP', '0.90');

export const DARKER_MIN_Y = num('NEXT_PUBLIC_DARKER_MIN_Y', '0.02');
export const DARKER_MAX_Y = num('NEXT_PUBLIC_DARKER_MAX_Y', '0.12');

export const DARK_MIN_Y_BASE = num('NEXT_PUBLIC_DARK_MIN_Y_BASE', '0.08'); // base lower bound
export const DARK_OVERLAP_MIN_Y = num('NEXT_PUBLIC_DARK_OVERLAP_MIN_Y', '0.08'); // allow overlap with darker
export const DARK_MAX_Y = num('NEXT_PUBLIC_DARK_MAX_Y', '0.20');

// Contrast caps (comfort guidelines; WCAG has no maximum)
export const MAX_CONTRAST_TINTS = num('NEXT_PUBLIC_MAX_CONTRAST_TINTS', '18');
export const MAX_CONTRAST_SHADES = num('NEXT_PUBLIC_MAX_CONTRAST_SHADES', '18');

// Thresholds (allow override of AAA/AA if needed)
// WCAG official AAA threshold for small text (reference)
export const AAA_OFFICIAL_SMALL = 7.0;
// Project default AAA for small text (slightly stricter)
export const AAA_MIN = num('NEXT_PUBLIC_AAA_MIN_CONTRAST', '7.05');
export const AA_SMALL_MIN = num('NEXT_PUBLIC_AA_SMALL_MIN_CONTRAST', '4.5');
// I am removing AA_LARGE_MIN, we *will not use it* ever, for anything.
// This is a palette creator, with no way of knowing if it is used for large or small text.
// export const AA_LARGE_MIN = num('NEXT_PUBLIC_AA_LARGE_MIN_CONTRAST', '3');

// Visual separation guidance (Y-gap) — try values you specified
// These are NOT enforced hard-blockers for user selection; they drive warnings and default picks only.
export const RECOMMENDED_TINT_Y_GAP = num('NEXT_PUBLIC_RECOMMENDED_TINT_Y_GAP', '0.20');
export const HARD_MIN_TINT_Y_GAP = num('NEXT_PUBLIC_HARD_MIN_TINT_Y_GAP', '0.08');
export const RECOMMENDED_SHADE_Y_GAP = num('NEXT_PUBLIC_RECOMMENDED_SHADE_Y_GAP', '0.035');
export const HARD_MIN_SHADE_Y_GAP = num('NEXT_PUBLIC_HARD_MIN_SHADE_Y_GAP', '0.02');
