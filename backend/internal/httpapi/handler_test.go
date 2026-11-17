package httpapi_test

import (
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"fullstack-calculator/backend/internal/httpapi"
)

const (
	path      = "/api/v1/calculate"
	maxBody   = 1024
	digits64  = "1234567890123456789012345678901234567890123456789012345678901234"
	digits65  = digits64 + "5"
	letters65 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
)

func post(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	httpapi.NewAPI().ServeHTTP(rec, req)
	return rec
}

func request(operation string, operands ...string) string {
	quoted := make([]string, len(operands))
	for i, operand := range operands {
		encoded, err := json.Marshal(operand)
		if err != nil {
			panic(err)
		}
		quoted[i] = string(encoded)
	}
	return fmt.Sprintf(`{"operation":%q,"operands":[%s]}`, operation, strings.Join(quoted, ","))
}

func padTo(t *testing.T, body string, size int) string {
	t.Helper()
	if len(body) > size {
		t.Fatalf("body has %d bytes, cannot pad to %d", len(body), size)
	}
	return body + strings.Repeat(" ", size-len(body))
}

func assertJSONContentType(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	header := rec.Header().Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(header)
	if err != nil || mediaType != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", header)
	}
}

func decodeStrict(t *testing.T, rec *httptest.ResponseRecorder, into any) {
	t.Helper()
	raw := rec.Body.String()
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(into); err != nil {
		t.Fatalf("body %q does not decode: %v", raw, err)
	}
	if _, err := decoder.Token(); err != io.EOF {
		t.Fatalf("body %q has trailing data", raw)
	}
}

func assertResult(t *testing.T, rec *httptest.ResponseRecorder, want string) {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body %q", rec.Code, rec.Body.String())
	}
	assertJSONContentType(t, rec)
	var got struct {
		Result *string `json:"result"`
	}
	decodeStrict(t, rec, &got)
	if got.Result == nil {
		t.Fatalf("body %q has no result", rec.Body.String())
	}
	if *got.Result != want {
		t.Errorf("result = %q, want %q", *got.Result, want)
	}
}

func assertError(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if rec.Code != wantStatus {
		t.Errorf("status = %d, want %d; body %q", rec.Code, wantStatus, rec.Body.String())
	}
	assertJSONContentType(t, rec)
	var got struct {
		Error *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	decodeStrict(t, rec, &got)
	if got.Error == nil {
		t.Fatalf("body %q has no error object", rec.Body.String())
	}
	if got.Error.Code != wantCode {
		t.Errorf("code = %q, want %q", got.Error.Code, wantCode)
	}
	if got.Error.Message == "" {
		t.Errorf("message is empty; body %q", rec.Body.String())
	}
}

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{"B-20 add", request("add", "2", "3"), "5"},
		{"B-20 subtract", request("subtract", "5", "3"), "2"},
		{"B-20 multiply", request("multiply", "4", "2.5"), "10"},
		{"B-20 divide", request("divide", "10", "4"), "2.5"},
		{"B-20 power", request("power", "2", "10"), "1024"},
		{"B-20 sqrt", request("sqrt", "9"), "3"},
		{"B-20 percentage", request("percentage", "15", "200"), "30"},
		{"B-20 spec example with whitespace", `{"operation": "add", "operands": ["0.1", "0.2"]}`, "0.3"},
		{"B-30 operand of 64 digits", request("add", digits64, "0"), digits64},
		{"B-30 second operand of 64 digits", request("add", "0", digits64), digits64},
		{"B-30 operand of 64 characters with sign and point", request("add", "-"+digits64[:61]+".5", "0"), "-" + digits64[:61] + ".5"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertResult(t, post(t, tt.body), tt.want)
		})
	}
}

