import React from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Badge } from './Badge';
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
            The quick brown fox jumps over the lazy dog.
          </p>
          <div className={styles.formGroup}>
            <label>Email Address</label>
            <Input placeholder="you@example.com" />
          </div>
          <div className={styles.buttonGroup}>
            <Button>Primary Action</Button>
            <Button>Secondary</Button>
          </div>
          <div className={styles.badgeGroup}>
            <Badge>New</Badge>
            <Badge>Default</Badge>
          </div>
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