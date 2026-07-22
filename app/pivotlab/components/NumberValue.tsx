import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';

interface NumberValueProps {
  value: Rational;
  display: NumberDisplay;
  alignMagnitude?: boolean;
}

export function NumberValue({ value, display, alignMagnitude = false }: NumberValueProps) {
  if (display.mode === 'decimal' || value.denominator === 1n) {
    const formatted = formatRational(value, display);
    const negative = formatted.startsWith('-');
    return (
      <span className={`number-value integer-value ${alignMagnitude ? 'aligned-number-value' : 'inline-number-value'}`} aria-label={formatted}>
        {negative && <span className="number-sign negative" aria-hidden="true" />}
        <span className="number-magnitude">{negative ? formatted.slice(1) : formatted}</span>
      </span>
    );
  }
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  return (
    <span className={`number-value fraction-value ${alignMagnitude ? 'aligned-number-value' : 'inline-number-value'}`} aria-label={value.toFraction()}>
      {negative && <span className="number-sign negative" aria-hidden="true" />}
      <span className="number-magnitude fraction-stack">
        <span>{numerator.toString()}</span>
        <span>{value.denominator.toString()}</span>
      </span>
    </span>
  );
}