func TestCalculatePrecisionOverHTTP(t *testing.T) {
	rec := post(t, `{"operation":"add","operands":["0.1","0.2"]}`)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	assertJSONContentType(t, rec)
	if got, want := rec.Body.String(), `{"result":"0.3"}`; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestCalculateMathErrors(t *testing.T) {
	tests := []struct {
		name string
		body string
		code string
	}{
		{"B-22 divide by zero", request("divide", "1", "0"), "DIVISION_BY_ZERO"},
		{"B-22 zero to a negative exponent", request("power", "0", "-1"), "DIVISION_BY_ZERO"},
		{"B-23 sqrt of a negative", request("sqrt", "-9"), "NEGATIVE_SQRT"},
		{"B-24 fractional exponent", request("power", "2", "0.5"), "UNSUPPORTED_EXPONENT"},
		{"B-24 exponent above the limit", request("power", "2", "1001"), "UNSUPPORTED_EXPONENT"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, post(t, tt.body), http.StatusUnprocessableEntity, tt.code)
		})
	}
}

func TestCalculateInvalidJSON(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"B-25 truncated body", `{"operation":`},
		{"B-25 empty body", ``},
		{"B-25 array body", `[]`},
		{"B-25 operands as JSON numbers", `{"operation":"add","operands":[1,2]}`},
		{"B-25 one operand as a JSON number", `{"operation":"add","operands":["1",2]}`},
		{"B-25 two documents in a row", request("add", "1", "2") + request("add", "1", "2")},
		{"B-25 two documents separated by a newline", request("add", "1", "2") + "\n" + request("add", "1", "2")},
		{"B-25 trailing garbage", request("add", "1", "2") + "x"},
		{"B-25 operation with the wrong type", `{"operation":1,"operands":["1","2"]}`},
		{"B-25 operands with the wrong type", `{"operation":"add","operands":"1"}`},
		{"B-26 unknown field", `{"operation":"add","operands":["1","2"],"extra":true}`},
		{"B-26 unknown field first", `{"precision":2,"operation":"add","operands":["1","2"]}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, post(t, tt.body), http.StatusBadRequest, "INVALID_JSON")
		})
	}
}

func TestCalculateUnknownOperation(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"B-27 modulo", request("modulo", "1", "2")},
		{"B-27 no operation", `{"operands":["1","2"]}`},
		{"B-27 empty operation", request("", "1", "2")},
		{"B-27 empty object", `{}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, post(t, tt.body), http.StatusBadRequest, "UNKNOWN_OPERATION")
		})
	}
}

