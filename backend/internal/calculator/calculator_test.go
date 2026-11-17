package calculator_test

import (
	"errors"
	"testing"

	"github.com/shopspring/decimal"

	"fullstack-calculator/backend/internal/calculator"
)

func run(t *testing.T, name string, operands ...string) (string, error) {
	t.Helper()
	op, err := calculator.Lookup(name)
	if err != nil {
		t.Fatalf("Lookup(%q) returned unexpected error: %v", name, err)
	}
	values := make([]decimal.Decimal, len(operands))
	for i, operand := range operands {
		values[i] = decimal.RequireFromString(operand)
	}
	return op.Run(values)
}

type binaryCase struct {
	name string
	a    string
	b    string
	want string
}

func runBinaryCases(t *testing.T, operation string, cases []binaryCase) {
	t.Helper()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, operation, tc.a, tc.b)
			if err != nil {
				t.Fatalf("%s(%s, %s) returned unexpected error: %v", operation, tc.a, tc.b, err)
			}
			if got != tc.want {
				t.Errorf("%s(%s, %s) = %q, want %q", operation, tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func TestLookupKnownOperations(t *testing.T) {
	cases := []struct {
		name      string
		wantArity int
	}{
		{name: "add", wantArity: 2},
		{name: "subtract", wantArity: 2},
		{name: "multiply", wantArity: 2},
		{name: "divide", wantArity: 2},
		{name: "percentage", wantArity: 2},
		{name: "power", wantArity: 2},
		{name: "sqrt", wantArity: 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			op, err := calculator.Lookup(tc.name)
			if err != nil {
				t.Fatalf("Lookup(%q) returned unexpected error: %v", tc.name, err)
			}
			if op.Arity != tc.wantArity {
				t.Errorf("Lookup(%q).Arity = %d, want %d", tc.name, op.Arity, tc.wantArity)
			}
		})
	}
}

func TestLookupUnknownOperation(t *testing.T) {
	cases := []struct {
		name      string
		operation string
	}{
		{name: "modulo", operation: "modulo"},
		{name: "empty name", operation: ""},
		{name: "wrong case", operation: "ADD"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := calculator.Lookup(tc.operation)
			if !errors.Is(err, calculator.ErrUnknownOperation) {
				t.Errorf("Lookup(%q) error = %v, want ErrUnknownOperation", tc.operation, err)
			}
		})
	}
}

func TestRunOperandCount(t *testing.T) {
	cases := []struct {
		name      string
		operation string
		operands  []string
	}{
		{name: "add with no operands", operation: "add", operands: nil},
		{name: "add with one operand", operation: "add", operands: []string{"1"}},
		{name: "add with three operands", operation: "add", operands: []string{"1", "2", "3"}},
		{name: "sqrt with no operands", operation: "sqrt", operands: nil},
		{name: "sqrt with two operands", operation: "sqrt", operands: []string{"9", "4"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, tc.operation, tc.operands...)
			if !errors.Is(err, calculator.ErrOperandCount) {
				t.Errorf("%s(%v) = %q, %v, want ErrOperandCount", tc.operation, tc.operands, got, err)
			}
		})
	}
}

func TestResultFormat(t *testing.T) {
	cases := []struct {
		name      string
		operation string
		a         string
		b         string
		want      string
	}{
		{name: "trailing zeros are dropped", operation: "add", a: "1.50", b: "1.50", want: "3"},
		{name: "zero is never negative", operation: "add", a: "-0.5", b: "0.5", want: "0"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, tc.operation, tc.a, tc.b)
			if err != nil {
				t.Fatalf("%s(%s, %s) returned unexpected error: %v", tc.operation, tc.a, tc.b, err)
			}
			if got != tc.want {
				t.Errorf("%s(%s, %s) = %q, want %q", tc.operation, tc.a, tc.b, got, tc.want)
			}
		})
	}
}
