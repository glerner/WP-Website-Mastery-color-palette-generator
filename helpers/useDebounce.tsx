import { useState, useEffect } from "react";

/**
 * A custom React hook that debounces a value.
 *
 * @template T The type of the value to be debounced.
 * @param {T} value The value to debounce.
 * @param {number} delay The debounce delay in milliseconds.
 * @returns {T} The debounced value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // State to store the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(
    () => {
      // Set up a timer to update the debounced value after the specified delay
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      // Clean up the timer if the value or delay changes before the timer fires.
      // This is the core of the debounce logic.
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay], // Re-run the effect only if the value or delay changes
  );

  return debouncedValue;
}
