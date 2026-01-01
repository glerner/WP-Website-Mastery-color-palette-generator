import React from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { PaletteWithVariations } from '../helpers/types';
import styles from './PreviewSection.module.css';

interface PreviewSectionProps {
  palette: PaletteWithVariations;
  isLoading: boolean;
  scheme?: 'auto' | 'light' | 'dark';
}

export const PreviewSection = ({ palette: _palette, isLoading, scheme }: PreviewSectionProps) => {
  if (isLoading) {
    return (
      <section>
        <h2 className={styles.sectionTitle}>UI Preview</h2>
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

  const previewStyle = (scheme && scheme !== 'auto')
    ? ({ colorScheme: scheme } as React.CSSProperties)
    : ({} as React.CSSProperties);

  return (
    <section>
      <h2 className={styles.sectionTitle}>UI Preview</h2>
      <div className={styles.previewContainer} style={previewStyle}>
        <div className={styles.previewCard}>
          <h3 className={styles.previewCardTitle}>Example Component</h3>
          <p className={styles.previewText}>
            This is some sample text to demonstrate text color on the background.
            The quick brown fox <a href="#" className={styles.inlineLink}>jumps over</a> the lazy dog.
          </p>

          {/* Info cards with primary, secondary, tertiary backgrounds */}
          <div className={styles.infoCardRow}>
            <div className={styles.infoCardPrimary}>
              <strong>Primary</strong>
              <span>Text on primary background</span>
            </div>
            <div className={styles.infoCardSecondary}>
              <strong>Secondary</strong>
              <span>Text on secondary background</span>
            </div>
            <div className={styles.infoCardTertiary}>
              <strong>Tertiary</strong>
              <span>Text on tertiary background</span>
            </div>
          </div>

          {/* Dark-background info cards (light in dark mode) */}
          <div className={styles.infoCardRow}>
            <div className={styles.infoCardPrimaryDark}>
              <strong>Primary Dark</strong>
              <span>Swaps to light in dark mode</span>
            </div>
            <div className={styles.infoCardSecondaryDark}>
              <strong>Secondary Dark</strong>
              <span>Swaps to light in dark mode</span>
            </div>
            <div className={styles.infoCardTertiaryDark}>
              <strong>Tertiary Dark</strong>
              <span>Swaps to light in dark mode</span>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Email Address</label>
            <Input placeholder="you@example.com" />
          </div>
          {/* All buttons on same row with responsive wrap */}
          <div className={styles.allButtonsRow}>
            <Button>Primary Action</Button>
            <Button>Secondary</Button>
            <Button>Tertiary</Button>
            <button className={styles.accentButtonFlat}>Accent Flat</button>
            <button className={styles.accentButtonStyled}>Accent Styled</button>
          </div>

          {/* Menu items - all on same row */}
          <nav className={styles.menuRow}>
            <a href="#" className={styles.accentMenuItemDark}>Accent dark-darker hover</a>
            <a href="#" className={styles.accentMenuItemDark}>Accent dark-darker hover</a>
            <a href="#" className={styles.accentMenuItemLight}>light-dark background hover</a>
            <a href="#" className={styles.accentMenuItemLight}>light-dark background hover</a>
          </nav>
        </div>
        {/* Alternating color list example */}
        <div className={styles.listBlock}>
          <h4 className={styles.listTitle}>List (alternating rows)</h4>
          <ul className={styles.exampleList}>
            <li>First item</li>
            <li>Second item</li>
            <li>Third item</li>
            <li>Fourth item</li>
          </ul>
        </div>
      </div>
    </section>
  );
};
