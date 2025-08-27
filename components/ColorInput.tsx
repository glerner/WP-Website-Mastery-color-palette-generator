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
  const colorPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (/^#[0-9a-f]{6}$/i.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange(newValue);
  };

  const handlePickerClick = () => {
    colorPickerRef.current?.click();
  };

  // Extract ARIA and onBlur intended for the actual control (from FormControl Slot)
  const { ['aria-invalid']: ariaInvalid, ['aria-describedby']: ariaDescribedBy, onBlur, ...divProps } = rest as any;

  return (
    <div {...divProps} className={`${styles.wrapper} ${className || ''}`}>
      <div
        className={styles.colorSwatch}
        style={{ backgroundColor: internalValue }}
        onClick={handlePickerClick}
      />
      <input
        ref={colorPickerRef}
        type="color"
        value={internalValue}
        onChange={handleColorChange}
        className={styles.nativeColorPicker}
      />
      <Input
        type="text"
        id={id}
        value={internalValue}
        onChange={handleTextChange}
        onBlur={onBlur}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={styles.hexInput}
        maxLength={7}
      />
      {trailing}
    </div>
  );
};