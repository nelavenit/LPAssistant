import { useEffect, useRef, useState } from 'react';
import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';

interface CellInputProps {
  value: Rational;
  display: NumberDisplay;
  ariaLabel: string;
  onCommit: (value: Rational) => void;
}

export function CellInput({ value, display, ariaLabel, onCommit }: CellInputProps) {
  const [draft, setDraft] = useState(() => formatRational(value, display));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatRational(value, display));
  }, [value, display]);

  const commit = () => {
    try {
      const parsed = Rational.parse(draft);
      onCommit(parsed);
      setDraft(formatRational(parsed, display));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid number.');
    }
  };

  return (
    <input
      className={`cell-input${error ? ' invalid' : ''}`}
      value={draft}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error)}
      title={error ?? 'Integers, decimals, and fractions are accepted'}
      spellCheck={false}
      inputMode="decimal"
      onFocus={(event) => {
        focused.current = true;
        setDraft(value.toFraction());
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        setError(null);
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(formatRational(value, display));
          setError(null);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
