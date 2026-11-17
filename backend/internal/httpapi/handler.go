// Package httpapi exposes the calculator over HTTP: it decodes and validates
// requests, calls the calculator package and encodes the response.
package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"unicode/utf8"

	"github.com/shopspring/decimal"

	"fullstack-calculator/backend/internal/calculator"
)

const (
	maxBodyBytes     = 1024
	maxOperandLength = 64
)

var operandPattern = regexp.MustCompile(`^-?[0-9]+(\.[0-9]+)?$`)

type calculateRequest struct {
	Operation string   `json:"operation"`
	Operands  []string `json:"operands"`
}

type calculateResponse struct {
	Result string `json:"result"`
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewAPI returns the handler for the API routes.
func NewAPI() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", calculate)
	return mux
}

// calculate validates in the documented order: body size, JSON, operation,
// operand count, operand length, operand grammar, math. The first failure is
// the one reported.
func calculate(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, errPayloadTooLarge)
			return
		}
		writeError(w, errInvalidJSON)
		return
	}

	var req calculateRequest
	if !decodeStrict(body, &req) {
		writeError(w, errInvalidJSON)
		return
	}

	op, err := calculator.Lookup(req.Operation)
	if err != nil {
		writeError(w, fromCalculator(err))
		return
	}
	if len(req.Operands) != op.Arity {
		writeError(w, errInvalidOperandCount)
		return
	}
	for _, operand := range req.Operands {
		if utf8.RuneCountInString(operand) > maxOperandLength {
			writeError(w, errOperandTooLong)
			return
		}
	}
	operands := make([]decimal.Decimal, len(req.Operands))
	for i, operand := range req.Operands {
		operands[i], err = decimal.NewFromString(operand)
		if err != nil || !operandPattern.MatchString(operand) {
			writeError(w, errInvalidOperand)
			return
		}
	}

	result, err := op.Run(operands)
	if err != nil {
		writeError(w, fromCalculator(err))
		return
	}
	writeJSON(w, http.StatusOK, calculateResponse{Result: result})
}

// decodeStrict reports whether body is exactly one JSON document matching v,
// with no unknown fields and no trailing data.
func decodeStrict(body []byte, v any) bool {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		return false
	}
	_, err := decoder.Token()
	return errors.Is(err, io.EOF)
}

func writeError(w http.ResponseWriter, e apiError) {
	writeJSON(w, e.status, errorResponse{Error: errorBody{Code: e.code, Message: e.message}})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	// The payloads are structs of strings, so encoding cannot fail; a write
	// error means the client is gone and there is nobody to tell.
	body, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}
