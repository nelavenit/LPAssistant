export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint | number | string, denominator: bigint | number | string = 1n) {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) throw new RangeError('The denominator cannot be zero.');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const divisor = gcd(abs(n), d);
    this.numerator = n / divisor;
    this.denominator = d / divisor;
  }

  static readonly ZERO = new Rational(0n);
  static readonly ONE = new Rational(1n);

  static parse(source: string): Rational {
    const value = source.trim().replaceAll('−', '-').replaceAll(',', '.');
    if (!value) throw new SyntaxError('Enter a number.');
    const slash = value.indexOf('/');
    if (slash >= 0) {
      if (value.indexOf('/', slash + 1) >= 0) throw new SyntaxError('Use at most one fraction bar.');
      const left = Rational.parseDecimal(value.slice(0, slash));
      const right = Rational.parseDecimal(value.slice(slash + 1));
      return left.div(right);
    }
    return Rational.parseDecimal(value);
  }

  private static parseDecimal(source: string): Rational {
    const value = source.trim();
    const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(value);
    if (!match) throw new SyntaxError(`“${source}” is not a valid integer, decimal, or fraction.`);
    const sign = match[1] === '-' ? -1n : 1n;
    const integer = match[2] ?? '0';
    const fractional = match[3] ?? match[4] ?? '';
    const exponent = Number(match[5] ?? 0);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100_000) {
      throw new RangeError('The exponent is too large.');
    }
    let n = sign * BigInt(`${integer}${fractional}` || '0');
    let d = pow10(fractional.length);
    if (exponent > 0) n *= pow10(exponent);
    if (exponent < 0) d *= pow10(-exponent);
    return new Rational(n, d);
  }

  add(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  sub(other: Rational): Rational {
    return this.add(other.neg());
  }

  mul(other: Rational): Rational {
    return new Rational(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  div(other: Rational): Rational {
    if (other.isZero()) throw new RangeError('Division by zero.');
    return new Rational(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  neg(): Rational {
    return new Rational(-this.numerator, this.denominator);
  }

  abs(): Rational {
    return this.numerator < 0n ? this.neg() : this;
  }

  compare(other: Rational): number {
    const delta = this.numerator * other.denominator - other.numerator * this.denominator;
    return delta < 0n ? -1 : delta > 0n ? 1 : 0;
  }

  equals(other: Rational): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator;
  }

  isZero(): boolean {
    return this.numerator === 0n;
  }

  isPositive(): boolean {
    return this.numerator > 0n;
  }

  isNegative(): boolean {
    return this.numerator < 0n;
  }

  toFraction(): string {
    return this.denominator === 1n
      ? this.numerator.toString()
      : `${this.numerator}/${this.denominator}`;
  }

  toDecimal(precision = 3, trimTrailingZeros = false): string {
    if (!Number.isInteger(precision) || precision < 0 || precision > 20) {
      throw new RangeError('Decimal precision must be between 0 and 20.');
    }
    const negative = this.numerator < 0n;
    const scale = pow10(precision);
    const scaledNumerator = abs(this.numerator) * scale;
    let quotient = scaledNumerator / this.denominator;
    const remainder = scaledNumerator % this.denominator;
    if (remainder * 2n >= this.denominator) quotient += 1n;

    let digits = quotient.toString();
    if (precision > 0) {
      digits = digits.padStart(precision + 1, '0');
      const split = digits.length - precision;
      digits = `${digits.slice(0, split)}.${digits.slice(split)}`;
      if (trimTrailingZeros) digits = digits.replace(/\.?0+$/, '');
    }
    const roundedIsZero = quotient === 0n;
    return negative && !roundedIsZero ? `-${digits}` : digits;
  }

  toString(): string {
    return this.toFraction();
  }
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

export type NumberDisplay =
  | { mode: 'fraction' }
  | { mode: 'decimal'; precision: number };

export function formatRational(value: Rational, display: NumberDisplay): string {
  return display.mode === 'fraction'
    ? value.toFraction()
    : value.toDecimal(display.precision);
}
