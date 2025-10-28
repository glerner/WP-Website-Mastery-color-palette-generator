import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import styles from './ColorInput.module.css';
import { HslColorPicker } from 'react-colorful';
import { hexToRgb, rgbToHex, rgbToHslNorm, hslNormToRgb } from '../helpers/colorUtils';

type DivProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>;

interface ColorInputProps extends DivProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Optional trailing element rendered inside the wrapper after inputs (e.g., a label) */
  trailing?: React.ReactNode;
}

export const ColorInput = ({ value, onChange, className, trailing, id, ...rest }: ColorInputProps) => {
  const [internalValue, setInternalValue] = useState(value);
  const lastValidRef = useRef<string>(/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000');
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [showPopover, setShowPopover] = useState(false);
  // h in degrees [0,360), s/l in [0,1]
  const [hsl, setHsl] = useState<{ h: number; s: number; l: number }>(() => {
    const { r, g, b } = hexToRgb(/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000');
    return rgbToHslNorm(r, g, b);
  });
  // Track the HSL at popover open for cancel behavior
  const startHslRef = useRef<{ h: number; s: number; l: number } | null>(null);
  const fromPickerRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const pendingHslRef = useRef<{ h: number; s: number; l: number } | null>(null);
  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  useEffect(() => {
    setInternalValue(value);
    if (isValidHex(value)) {
      lastValidRef.current = value;
    }
    // Skip syncing HSL if the change is originating from the picker drag this frame
    if (fromPickerRef.current) return;
    // Keep HSL in sync with external value
    try {
      const { r, g, b } = hexToRgb(isValidHex(value) ? value : lastValidRef.current);
      setHsl(rgbToHslNorm(r, g, b));
    } catch {}
  }, [value]);

  // Cleanup any pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const isValidHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
  const isSixHexNoHash = (v: string) => /^[0-9a-f]{6}$/i.test(v);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.trim();
    setInternalValue(newValue);
    // Only propagate when fully valid #RRGGBB
    if (isValidHex(newValue)) {
      lastValidRef.current = newValue;
      onChange(newValue);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Native color input always returns valid #RRGGBB
    setInternalValue(newValue);
    lastValidRef.current = newValue;
    onChange(newValue);
  };

  const handlePickerClick = () => {
    // Open custom HSL popover and remember starting HSL for cancel
    startHslRef.current = hsl;
    setShowPopover(true);
  };

  // Extract ARIA and onBlur intended for the actual control (from FormControl Slot)
  const { ['aria-invalid']: ariaInvalid, ['aria-describedby']: ariaDescribedBy, onBlur, ...divProps } = rest as any;

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Normalize on blur: accept '#RRGGBB' or 'RRGGBB' and convert to '#RRGGBB'
    let v = internalValue.trim();
    if (isValidHex(v)) {
      // already valid
      lastValidRef.current = v;
      onChange(v);
    } else if (isSixHexNoHash(v)) {
      const normalized = '#' + v.toUpperCase();
      setInternalValue(normalized);
      lastValidRef.current = normalized;
      onChange(normalized);
    } else {
      // revert to last valid
      setInternalValue(lastValidRef.current);
    }
    onBlur?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const cleaned = text.trim().replace(/\s+/g, '');
    if (isValidHex(cleaned) || isSixHexNoHash(cleaned)) {
      e.preventDefault();
      const normalized = isValidHex(cleaned)
        ? cleaned.toUpperCase()
        : ('#' + cleaned.toUpperCase());
      setInternalValue(normalized);
      lastValidRef.current = normalized;
      onChange(normalized);
    }
  };

  // Close popover when clicking outside
  const commitPopover = () => {
    // Convert current HSL to HEX, update and propagate
    const rgb = hslNormToRgb(hsl.h, hsl.s, hsl.l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase();
    setInternalValue(hex);
    lastValidRef.current = hex;
    onChange(hex);
    setShowPopover(false);
  };

  const cancelPopover = () => {
    // Revert HSL to starting value; do not propagate changes
    if (startHslRef.current) {
      setHsl(startHslRef.current);
    }
    setShowPopover(false);
  };

  useEffect(() => {
    if (!showPopover) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(t)) {
        cancelPopover();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPopover();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showPopover]);

  // react-colorful's HslColorPicker uses h in degrees, s/l in [0,100].
  // Our helpers expect h in degrees, s/l in [0,1].
  const handleHslChange = (next: { h: number; s: number; l: number }) => {
    // Throttle updates to once per animation frame; update HSL state only (no HEX propagation)
    pendingHslRef.current = next;
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const latest = pendingHslRef.current!;
        pendingHslRef.current = null;
        fromPickerRef.current = true;
        const normalized = {
          h: latest.h, // degrees
          s: round3(latest.s / 100),
          l: round3(latest.l / 100),
        };
        // Only update state if meaningfully changed to reduce jitter
        setHsl((prev) => {
          if (
            Math.abs(prev.h - normalized.h) < 0.01 &&
            Math.abs(prev.s - normalized.s) < 0.001 &&
            Math.abs(prev.l - normalized.l) < 0.001
          ) {
            return prev;
          }
          return normalized;
        });
        // Allow external sync on next frame after state settles
        requestAnimationFrame(() => {
          fromPickerRef.current = false;
        });
      });
    }
  };

  return (
    <div {...divProps} className={`${styles.wrapper} ${className || ''}`} ref={wrapperRef}>
      <div
        className={styles.colorSwatch}
        style={{ backgroundColor: isValidHex(internalValue) ? internalValue : lastValidRef.current }}
        onClick={handlePickerClick}
      />
      <input
        ref={colorPickerRef}
        type="color"
        value={isValidHex(internalValue) ? internalValue : lastValidRef.current}
        onChange={handleColorChange}
        className={styles.nativeColorPicker}
      />
      {showPopover && (
        <div ref={popoverRef} className={styles.popover} role="dialog" aria-modal="true">
          <HslColorPicker
            color={{ h: hsl.h, s: hsl.s * 100, l: hsl.l * 100 }}
            onChange={handleHslChange}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--cf-text-s)', justifyContent: 'space-between' }}>
              <span>H</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={0}
                  max={360}
                  step={1}
                  value={Math.round(hsl.h)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const h = isFinite(v) ? Math.max(0, Math.min(360, v)) : 0;
                    handleHslChange({ h, s: hsl.s * 100, l: hsl.l * 100 });
                  }}
                />
                <div className={styles.stepper}>
                  <button type="button" aria-label="Increase hue" onClick={() => {
                    const h = Math.min(360, Math.round(hsl.h) + 1);
                    handleHslChange({ h, s: hsl.s * 100, l: hsl.l * 100 });
                  }}>▲</button>
                  <button type="button" aria-label="Decrease hue" onClick={() => {
                    const h = Math.max(0, Math.round(hsl.h) - 1);
                    handleHslChange({ h, s: hsl.s * 100, l: hsl.l * 100 });
                  }}>▼</button>
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--cf-text-s)', justifyContent: 'space-between' }}>
              <span>S</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(hsl.s * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const s = isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
                    handleHslChange({ h: hsl.h, s, l: hsl.l * 100 });
                  }}
                />
                <div className={styles.stepper}>
                  <button type="button" aria-label="Increase saturation" onClick={() => {
                    const s = Math.min(100, Math.round(hsl.s * 100) + 1);
                    handleHslChange({ h: hsl.h, s, l: hsl.l * 100 });
                  }}>▲</button>
                  <button type="button" aria-label="Decrease saturation" onClick={() => {
                    const s = Math.max(0, Math.round(hsl.s * 100) - 1);
                    handleHslChange({ h: hsl.h, s, l: hsl.l * 100 });
                  }}>▼</button>
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--cf-text-s)', justifyContent: 'space-between' }}>
              <span>L</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(hsl.l * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const l = isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
                    handleHslChange({ h: hsl.h, s: hsl.s * 100, l });
                  }}
                />
                <div className={styles.stepper}>
                  <button type="button" aria-label="Increase lightness" onClick={() => {
                    const l = Math.min(100, Math.round(hsl.l * 100) + 1);
                    handleHslChange({ h: hsl.h, s: Math.round(hsl.s * 100), l });
                  }}>▲</button>
                  <button type="button" aria-label="Decrease lightness" onClick={() => {
                    const l = Math.max(0, Math.round(hsl.l * 100) - 1);
                    handleHslChange({ h: hsl.h, s: Math.round(hsl.s * 100), l });
                  }}>▼</button>
                </div>
              </div>
            </label>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={cancelPopover} style={{ fontSize: 'var(--cf-text-s)' }}>
              Cancel
            </button>
            <button type="button" onClick={commitPopover} style={{ fontSize: 'var(--cf-text-s)' }}>
              OK
            </button>
          </div>
        </div>
      )}
      <Input
        type="text"
        id={id}
        value={internalValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={styles.hexInput}
        placeholder="#RRGGBB"
        title="Enter a hex color like #1A2B3C (you can also enter 6 hex digits)"
        maxLength={7}
      />
      {trailing}
    </div>
  );
};