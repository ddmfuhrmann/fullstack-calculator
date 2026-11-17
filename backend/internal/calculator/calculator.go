// Package calculator implements the calculator operations on arbitrary-precision
// decimals. It is pure: no HTTP and no I/O.
package calculator

import (
	"errors"
	"fmt"

	"github.com/shopspring/decimal"
)

var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrOperandCount     = errors.New("wrong number of operands")
	ErrDivisionByZero   = errors.New("division by zero")
)

// Operation is one entry of the registry.
type Operation struct {
	// Arity is the number of operands the operation takes.
	Arity int
	apply func(operands []decimal.Decimal) (decimal.Decimal, error)
}

var operations = map[string]Operation{
	"add":        {Arity: 2, apply: add},
	"subtract":   {Arity: 2, apply: subtract},
	"multiply":   {Arity: 2, apply: multiply},
	"divide":     {Arity: 2, apply: divide},
	"percentage": {Arity: 2, apply: percentage},
}

// Lookup returns the operation registered under name, or ErrUnknownOperation.
func Lookup(name string) (Operation, error) {
	op, ok := operations[name]
	if !ok {
		return Operation{}, fmt.Errorf("%w: %q", ErrUnknownOperation, name)
	}
	return op, nil
}

// Run applies the operation and returns the formatted result. It fails with
// ErrOperandCount when len(operands) differs from Arity.
func (op Operation) Run(operands []decimal.Decimal) (string, error) {
	if len(operands) != op.Arity {
		return "", fmt.Errorf("%w: want %d, got %d", ErrOperandCount, op.Arity, len(operands))
	}
	result, err := op.apply(operands)
	if err != nil {
		return "", err
	}
	return format(result), nil
}

// format renders a plain decimal string: no exponent notation, no trailing
// zeros, no trailing ".", never "-0".
func format(d decimal.Decimal) string {
	return d.String()
}
