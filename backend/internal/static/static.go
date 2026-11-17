// Package static embeds the frontend build. The Docker build copies it into
// dist/ before compiling; in a plain checkout dist/ only holds a placeholder.
package static

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embedded embed.FS

// Files returns the frontend build rooted at its index.html.
func Files() (fs.FS, error) {
	return fs.Sub(embedded, "dist")
}
