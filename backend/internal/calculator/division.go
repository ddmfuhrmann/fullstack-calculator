package calculator

import "github.com/shopspring/decimal"

// precision is the number of decimal places kept by the operations that
// cannot be exact (divide, sqrt, negative exponents). They round half away
// from zero.
const precision = 34

func divide(operands []decimal.Decimal) (decimal.Decimal, error) {
	if operands[1].IsZero() {
		return decimal.Decimal{}, ErrDivisionByZero
	}
	return operands[0].DivRound(operands[1], precision), nil
}

// percentage computes a% of b as a × b ÷ 100, which is exact.
func percentage(operands []decimal.Decimal) (decimal.Decimal, error) {
	return operands[0].Mul(operands[1]).Shift(-2), nil
}
