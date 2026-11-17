package calculator

import "github.com/shopspring/decimal"

func add(operands []decimal.Decimal) (decimal.Decimal, error) {
	return operands[0].Add(operands[1]), nil
}

func subtract(operands []decimal.Decimal) (decimal.Decimal, error) {
	return operands[0].Sub(operands[1]), nil
}

func multiply(operands []decimal.Decimal) (decimal.Decimal, error) {
	return operands[0].Mul(operands[1]), nil
}