func TestCalculateWrongOperandCount(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"B-28 add with one operand", request("add", "1")},
		{"B-28 sqrt with two operands", request("sqrt", "9", "4")},
		{"B-28 no operands", `{"operation":"add"}`},
		{"B-28 empty operands", request("add")},
		{"B-28 add with three operands", request("add", "1", "2", "3")},
		{"B-28 sqrt with no operands", `{"operation":"sqrt"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, post(t, tt.body), http.StatusBadRequest, "INVALID_OPERAND_COUNT")
		})
	}
}

func TestCalculateNonNumericOperand(t *testing.T) {
	operands := []string{"abc", "", "1e3", "+1", ".5", "5.", " 1", "NaN", "1,5"}
	for _, operand := range operands {
		t.Run(fmt.Sprintf("B-29 first operand %q", operand), func(t *testing.T) {
			assertError(t, post(t, request("add", operand, "1")), http.StatusBadRequest, "INVALID_OPERAND")
		})
		t.Run(fmt.Sprintf("B-29 second operand %q", operand), func(t *testing.T) {
			assertError(t, post(t, request("add", "1", operand)), http.StatusBadRequest, "INVALID_OPERAND")
		})
		t.Run(fmt.Sprintf("B-29 sqrt operand %q", operand), func(t *testing.T) {
			assertError(t, post(t, request("sqrt", operand)), http.StatusBadRequest, "INVALID_OPERAND")
		})
	}
}

func TestCalculateOperandTooLong(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"B-30 first operand of 65 digits", request("add", digits65, "1")},
		{"B-30 second operand of 65 digits", request("add", "1", digits65)},
		{"B-30 sqrt operand of 65 digits", request("sqrt", digits65)},
		{"B-30 65 characters with sign", request("add", "-"+digits64, "1")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, post(t, tt.body), http.StatusBadRequest, "OPERAND_TOO_LONG")
		})
	}
}

func TestCalculateBodySize(t *testing.T) {
	valid := request("add", "1", "2")

	t.Run("B-31 valid body of exactly 1024 bytes is accepted", func(t *testing.T) {
		body := padTo(t, valid, maxBody)
		assertResult(t, post(t, body), "3")
	})

	t.Run("B-31 leading whitespace up to exactly 1024 bytes is accepted", func(t *testing.T) {
		body := strings.Repeat(" ", maxBody-len(valid)) + valid
		assertResult(t, post(t, body), "3")
	})

	tooLarge := []struct {
		name string
		body string
	}{
		{"B-31 valid body padded to 1025 bytes", padTo(t, valid, maxBody+1)},
		{"B-31 leading whitespace up to 1025 bytes", strings.Repeat(" ", maxBody+1-len(valid)) + valid},
		{"B-31 body of 4096 bytes", padTo(t, valid, 4096)},
		{"B-31 1025 bytes inside a string", `{"operation":"` + strings.Repeat("a", maxBody+1-len(`{"operation":""}`)) + `"}`},
	}
	for _, tt := range tooLarge {
		t.Run(tt.name, func(t *testing.T) {
			if tt.name != "B-31 body of 4096 bytes" && len(tt.body) != maxBody+1 {
				t.Fatalf("body has %d bytes, want %d", len(tt.body), maxBody+1)
			}
			assertError(t, post(t, tt.body), http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE")
		})
	}
}

func TestCalculateValidationOrder(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		status int
		code   string
	}{
		{
			"body size before JSON decode",
			strings.Repeat("x", maxBody+1),
			http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE",
		},
		{
			"body size before JSON decode with a truncated document",
			`{"operation":` + strings.Repeat(" ", maxBody+1-len(`{"operation":`)),
			http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE",
		},
		{
			"body size before unknown operation",
			request("modulo", "1", "2") + strings.Repeat(" ", maxBody),
			http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE",
		},
		{
			"JSON decode before unknown operation",
			`{"operation":"modulo","operands":["1","2"],"extra":1}`,
			http.StatusBadRequest, "INVALID_JSON",
		},
		{
			"JSON decode before operand count",
			`{"operation":"add","operands":[1]}`,
			http.StatusBadRequest, "INVALID_JSON",
		},
		{
			"unknown operation before bad operands",
			request("modulo", "abc", "1e3"),
			http.StatusBadRequest, "UNKNOWN_OPERATION",
		},
		{
			"unknown operation before operand count",
			request("modulo", "1", "2", "3"),
			http.StatusBadRequest, "UNKNOWN_OPERATION",
		},
		{
			"missing operation before missing operands",
			`{}`,
			http.StatusBadRequest, "UNKNOWN_OPERATION",
		},
		{
			"unknown operation before operand too long",
			request("modulo", digits65, "1"),
			http.StatusBadRequest, "UNKNOWN_OPERATION",
		},
		{
			"operand count before bad operand",
			request("add", "abc"),
			http.StatusBadRequest, "INVALID_OPERAND_COUNT",
		},
		{
			"operand count before bad operand in sqrt",
			request("sqrt", "abc", "1"),
			http.StatusBadRequest, "INVALID_OPERAND_COUNT",
		},
		{
			"operand count before operand too long",
			request("add", digits65),
			http.StatusBadRequest, "INVALID_OPERAND_COUNT",
		},
		{
			"operand length before grammar on the same operand",
			request("add", letters65, "1"),
			http.StatusBadRequest, "OPERAND_TOO_LONG",
		},
		{
			"operand length of the second operand before grammar of the first",
			request("add", "abc", digits65),
			http.StatusBadRequest, "OPERAND_TOO_LONG",
		},
		{
			"non-numeric too-long second operand before grammar of the first",
			request("add", "abc", letters65),
			http.StatusBadRequest, "OPERAND_TOO_LONG",
		},
		{
			"operand length before math",
			request("divide", "1", strings.Repeat("0", 65)),
			http.StatusBadRequest, "OPERAND_TOO_LONG",
		},
		{
			"operand grammar before math",
			request("divide", "abc", "0"),
			http.StatusBadRequest, "INVALID_OPERAND",
		},
		{
			"operand grammar before negative sqrt",
			request("sqrt", "-9."),
			http.StatusBadRequest, "INVALID_OPERAND",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, post(t, tt.body), tt.status, tt.code)
		})
	}
}

func TestCalculateWrongMethod(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()

	httpapi.NewAPI().ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("B-33 status = %d, want 405", rec.Code)
	}
}
