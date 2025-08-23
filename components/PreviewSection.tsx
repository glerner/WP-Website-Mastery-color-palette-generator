import React from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { PaletteWithVariations } from '../helpers/types';
import { ensureAAAContrast } from '../helpers/ensureAAAContrast';
import styles from './PreviewSection.module.css';

interface PreviewSectionProps {
  palette: PaletteWithVariations;
  isLoading: boolean;
}

export const PreviewSection = ({ palette, isLoading }: PreviewSectionProps) => {
  if (isLoading) {
    return (
      <section>
        <h2 className={`${styles.sectionTitle} cf-font-600`}>UI Preview</h2>
        <div className={styles.previewContainer}>
          <div className={styles.previewCard}>
            <Skeleton style={{ width: '120px', height: '24px', marginBottom: 'var(--spacing-4)' }} />
            <Skeleton style={{ width: '100%', height: '40px', marginBottom: 'var(--spacing-2)' }} />
            <Skeleton style={{ width: '100%', height: '40px', marginBottom: 'var(--spacing-4)' }} />
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
              <Skeleton style={{ flex: 1, height: '40px' }} />
              <Skeleton style={{ flex: 1, height: '40px' }} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { primary, secondary, tertiary, accent, error, warning, success } = palette;

  // Use variations for backgrounds and components
  const backgroundPrimary = primary.variations[0]; // lightest
  const cardBackground = primary.variations[1]; // light
  const borderColor = primary.variations[2]; // medium
  const textColor = primary.variations[3]; // darker

  // Use mid-tone variations for button backgrounds
  const primaryButtonBg = primary.variations[2]; // medium tone for primary button
  const secondaryButtonBg = secondary.variations[1]; // light tone for secondary button
  const accentBadgeBg = accent.variations[2]; // medium tone for accent badge

  // Calculate AAA contrast for all text elements
  const backgroundContrast = ensureAAAContrast(backgroundPrimary.hex);
  const cardContrast = ensureAAAContrast(cardBackground.hex);
  const primaryButtonContrast = ensureAAAContrast(primaryButtonBg.hex);
  const secondaryButtonContrast = ensureAAAContrast(secondaryButtonBg.hex);
  const accentBadgeContrast = ensureAAAContrast(accentBadgeBg.hex);
  const defaultBadgeContrast = ensureAAAContrast(primary.variations[0].hex); // Use lightest for default badge

  const previewStyle = {
    // Background colors using variations
    '--preview-bg': backgroundPrimary.hex,
    '--preview-card': cardBackground.hex,
    '--preview-border': borderColor.hex,
    
    // Text colors with AAA contrast
    '--preview-bg-text': backgroundContrast.textColor,
    '--preview-card-text': cardContrast.textColor,
    
    // Button colors and text
    '--preview-primary-btn': primaryButtonBg.hex,
    '--preview-primary-btn-text': primaryButtonContrast.textColor,
    '--preview-secondary-btn': secondaryButtonBg.hex,
    '--preview-secondary-btn-text': secondaryButtonContrast.textColor,
    
    // Badge colors
    '--preview-accent-badge': accentBadgeBg.hex,
    '--preview-accent-badge-text': accentBadgeContrast.textColor,
    '--preview-default-badge': primary.variations[0].hex,
    '--preview-default-badge-text': defaultBadgeContrast.textColor,
    
    // Overlays for additional contrast when needed
    '--preview-bg-overlay': backgroundContrast.overlayColor || 'none',
    '--preview-card-overlay': cardContrast.overlayColor || 'none',
    '--preview-primary-btn-overlay': primaryButtonContrast.overlayColor || 'none',
    '--preview-secondary-btn-overlay': secondaryButtonContrast.overlayColor || 'none',
    '--preview-accent-badge-overlay': accentBadgeContrast.overlayColor || 'none',
    '--preview-default-badge-overlay': defaultBadgeContrast.overlayColor || 'none',
    
    // Input styling
    '--preview-input-bg': cardBackground.hex,
    '--preview-input-border': borderColor.hex,
    '--preview-input-text': cardContrast.textColor,
  } as React.CSSProperties;

  return (
    <section>
      <h2 className={`${styles.sectionTitle} cf-font-600`}>UI Preview</h2>
      <div className={styles.previewContainer} style={previewStyle}>
        {backgroundContrast.overlayColor && (
          <div className={styles.backgroundOverlay} />
        )}
        <div className={styles.previewCard}>
          {cardContrast.overlayColor && (
            <div className={styles.cardOverlay} />
          )}
          <h3 className={`${styles.previewCardTitle} cf-font-600`}>Example Component</h3>
          <p className={styles.previewText}>
            This is some sample text to demonstrate text color on the background.
            The quick brown fox jumps over the lazy dog.
          </p>
          <div className={styles.formGroup}>
            <label className={`${styles.label}`}>Email Address</label>
            <Input placeholder="you@example.com" className={styles.previewInput} />
          </div>
          <div className={styles.buttonGroup}>
            <Button className={styles.primaryButton}>
              {primaryButtonContrast.overlayColor && (
                <div className={styles.buttonOverlay} />
              )}
              <span className={styles.buttonText}>Primary Action</span>
            </Button>
            <Button className={styles.secondaryButton}>
              {secondaryButtonContrast.overlayColor && (
                <div className={styles.buttonOverlay} />
              )}
              <span className={styles.buttonText}>Secondary</span>
            </Button>
          </div>
          <div className={styles.badgeGroup}>
            <Badge className={styles.accentBadge}>
              {accentBadgeContrast.overlayColor && (
                <div className={styles.badgeOverlay} />
              )}
              <span className={styles.badgeText}>New</span>
            </Badge>
            <Badge className={styles.defaultBadge}>
              {defaultBadgeContrast.overlayColor && (
                <div className={styles.badgeOverlay} />
              )}
              <span className={styles.badgeText}>Default</span>
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
};