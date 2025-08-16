import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import styles from './ColorInput.module.css';

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const ColorInput = ({ value, onChange, className }: ColorInputProps) => {
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

  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
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
        value={internalValue}
        onChange={handleTextChange}
        className={styles.hexInput}
        maxLength={7}
      />
    </div>
  );
};