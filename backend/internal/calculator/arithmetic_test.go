package calculator_test

import "testing"

func TestAdd(t *testing.T) {
	runBinaryCases(t, "add", []binaryCase{
		{name: "two integers", a: "2", b: "3", want: "5"},
		{name: "opposite decimals cancel out", a: "-1.5", b: "1.5", want: "0"},
		{name: "decimal precision is exact", a: "0.1", b: "0.2", want: "0.3"},
	})
}

func TestSubtract(t *testing.T) {
	runBinaryCases(t, "subtract", []binaryCase{
		{name: "two integers", a: "5", b: "3", want: "2"},
		{name: "negative result", a: "3", b: "5", want: "-2"},
		{name: "decimal precision is exact", a: "0.3", b: "0.1", want: "0.2"},
	})
}

func TestMultiply(t *testing.T) {
	runBinaryCases(t, "multiply", []binaryCase{
		{name: "integer by decimal", a: "4", b: "2.5", want: "10"},
		{name: "negative by positive", a: "-2", b: "3", want: "-6"},
		{name: "decimal precision is exact", a: "0.1", b: "0.2", want: "0.02"},
	})
}
