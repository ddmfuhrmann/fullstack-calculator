package calculator

import (
	"math/big"

	"github.com/shopspring/decimal"
)

// sqrtWorkingPlaces is the number of decimal places of the integer square
// root, one more than the final precision so the last digit can be rounded.
const sqrtWorkingPlaces = precision + 1

// sqrt takes the integer square root of the operand scaled by
// 10^(2 × sqrtWorkingPlaces), which is the root truncated at
// sqrtWorkingPlaces, then rounds it to the fixed precision.
func sqrt(operands []decimal.Decimal) (decimal.Decimal, error) {
	if operands[0].IsNegative() {
		return decimal.Decimal{}, ErrNegativeSqrt
	}
	scaled := operands[0].Shift(2 * sqrtWorkingPlaces).BigInt()
	root := new(big.Int).Sqrt(scaled)
	return decimal.NewFromBigInt(root, -sqrtWorkingPlaces).Round(precision), nil
}
