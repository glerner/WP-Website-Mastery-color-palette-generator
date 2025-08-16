// Centralized configuration for luminance ranges, target counts, precision, and thresholds
// Values can be overridden via environment variables (NEXT_PUBLIC_* for client/browser use)
// This file is the single source of truth for all constants.

const ENV: Record<string, string | undefined> =
  (typeof globalThis !== 'undefined' && (globalThis as any).process && (globalThis as any).process.env)
    ? ((globalThis as any).process.env as Record<string, string | undefined>)
    : {};

/**
 * Parse a number from env with optional clamping.
 * If the value is not a finite number, returns the fallback.
 */
const numFromEnv = (key: string, fallback: number, min?: number, max?: number): number => {
  const raw = ENV[key];
  const v = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(v)) return fallback;
  const low = min != null ? Math.max(min, v) : v;
  return max != null ? Math.min(max, low) : low;
};

// Back-compat helpers for existing usages in this file. Prefer numFromEnv in new lines.
const num = (key: string, fallback: string) => numFromEnv(key, parseFloat(fallback));
const int = (key: string, fallback: string) => {
  const parsed = Number.isFinite(Number(ENV[key])) ? Number(ENV[key]) : Number(fallback);
  return Math.trunc(parsed);
};

/**
 * Near-black/near-white colors used for text contrast testing against background swatches.
 * Units: HEX strings and RGB triplets.
 */
export const NEAR_BLACK_HEX = '#0A0A0A';
export const NEAR_WHITE_HEX = '#F9FAFB';
export const NEAR_BLACK_RGB = { r: 10, g: 10, b: 10 } as const;
export const NEAR_WHITE_RGB = { r: 249, g: 250, b: 251 } as const;

/** Number of decimals when computing target Y values. */
export const Y_TARGET_DECIMALS = int('NEXT_PUBLIC_Y_TARGET_DECIMALS', '2');
/** Number of decimals when displaying measured Y values. */
export const Y_DISPLAY_DECIMALS = int('NEXT_PUBLIC_Y_DISPLAY_DECIMALS', '3');

// Target counts
/** Desired number of tint (lighter) steps. Env: NEXT_PUBLIC_TINT_TARGET_COUNT */
export const TINT_TARGET_COUNT = int('NEXT_PUBLIC_TINT_TARGET_COUNT', '10');
/** Desired number of shade (darker) steps. Env: NEXT_PUBLIC_SHADE_TARGET_COUNT */
export const SHADE_TARGET_COUNT = int('NEXT_PUBLIC_SHADE_TARGET_COUNT', '10');

// Luminance ranges (defaults chosen from prior implementation)
/** Lower bound for the "lighter" band (Y). Env: NEXT_PUBLIC_LIGHTER_MIN_Y */
export const LIGHTER_MIN_Y = numFromEnv('NEXT_PUBLIC_LIGHTER_MIN_Y', 0.50, 0, 1);
/** Upper bound for the "lighter" band (Y). Env: NEXT_PUBLIC_LIGHTER_MAX_Y */
export const LIGHTER_MAX_Y = numFromEnv('NEXT_PUBLIC_LIGHTER_MAX_Y', 0.95, 0, 1);
/** Headroom to keep below max when auto-placing lighter. Env: NEXT_PUBLIC_LIGHTER_HEADROOM_FROM_MAX */
export const LIGHTER_HEADROOM_FROM_MAX = numFromEnv('NEXT_PUBLIC_LIGHTER_HEADROOM_FROM_MAX', 0.10, 0, 1);

/** Base lower bound for the "light" band (Y). Env: NEXT_PUBLIC_LIGHT_MIN_Y_BASE */
export const LIGHT_MIN_Y_BASE = numFromEnv('NEXT_PUBLIC_LIGHT_MIN_Y_BASE', 0.30, 0, 1);
/** Upper cap for the "light" band (Y). Env: NEXT_PUBLIC_LIGHT_MAX_Y_CAP */
export const LIGHT_MAX_Y_CAP = numFromEnv('NEXT_PUBLIC_LIGHT_MAX_Y_CAP', 0.90, 0, 1);

/** Lower bound for the "darker" band (Y). Env: NEXT_PUBLIC_DARKER_MIN_Y */
export const DARKER_MIN_Y = numFromEnv('NEXT_PUBLIC_DARKER_MIN_Y', 0.02, 0, 1);
/** Upper bound for the "darker" band (Y). Env: NEXT_PUBLIC_DARKER_MAX_Y */
export const DARKER_MAX_Y = numFromEnv('NEXT_PUBLIC_DARKER_MAX_Y', 0.12, 0, 1);

/** Base lower bound for the "dark" band (Y). Env: NEXT_PUBLIC_DARK_MIN_Y_BASE */
export const DARK_MIN_Y_BASE = numFromEnv('NEXT_PUBLIC_DARK_MIN_Y_BASE', 0.08, 0, 1); // base lower bound
/** Overlap lower bound with darker for continuity. Env: NEXT_PUBLIC_DARK_OVERLAP_MIN_Y */
export const DARK_OVERLAP_MIN_Y = numFromEnv('NEXT_PUBLIC_DARK_OVERLAP_MIN_Y', 0.08, 0, 1); // allow overlap with darker
/** Upper bound for the "dark" band (Y). Env: NEXT_PUBLIC_DARK_MAX_Y */
export const DARK_MAX_Y = numFromEnv('NEXT_PUBLIC_DARK_MAX_Y', 0.20, 0, 1);

