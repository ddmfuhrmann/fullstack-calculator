package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"fullstack-calculator/backend/internal/httpapi"
)

const (
	routerIndexHTML = "<!doctype html><title>router test index</title>"
	routerAppJS     = "console.log('router test asset');"
)

func routerNewHandler() http.Handler {
	return httpapi.NewRouter(fstest.MapFS{
		"index.html":    {Data: []byte(routerIndexHTML)},
		"assets/app.js": {Data: []byte(routerAppJS)},
	})
}

func routerDo(t *testing.T, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	routerNewHandler().ServeHTTP(rec, req)
	return rec
}

func TestRouterServesStaticFiles(t *testing.T) {
	tests := []struct {
		name            string
		target          string
		wantBody        string
		wantContentType string
	}{
		{name: "index at root", target: "/", wantBody: routerIndexHTML, wantContentType: "text/html"},
		{name: "other asset", target: "/assets/app.js", wantBody: routerAppJS, wantContentType: "javascript"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := routerDo(t, http.MethodGet, tt.target, "")

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, http.StatusOK, rec.Body.String())
			}
			if got := rec.Body.String(); got != tt.wantBody {
				t.Errorf("body = %q, want %q", got, tt.wantBody)
			}
			if got := rec.Header().Get("Content-Type"); !strings.Contains(got, tt.wantContentType) {
				t.Errorf("Content-Type = %q, want it to contain %q", got, tt.wantContentType)
			}
		})
	}
}

func TestRouterUnknownAPIPathIsNotTheFrontend(t *testing.T) {
	tests := []struct {
		name   string
		method string
		target string
	}{
		{name: "unknown api path", method: http.MethodGet, target: "/api/unknown"},
		{name: "unknown versioned api path", method: http.MethodGet, target: "/api/v1/unknown"},
		{name: "api root", method: http.MethodGet, target: "/api/"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := routerDo(t, tt.method, tt.target, "")

			if rec.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
			}
			if strings.Contains(rec.Body.String(), routerIndexHTML) {
				t.Errorf("body is the frontend index.html, want an API 404")
			}
		})
	}
}

func TestRouterCalculateIsReachable(t *testing.T) {
	rec := routerDo(t, http.MethodPost, "/api/v1/calculate", `{"operation":"add","operands":["0.1","0.2"]}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body %q)", rec.Code, http.StatusOK, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	var got struct {
		Result string `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	if got.Result != "0.3" {
		t.Errorf("result = %q, want %q", got.Result, "0.3")
	}
}

func TestRouterCalculateWrongMethod(t *testing.T) {
	rec := routerDo(t, http.MethodGet, "/api/v1/calculate", "")

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
	}
	if strings.Contains(rec.Body.String(), routerIndexHTML) {
		t.Errorf("body is the frontend index.html, want a 405")
	}
}
