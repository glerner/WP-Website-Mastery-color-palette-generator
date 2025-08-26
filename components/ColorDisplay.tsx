import * as React from 'react';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { PaletteWithVariations } from '../helpers/types';
import { ensureAAAContrast } from '../helpers/ensureAAAContrast';
import { NEAR_WHITE_HEX, NEAR_BLACK_HEX, NEAR_WHITE_RGB, NEAR_BLACK_RGB, AAA_MIN, AA_SMALL_MIN, RECOMMENDED_TINT_Y_GAP, RECOMMENDED_SHADE_Y_GAP } from '../helpers/config';
import { hexToRgb, getContrastRatio, luminance } from '../helpers/colorUtils';
import styles from './ColorDisplay.module.css';

interface ColorDisplayProps {
  palette: PaletteWithVariations;
  isLoading: boolean;
  onVariationClick?: (
    key: 'primary' | 'secondary' | 'tertiary' | 'accent',
    step: 'lighter' | 'light' | 'dark' | 'darker'
  ) => void;
}

const ContrastInfo = ({ colorHex }: { colorHex: string }) => {
  const solution = ensureAAAContrast(colorHex);
  const bg = hexToRgb(colorHex);
  const textIsWhite = solution.textColor.toUpperCase() === NEAR_WHITE_HEX.toUpperCase();
  const textRgb = textIsWhite ? NEAR_WHITE_RGB : NEAR_BLACK_RGB;
  const ratio = getContrastRatio(bg, textRgb);

  const level: 'AAA' | 'AA' | 'FAIL' = ratio >= AAA_MIN ? 'AAA' : ratio >= AA_SMALL_MIN ? 'AA' : 'FAIL';
  const variant: 'success' | 'warning' | 'destructive' =
    level === 'AAA' ? 'success' : level === 'AA' ? 'warning' : 'destructive';

  return (
    <div className={`${styles.contrastInfo}`}>
      <div className={styles.contrastRow}>
        {solution.overlayColor && (
          <span className={`${styles.overlayTag} cf-font-600`}>overlay</span>
        )}
        <Badge variant={variant}>
          {level} {ratio.toFixed(2)}
        </Badge>
      </div>
    </div>
  );
};

const VariationBlock = ({ variation, onClick }: { variation: any; onClick?: () => void }) => {
  const contrastSolution = ensureAAAContrast(variation.hex);
  const bg = hexToRgb(variation.hex);
  const textIsWhite = contrastSolution.textColor.toUpperCase() === NEAR_WHITE_HEX.toUpperCase();
  const textRgb = textIsWhite ? NEAR_WHITE_RGB : NEAR_BLACK_RGB;
  const ratio = getContrastRatio(bg, textRgb);
  const level: 'AAA' | 'AA' | 'FAIL' = ratio >= AAA_MIN ? 'AAA' : ratio >= AA_SMALL_MIN ? 'AA' : 'FAIL';
  const hsl = hexToHslString(variation.hex, true);
  const y = luminance(...Object.values(hexToRgb(variation.hex)) as [number, number, number]);

  const badgeBg = textIsWhite ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';

  return (
    <div
      className={styles.variationBlock}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      role={onClick ? 'button' as const : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.stopPropagation(); onClick(); } }}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className={styles.variationHeaderBar}>
        <span className={`${styles.variationName} cf-font-600`}>{variation.name}</span>
      </div>
      <div className={styles.variationBody} style={{ backgroundColor: variation.hex }}>
        {contrastSolution.overlayColor && (
          <div className={styles.overlay} style={{ backgroundColor: contrastSolution.overlayColor }} />
        )}
        {/* In-swatch contrast badge with aligned fixed-width meta spans (no wrap) */}
        <div className={styles.contrastBadge} style={{ color: contrastSolution.textColor }}>
          <span className={styles.metaFixed}>{level} {ratio.toFixed(2)}</span>
          <span className={styles.metaFixed}>Y={y.toFixed(3)}</span>
        </div>
        <div className={styles.variationContent} style={{ color: contrastSolution.textColor }}>
          <div className={styles.variationCodesContainer}>
            <div className={styles.variationCodes}>
              <span className={styles.variationHsl}>{hsl}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ColorCard = ({ color, name, onVariationClick }: { color: any; name: string; onVariationClick?: (step: 'lighter' | 'light' | 'dark' | 'darker') => void }) => {
  const ordered = React.useMemo(() => {
    const order: Record<string, number> = { lighter: 0, light: 1, dark: 2, darker: 3 };
    return [...(color.variations || [])].sort((a, b) => (order[a.step] ?? 99) - (order[b.step] ?? 99));
  }, [color.variations]);

  // Compute palette-level gap warnings (use the same recommended Y-gap thresholds as the selectors)
  const gaps = React.useMemo(() => {
    const byStep: Record<string, any> = Object.fromEntries(ordered.map(v => [v.step, v]));
    const yOf = (v: any | undefined) => v ? luminance(...Object.values(hexToRgb(v.hex)) as [number, number, number]) : undefined;
    const yLighter = yOf(byStep.lighter);
    const yLight = yOf(byStep.light);
    const yDarker = yOf(byStep.darker);
    const yDark = yOf(byStep.dark);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const tintGap = (yLighter != null && yLight != null) ? r3(yLighter - yLight) : undefined;
    const shadeGap = (yDark != null && yDarker != null) ? r3(yDark - yDarker) : undefined;
    return { tintGap, shadeGap };
  }, [ordered]);
  return (
    <div className={styles.colorCard}>
      <div className={styles.variationHeader} style={{ padding: '4px 0' }}>
        <span className={`${styles.variationName} cf-font-600`}>{name}</span>
      </div>
      <div className={styles.variationsContainer}>
        {gaps.tintGap != null && gaps.tintGap < Math.round(RECOMMENDED_TINT_Y_GAP * 1000) / 1000 && (
          <div style={{
            margin: '4px 0',
            padding: '6px 8px',
            borderRadius: '8px',
            background: 'var(--surface-strong, #fef3c7)',
            color: 'var(--foreground, #7a5d00)',
            border: '1px solid var(--border, #f59e0b)'
          }}>
            {name} lighter vs light gap {gaps.tintGap.toFixed(3)} is below the recommended minimum {RECOMMENDED_TINT_Y_GAP.toFixed(3)}.
          </div>
        )}
        {ordered.map((variation: any) => (
          <VariationBlock
            key={variation.name}
            variation={variation}
            onClick={onVariationClick ? () => onVariationClick(variation.step as any) : undefined}
          />
        ))}
        {gaps.shadeGap != null && gaps.shadeGap < Math.round(RECOMMENDED_SHADE_Y_GAP * 1000) / 1000 && (
          <div style={{
            margin: '4px 0',
            padding: '6px 8px',
            borderRadius: '8px',
            background: 'var(--surface-strong, #fef3c7)',
            color: 'var(--foreground, #7a5d00)',
            border: '1px solid var(--border, #f59e0b)'
          }}>
            {name} dark vs darker gap {gaps.shadeGap.toFixed(3)} is below the recommended minimum {RECOMMENDED_SHADE_Y_GAP.toFixed(3)}.
          </div>
        )}
      </div>
    </div>
  );
};

