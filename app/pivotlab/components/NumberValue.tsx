import type { NumberDisplay } from '../math/rational';
import { formatRational, Rational } from '../math/rational';

interface NumberValueProps {
  value: Rational;
  display: NumberDisplay;
}

export function NumberValue({ value, display }: NumberValueProps) {
  if (display.mode === 'decimal' || value.denominator === 1n) {
    return <span className="number-value integer-value">{formatRational(value, display)}</span>;
  }
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  return (
    <span className="number-value fraction-value" aria-label={value.toFraction()}>
      {negative && <span className="fraction-sign" aria-hidden="true" />}
      <span className="fraction-stack">
        <span>{numerator.toString()}</span>
        <span>{value.denominator.toString()}</span>
      </span>
    </span>
  );
}
