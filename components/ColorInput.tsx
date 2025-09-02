import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import styles from './ColorInput.module.css';

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

  useEffect(() => {
    setInternalValue(value);
    if (isValidHex(value)) {
      lastValidRef.current = value;
    }
  }, [value]);

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
    colorPickerRef.current?.click();
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

  return (
    <div {...divProps} className={`${styles.wrapper} ${className || ''}`}>
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