// Contrast caps (comfort guidelines; WCAG has no maximum)
/** UX cap for contrast exploration on tints. Env: NEXT_PUBLIC_MAX_CONTRAST_TINTS */
export const MAX_CONTRAST_TINTS = numFromEnv('NEXT_PUBLIC_MAX_CONTRAST_TINTS', 18, 1, 50);
/** UX cap for contrast exploration on shades. Env: NEXT_PUBLIC_MAX_CONTRAST_SHADES */
export const MAX_CONTRAST_SHADES = numFromEnv('NEXT_PUBLIC_MAX_CONTRAST_SHADES', 18, 1, 50);

// Thresholds (allow override of AAA/AA if needed)
// WCAG official AAA threshold for small text (reference)
export const AAA_OFFICIAL_SMALL = 7.0;
/** Project default AAA threshold for small text. Env: NEXT_PUBLIC_AAA_MIN_CONTRAST */
export const AAA_MIN = numFromEnv('NEXT_PUBLIC_AAA_MIN_CONTRAST', 7.05, 1, 21);
/** WCAG AA threshold for small text. Env: NEXT_PUBLIC_AA_SMALL_MIN_CONTRAST */
export const AA_SMALL_MIN = numFromEnv('NEXT_PUBLIC_AA_SMALL_MIN_CONTRAST', 4.5, 1, 21);
// I am removing AA_LARGE_MIN, we *will not use it* ever, for anything.
// This is a palette creator, with no way of knowing if it is used for large or small text.
// export const AA_LARGE_MIN = num('NEXT_PUBLIC_AA_LARGE_MIN_CONTRAST', '3');

// Visual separation guidance (Y-gap) — used for warnings & sensible defaults only
/** Recommended minimum Y-gap between lighter and light. Env: NEXT_PUBLIC_RECOMMENDED_TINT_Y_GAP */
export const RECOMMENDED_TINT_Y_GAP = numFromEnv('NEXT_PUBLIC_RECOMMENDED_TINT_Y_GAP', 0.20, 0, 1);
/** Hard minimum Y-gap used only for default placements (never forced). Env: NEXT_PUBLIC_HARD_MIN_TINT_Y_GAP */
export const HARD_MIN_TINT_Y_GAP = numFromEnv('NEXT_PUBLIC_HARD_MIN_TINT_Y_GAP', 0.08, 0, 1);
/** Recommended minimum Y-gap between dark and darker. Env: NEXT_PUBLIC_RECOMMENDED_SHADE_Y_GAP */
export const RECOMMENDED_SHADE_Y_GAP = numFromEnv('NEXT_PUBLIC_RECOMMENDED_SHADE_Y_GAP', 0.035, 0, 1);
/** Hard minimum Y-gap used only for default placements (never forced). Env: NEXT_PUBLIC_HARD_MIN_SHADE_Y_GAP */
export const HARD_MIN_SHADE_Y_GAP = numFromEnv('NEXT_PUBLIC_HARD_MIN_SHADE_Y_GAP', 0.02, 0, 1);

/** Minimum delta from white for the first lighter step (to avoid indistinguishable step). */
export const MIN_DELTA_LUM_TINTS_FROM_WHITE = numFromEnv('NEXT_PUBLIC_MIN_DELTA_LUM_TINTS_FROM_WHITE', 0.04, 0, 1);
/** Minimum separation in Y between lighter and light, to keep them visually distinct after rounding. */
export const MIN_DELTA_LUM_TINTS = numFromEnv('NEXT_PUBLIC_MIN_DELTA_LUM_TINTS', 0.16, 0, 1);
/** Minimum separation in Y between dark and darker, to keep them visually distinct after rounding. */
export const MIN_DELTA_LUM_SHADES = numFromEnv('NEXT_PUBLIC_MIN_DELTA_LUM_SHADES', 0.06, 0, 1);

// Target luminance anchors for each band (used by any auto-placement heuristics)
/** Target Y for the lighter band. */
export const TARGET_LUM_LIGHTER = numFromEnv('NEXT_PUBLIC_TARGET_LUM_LIGHTER', 0.88, 0, 1);
/** Target Y for the light band. */
export const TARGET_LUM_LIGHT = numFromEnv('NEXT_PUBLIC_TARGET_LUM_LIGHT', 0.72, 0, 1);
/** Target Y for the dark band. */
export const TARGET_LUM_DARK = numFromEnv('NEXT_PUBLIC_TARGET_LUM_DARK', 0.14, 0, 1);
/** Target Y for the darker band. */
export const TARGET_LUM_DARKER = numFromEnv('NEXT_PUBLIC_TARGET_LUM_DARKER', 0.06, 0, 1);
