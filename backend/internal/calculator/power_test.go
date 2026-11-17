package calculator_test

import (
	"errors"
	"strings"
	"testing"

	"fullstack-calculator/backend/internal/calculator"
)

func TestPower(t *testing.T) {
	runBinaryCases(t, "power", []binaryCase{
		{name: "positive integers", a: "2", b: "10", want: "1024"},
		{name: "decimal base", a: "1.5", b: "2", want: "2.25"},
		{name: "negative base", a: "-2", b: "3", want: "-8"},
		{name: "zero exponent", a: "5", b: "0", want: "1"},
		{name: "zero to the zero", a: "0", b: "0", want: "1"},
		{name: "large exact result", a: "2", b: "100", want: "1267650600228229401496703205376"},
		{name: "exponent written with a zero fraction", a: "3", b: "2.0", want: "9"},
		{name: "negative exponent", a: "2", b: "-2", want: "0.25"},
		{name: "negative exponent rounds to 34 places", a: "3", b: "-1", want: "0.3333333333333333333333333333333333"},
		{name: "exponent at upper limit", a: "10", b: "1000", want: "1" + strings.Repeat("0", 1000)},
		{name: "exponent at lower limit", a: "1", b: "-1000", want: "1"},
		{name: "exponent at lower limit rounds to zero", a: "2", b: "-1000", want: "0"},
	})
}

func TestPowerErrors(t *testing.T) {
	cases := []struct {
		name string
		a    string
		b    string
		want error
	}{
		{name: "zero to a negative exponent", a: "0", b: "-1", want: calculator.ErrDivisionByZero},
		{name: "fractional exponent", a: "2", b: "0.5", want: calculator.ErrUnsupportedExponent},
		{name: "exponent above limit", a: "2", b: "1001", want: calculator.ErrUnsupportedExponent},
		{name: "exponent below limit", a: "2", b: "-1001", want: calculator.ErrUnsupportedExponent},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, "power", tc.a, tc.b)
			if !errors.Is(err, tc.want) {
				t.Errorf("power(%s, %s) = %q, %v, want %v", tc.a, tc.b, got, err, tc.want)
			}
		})
	}
}
