package calculator

import "github.com/shopspring/decimal"

// maxExponent is the largest absolute value accepted as an exponent.
const maxExponent = 1000

// power raises the base to an integer exponent. Non-negative exponents are
// exact; negative ones compute 1 ÷ base^|exponent| at the fixed precision.
func power(operands []decimal.Decimal) (decimal.Decimal, error) {
	base, exponent := operands[0], operands[1]
	if !exponent.IsInteger() || exponent.Abs().GreaterThan(decimal.NewFromInt(maxExponent)) {
		return decimal.Decimal{}, ErrUnsupportedExponent
	}
	if exponent.IsNegative() && base.IsZero() {
		return decimal.Decimal{}, ErrDivisionByZero
	}

	result := decimal.NewFromInt(1)
	for n := exponent.Abs().IntPart(); n > 0; n >>= 1 {
		if n&1 == 1 {
			result = result.Mul(base)
		}
		base = base.Mul(base)
	}
	if exponent.IsNegative() {
		return decimal.NewFromInt(1).DivRound(result, precision), nil
	}
	return result, nil
}
