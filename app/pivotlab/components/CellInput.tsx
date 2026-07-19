import { useEffect, useRef, useState } from 'react';
import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';

interface CellInputProps {
  value: Rational;
  display: NumberDisplay;
  ariaLabel: string;
  gridRow: number;
  gridColumn: number;
  onCommit: (value: Rational) => void;
}

export function CellInput({ value, display, ariaLabel, gridRow, gridColumn, onCommit }: CellInputProps) {
  const [draft, setDraft] = useState(() => formatRational(value, display));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatRational(value, display));
  }, [value, display]);

  const commit = (): boolean => {
    try {
      const parsed = Rational.parse(draft);
      onCommit(parsed);
      setDraft(formatRational(parsed, display));
      setError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid number.');
      return false;
    }
  };

  const moveToCell = (row: number, column: number) => {
    const table = document.activeElement?.closest('table');
    const next = table?.querySelector<HTMLInputElement>(
      `.cell-input[data-grid-row="${row}"][data-grid-column="${column}"]`,
    );
    if (!next) return;
    skipBlurCommit.current = true;
    next.focus();
    next.select();
  };

  return (
    <input
      className={`cell-input${error ? ' invalid' : ''}`}
      value={draft}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error)}
      data-grid-row={gridRow}
      data-grid-column={gridColumn}
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
        if (skipBlurCommit.current) skipBlurCommit.current = false;
        else commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        const movement = ({
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        } as Record<string, readonly [number, number]>)[event.key];
        if (movement) {
          event.preventDefault();
          if (commit()) moveToCell(gridRow + movement[0], gridColumn + movement[1]);
        }
        if (event.key === 'Escape') {
          setDraft(formatRational(value, display));
          setError(null);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
