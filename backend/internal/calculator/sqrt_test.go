package calculator_test

import (
	"errors"
	"testing"

	"fullstack-calculator/backend/internal/calculator"
)

func TestSqrt(t *testing.T) {
	cases := []struct {
		name string
		a    string
		want string
	}{
		{name: "perfect square", a: "9", want: "3"},
		{name: "zero", a: "0", want: "0"},
		{name: "decimal perfect square", a: "2.25", want: "1.5"},
		{name: "irrational rounds to 34 places", a: "2", want: "1.4142135623730950488016887242096981"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, "sqrt", tc.a)
			if err != nil {
				t.Fatalf("sqrt(%s) returned unexpected error: %v", tc.a, err)
			}
			if got != tc.want {
				t.Errorf("sqrt(%s) = %q, want %q", tc.a, got, tc.want)
			}
		})
	}
}

func TestSqrtErrors(t *testing.T) {
	cases := []struct {
		name string
		a    string
		want error
	}{
		{name: "negative integer", a: "-9", want: calculator.ErrNegativeSqrt},
		{name: "negative decimal", a: "-0.01", want: calculator.ErrNegativeSqrt},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := run(t, "sqrt", tc.a)
			if !errors.Is(err, tc.want) {
				t.Errorf("sqrt(%s) = %q, %v, want %v", tc.a, got, err, tc.want)
			}
		})
	}
}
