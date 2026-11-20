import { useId, useLayoutEffect, useRef, useState } from 'react';
import { errorText } from '../app/i18n';
import { useLanguage } from '../app/languageContext';
import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';

interface CellInputProps {
  value: Rational;
  display: NumberDisplay;
  ariaLabel: string;
  gridRow: number;
  gridColumn: number;
  onCommit: (value: Rational) => void;
  onInvalid?: (message: string) => void;
}

export function CellInput({ value, display, ariaLabel, gridRow, gridColumn, onCommit, onInvalid }: CellInputProps) {
  const { language, t } = useLanguage();
  const formatted = formatRational(value, display);
  const restingValue = language === 'ru' ? formatted.replace('.', ',') : formatted;
  const [draft, setDraft] = useState(restingValue);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const edited = useRef(false);
  const skipBlurCommit = useRef(false);

  useLayoutEffect(() => {
    if (focused) input.current?.select();
  }, [focused]);

  const commit = (): boolean => {
    if (!edited.current) return true;
    try {
      const parsed = Rational.parse(draft);
      if (!parsed.equals(value)) onCommit(parsed);
      edited.current = false;
      setError(null);
      return true;
    } catch (caught) {
      const message = errorText(t, caught, 'Invalid number.');
      setError(message);
      onInvalid?.(message);
      return false;
    }
  };

  const moveToCell = (row: number, column: number) => {
    const table = document.activeElement?.closest('table');
    const next = table?.querySelector<HTMLInputElement>(
      `.cell-input[data-grid-row="${row}"][data-grid-column="${column}"]`,
    );
    if (!next) return;
    next.focus();
  };

  return (
    <>
    <input
      ref={input}
      className={`cell-input${error ? ' invalid' : ''}`}
      value={focused || error ? draft : restingValue}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      data-grid-row={gridRow}
      data-grid-column={gridColumn}
      title={error ?? t('Integers, decimals, and fractions are accepted')}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      enterKeyHint="done"
      onFocus={() => {
        setFocused(true);
        if (!error) setDraft(value.toFraction());
      }}
      onChange={(event) => {
        edited.current = true;
        setDraft(event.target.value);
        setError(null);
      }}
      onBlur={() => {
        setFocused(false);
        if (skipBlurCommit.current) skipBlurCommit.current = false;
        else commit();
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          if (commit()) {
            skipBlurCommit.current = true;
            event.currentTarget.blur();
          }
        }
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
          edited.current = false;
          skipBlurCommit.current = true;
          setError(null);
          event.currentTarget.blur();
        }
      }}
    />
    {error && <span id={errorId} className="visually-hidden">{error}</span>}
    </>
  );
}
