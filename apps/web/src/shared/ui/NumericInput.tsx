import React, { useState } from 'react';

interface NumericInputProps {
  value: number;
  onChangeValue: (val: number) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  commitZeroOnEmpty?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Controlled numeric text field that preserves empty strings ("") and
 * trailing decimals ("8.") while focused so users can freely clear "0"
 * and type replacements without getting trapped by "|| 0" snap-backs.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChangeValue,
  min = 0,
  max,
  allowDecimal = false,
  commitZeroOnEmpty = false,
  ariaLabel,
  placeholder,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);

  const displayValue = isFocused && editingText !== null ? editingText : String(value);

  const clampNum = (num: number): number => {
    let out = num;
    if (Number.isFinite(min) && out < min) out = min;
    if (typeof max === 'number' && Number.isFinite(max) && out > max) out = max;
    return out;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const validPattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!validPattern.test(raw)) return;

    setEditingText(raw);

    if (raw === '' || raw === '.') {
      if (commitZeroOnEmpty) {
        onChangeValue(clampNum(0));
      }
      return;
    }

    // While user is mid-decimal like "8.", keep visual text intact until digit follows
    if (raw.endsWith('.')) return;

    const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;

    // Allow partial typing (e.g. typing "1" then "0" for "10000" when min=10000) without snapping before blur
    if (parsed >= min && (max === undefined || parsed <= max)) {
      onChangeValue(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setEditingText(String(value));
    // Auto-select single "0" on focus/click makes typing a replacement effortless too
    if (value === 0) {
      e.currentTarget.select();
    }
  };

  const handleBlur = () => {
    if (editingText !== null) {
      if (editingText === '' || editingText === '.') {
        if (commitZeroOnEmpty) {
          onChangeValue(clampNum(0));
        }
      } else {
        const parsed = allowDecimal ? parseFloat(editingText) : parseInt(editingText, 10);
        if (Number.isFinite(parsed)) {
          onChangeValue(clampNum(parsed));
        }
      }
    }
    setIsFocused(false);
    setEditingText(null);
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={displayValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};
