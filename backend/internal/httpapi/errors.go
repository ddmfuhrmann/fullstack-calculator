package httpapi

import (
	"errors"
	"net/http"

	"fullstack-calculator/backend/internal/calculator"
)

// apiError is one row of the error contract: an HTTP status, a stable code the
// client switches on and a technical message.
type apiError struct {
	status  int
	code    string
	message string
}

var (
	errInvalidJSON         = apiError{http.StatusBadRequest, "INVALID_JSON", "request body is not a valid calculation request"}
	errUnknownOperation    = apiError{http.StatusBadRequest, "UNKNOWN_OPERATION", "unknown operation"}
	errInvalidOperandCount = apiError{http.StatusBadRequest, "INVALID_OPERAND_COUNT", "wrong number of operands for the operation"}
	errOperandTooLong      = apiError{http.StatusBadRequest, "OPERAND_TOO_LONG", "operand is longer than 64 characters"}
	errInvalidOperand      = apiError{http.StatusBadRequest, "INVALID_OPERAND", "operand is not a decimal number"}
	errPayloadTooLarge     = apiError{http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "request body is larger than 1024 bytes"}
	errDivisionByZero      = apiError{http.StatusUnprocessableEntity, "DIVISION_BY_ZERO", "division by zero"}
	errNegativeSqrt        = apiError{http.StatusUnprocessableEntity, "NEGATIVE_SQRT", "square root of a negative number"}
	errUnsupportedExponent = apiError{http.StatusUnprocessableEntity, "UNSUPPORTED_EXPONENT", "exponent must be an integer between -1000 and 1000"}
	errInternal            = apiError{http.StatusInternalServerError, "INTERNAL", "internal error"}
)

// fromCalculator maps a calculator sentinel error to its contract row.
func fromCalculator(err error) apiError {
	switch {
	case errors.Is(err, calculator.ErrUnknownOperation):
		return errUnknownOperation
	case errors.Is(err, calculator.ErrDivisionByZero):
		return errDivisionByZero
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return errNegativeSqrt
	case errors.Is(err, calculator.ErrUnsupportedExponent):
		return errUnsupportedExponent
	default:
		return errInternal
	}
}