function pickVariation(color: any, step: 'lighter' | 'light' | 'dark' | 'darker') {
  return color.variations.find((v: any) => v.step === step) ?? color.variations[0];
}

const SemanticBlock = ({
  color,
  name,
  step,
}: {
  color: any;
  name: string;
  step: 'lighter' | 'light' | 'dark' | 'darker';
}) => {
  const v = pickVariation(color, step);
  // Force the display name to the semantic token rather than base-color-step
  const variation = { ...v, name: `${name}` };
  return <VariationBlock variation={variation} />;
};

// Helpers
function hexToHslString(hex: string, oneDecimal: boolean = false): string {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r1: h = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
      case g1: h = (b1 - r1) / d + 2; break;
      case b1: h = (r1 - g1) / d + 4; break;
    }
    h /= 6;
  }
  const Hn = h * 360;
  const Sn = s * 100;
  const Ln = l * 100;
  const H = oneDecimal ? Hn.toFixed(1) : Math.round(Hn).toString();
  const S = oneDecimal ? Sn.toFixed(1) : Math.round(Sn).toString();
  const L = oneDecimal ? Ln.toFixed(1) : Math.round(Ln).toString();
  return `hsl(${H}, ${S}%, ${L}%)`;
}

const LoadingSkeleton = () => (
  <div className={styles.colorCard}>
    <Skeleton style={{ borderRadius: 'var(--radius-md)', padding: 'var(--spacing-6) var(--spacing-4)' }} />
    <div className={styles.variationsContainer}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ borderRadius: 'var(--radius-md)', padding: 'var(--spacing-4)' }} />
      ))}
    </div>
  </div>
);

export const ColorDisplay = ({ palette, isLoading, onVariationClick }: ColorDisplayProps) => {
  return (
    <section className={styles.section}>
      <h2 className={`${styles.sectionTitle} cf-font-600`}>Color Palette</h2>
      <p className={styles.sectionInstructions}>
        Click a color to adjust its tints and shades. Scroll down to see Example Components.
        All colors are optimized for excellent contrast with near-white or near-black text.
        The export will include multiple WordPress Theme Variations that swap which colors are used for headings, links, menus, and more.
      </p>
      <div className={styles.paletteGrid}>
        {isLoading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : (
          <>
            <ColorCard
              color={palette.primary}
              name="Primary"
              onVariationClick={(step) => onVariationClick?.('primary', step)}
            />
            <ColorCard
              color={palette.secondary}
              name="Secondary"
              onVariationClick={(step) => onVariationClick?.('secondary', step)}
            />
            <ColorCard
              color={palette.tertiary}
              name="Tertiary"
              onVariationClick={(step) => onVariationClick?.('tertiary', step)}
            />
            <ColorCard
              color={palette.accent}
              name="Accent"
              onVariationClick={(step) => onVariationClick?.('accent', step)}
            />
          </>
        )}
      </div>

      <h3 className={`${styles.semanticTitle} cf-font-600`}>Semantic Colors</h3>
      <div className={styles.semanticContainer}>
        {isLoading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : (
          <>
            <SemanticBlock color={palette.error} name="Error" step="dark" />
            <SemanticBlock color={palette.warning} name="Warning" step="light" />
            <SemanticBlock color={palette.success} name="Success" step="dark" />
          </>
        )}
      </div>
    </section>
  );
};
