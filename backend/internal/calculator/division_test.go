package calculator_test

import (
	"errors"
	"testing"

	"fullstack-calculator/backend/internal/calculator"
)

func TestDivide(t *testing.T) {
	runBinaryCases(t, "divide", []binaryCase{
		{name: "exact quotient", a: "10", b: "4", want: "2.5"},
		{name: "negative dividend", a: "-7", b: "2", want: "-3.5"},
		{name: "repeating quotient is cut at 34 places", a: "1", b: "3", want: "0.3333333333333333333333333333333333"},
		{name: "last place rounds up", a: "2", b: "3", want: "0.6666666666666666666666666666666667"},
		{name: "negative rounds half away from zero", a: "-2", b: "3", want: "-0.6666666666666666666666666666666667"},
	})
}

func TestDivideByZero(t *testing.T) {
	cases := []struct {
		name string
		a    string
		b    string
	}{
		{name: "integer zero", a: "8", b: "0"},
		{name: "decimal zero", a: "8", b: "0.0"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, "divide", tc.a, tc.b)
			if !errors.Is(err, calculator.ErrDivisionByZero) {
				t.Errorf("divide(%s, %s) = %q, %v, want ErrDivisionByZero", tc.a, tc.b, got, err)
			}
		})
	}
}

func TestPercentage(t *testing.T) {
	runBinaryCases(t, "percentage", []binaryCase{
		{name: "percent of an integer", a: "15", b: "200", want: "30"},
		{name: "percent of a fraction", a: "50", b: "0.5", want: "0.25"},
		{name: "negative percent", a: "-10", b: "50", want: "-5"},
		{name: "zero percent", a: "0", b: "9", want: "0"},
	})
}
