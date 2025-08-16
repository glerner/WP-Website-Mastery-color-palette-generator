import React from 'react';
import { ThemeVariation } from '../helpers/generateThemeVariations';
import { ensureAAAContrast } from '../helpers/ensureAAAContrast';
import { Skeleton } from './Skeleton';
import styles from './ThemeVariations.module.css';

interface ThemeVariationsProps {
  variations: ThemeVariation[];
  isLoading: boolean;
}

const VariationCard = ({ variation }: { variation: ThemeVariation }) => {
  const { name, description, palette } = variation;

  return (
    <div className={styles.variationCard}>
      <div className={styles.variationHeader}>
        <h4 className={styles.variationName}>{name}</h4>
        <p className={styles.variationDescription}>{description}</p>
      </div>
      <div className={styles.colorSwatches}>
        <div 
          className={styles.colorSwatch} 
          style={{ 
            backgroundColor: palette.primary.hex,
            ...(ensureAAAContrast(palette.primary.hex).overlayColor && {
              backgroundImage: `linear-gradient(${ensureAAAContrast(palette.primary.hex).overlayColor}, ${ensureAAAContrast(palette.primary.hex).overlayColor})`
            })
          }}
        >
          <span 
            className={styles.colorLabel}
            style={{ color: ensureAAAContrast(palette.primary.hex).textColor }}
          >
            P
          </span>
        </div>
        <div 
          className={styles.colorSwatch} 
          style={{ 
            backgroundColor: palette.secondary.hex,
            ...(ensureAAAContrast(palette.secondary.hex).overlayColor && {
              backgroundImage: `linear-gradient(${ensureAAAContrast(palette.secondary.hex).overlayColor}, ${ensureAAAContrast(palette.secondary.hex).overlayColor})`
            })
          }}
        >
          <span 
            className={styles.colorLabel}
            style={{ color: ensureAAAContrast(palette.secondary.hex).textColor }}
          >
            S
          </span>
        </div>
        <div 
          className={styles.colorSwatch} 
          style={{ 
            backgroundColor: palette.tertiary.hex,
            ...(ensureAAAContrast(palette.tertiary.hex).overlayColor && {
              backgroundImage: `linear-gradient(${ensureAAAContrast(palette.tertiary.hex).overlayColor}, ${ensureAAAContrast(palette.tertiary.hex).overlayColor})`
            })
          }}
        >
          <span 
            className={styles.colorLabel}
            style={{ color: ensureAAAContrast(palette.tertiary.hex).textColor }}
          >
            T
          </span>
        </div>
        <div 
          className={styles.colorSwatch} 
          style={{ 
            backgroundColor: palette.accent.hex,
            ...(ensureAAAContrast(palette.accent.hex).overlayColor && {
              backgroundImage: `linear-gradient(${ensureAAAContrast(palette.accent.hex).overlayColor}, ${ensureAAAContrast(palette.accent.hex).overlayColor})`
            })
          }}
        >
          <span 
            className={styles.colorLabel}
            style={{ color: ensureAAAContrast(palette.accent.hex).textColor }}
          >
            A
          </span>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className={styles.variationCard}>
    <div className={styles.variationHeader}>
      <Skeleton style={{ height: '1.5rem', width: '80px' }} />
      <Skeleton style={{ height: '1rem', width: '120px' }} />
    </div>
    <div className={styles.colorSwatches}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: '3rem', width: '3rem', borderRadius: '50%' }} />
      ))}
    </div>
  </div>
);

export const ThemeVariations = ({ variations, isLoading }: ThemeVariationsProps) => {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Theme Variations</h2>
      <p className={styles.sectionDescription}>
        Explore different combinations of your core colors. Each variation maintains the same accent and semantic colors while rotating the primary, secondary, and tertiary assignments.
      </p>
      <div className={styles.variationsGrid}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} />
          ))
        ) : (
          variations.map((variation) => (
            <VariationCard key={variation.name} variation={variation} />
          ))
        )}
      </div>
    </section>
  );
};