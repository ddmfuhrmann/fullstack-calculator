package httpapi

import (
	"io/fs"
	"net/http"
)

// NewRouter serves the API under /api/ and the static frontend everywhere else.
func NewRouter(static fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/api/", NewAPI())
	mux.Handle("/", http.FileServerFS(static))
	return mux
}
