package quota

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/bizasbot/shell-pamc/internal/cpa/management"
)

const antigravityModelsTestURL = "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels"
const antigravityPrimaryFixture = `{"groups":[{"displayName":"Claude and GPT models","buckets":[{"bucketId":"five","window":"5h","remainingFraction":0.8},{"bucketId":"week","window":"weekly","remainingFraction":0.6}]}]}`

func TestAntigravityModelSupplementRefresh(t *testing.T) {
	const reset = "2026-10-28T16:31:39Z"
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	resetAt := time.Date(2026, 10, 28, 16, 31, 39, 0, time.UTC).UnixMilli()
	preciseResetAt := resetAt + 123
	for _, scenario := range []struct {
		name, primary, auxiliary string
		auxStatus                int
		auxError                 bool
		wantModels               []string
		wantRemaining            []*float64
		wantReset                []*int64
		wantAux                  int
		wantStatus               string
	}{
		{
			name: "sorted raw model observations", wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-3.8-flash-tiered":{"quotaInfo":{"remainingFraction":1,"resetTime":"` + reset + `"}},"claude-opus":{"quotaInfo":{"remainingFraction":0}},"gemini-3-flash":{"quotaInfo":{"remainingFraction":1,"resetTime":"` + reset + `"}}}}`,
			wantModels: []string{"gemini-3-flash", "gemini-3.8-flash-tiered"}, wantRemaining: []*float64{floatPtr(100), floatPtr(100)}, wantReset: []*int64{&resetAt, &resetAt},
		},
		{
			name: "zero remains exhausted", wantAux: 1, wantStatus: "exhausted",
			auxiliary: `{"models":{"gemini-3-flash":{"quotaInfo":{"remainingFraction":0}}}}`,
			wantModels: []string{"gemini-3-flash"}, wantRemaining: []*float64{floatPtr(0)}, wantReset: []*int64{nil},
		},
		{
			name: "missing and null fractions stay unknown", wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-a":{"quotaInfo":{"resetTime":"` + reset + `"}},"gemini-b":{"quotaInfo":{"remainingFraction":null}},"gemini-c":{"quotaInfo":{}}}}`,
			wantModels: []string{"gemini-a", "gemini-b", "gemini-c"}, wantRemaining: []*float64{nil, nil, nil}, wantReset: []*int64{&resetAt, nil, nil},
		},
		{
			name: "invalid reset is not exact", wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-a":{"quotaInfo":{"remainingFraction":0.5,"resetTime":"tomorrow"}},"gemini-b":{"quotaInfo":{"remainingFraction":0.5,"resetTime":null}}}}`,
			wantModels: []string{"gemini-a", "gemini-b"}, wantRemaining: []*float64{floatPtr(50), floatPtr(50)}, wantReset: []*int64{nil, nil},
		},
		{
			name: "invalid fractions omitted without losing valid neighbors", wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-negative":{"quotaInfo":{"remainingFraction":-0.1}},"gemini-over":{"quotaInfo":{"remainingFraction":1.1}},"gemini-string":{"quotaInfo":{"remainingFraction":"1"}},"gemini-bool":{"quotaInfo":{"remainingFraction":true}},"gemini-valid":{"quotaInfo":{"remainingFraction":0.5}}}}`,
			wantModels: []string{"gemini-valid"}, wantRemaining: []*float64{floatPtr(50)}, wantReset: []*int64{nil},
		},
		{
			name: "offset and fractional reset preserve instant", wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-a":{"quotaInfo":{"remainingFraction":0.5,"resetTime":"2026-10-28T18:31:39.123+02:00"}}}}`,
			wantModels: []string{"gemini-a"}, wantRemaining: []*float64{floatPtr(50)}, wantReset: []*int64{&preciseResetAt},
		},
		{
			name: "numeric reset remains unknown", wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-a":{"quotaInfo":{"remainingFraction":0.5,"resetTime":1793205099000}}}}`,
			wantModels: []string{"gemini-a"}, wantRemaining: []*float64{floatPtr(50)}, wantReset: []*int64{nil},
		},
		{
			name: "empty summary can receive model evidence", primary: `{"groups":[]}`, wantAux: 1, wantStatus: "healthy",
			auxiliary: `{"models":{"gemini-a":{"quotaInfo":{"remainingFraction":0.5}}}}`,
			wantModels: []string{"gemini-a"}, wantRemaining: []*float64{floatPtr(50)}, wantReset: []*int64{nil},
		},
		{name: "transport failure preserves primary", auxError: true, wantAux: 1, wantStatus: "healthy"},
		{name: "http failure preserves primary", auxStatus: 403, auxiliary: `{"models":{"gemini-a":{"quotaInfo":{"remainingFraction":0}}}}`, wantAux: 1, wantStatus: "healthy"},
		{name: "malformed preserves primary", auxiliary: `not-json`, wantAux: 1, wantStatus: "healthy"},
		{name: "empty preserves primary", auxiliary: `{}`, wantAux: 1, wantStatus: "healthy"},
		{name: "wrong schema preserves primary", auxiliary: `{"models":[]}`, wantAux: 1, wantStatus: "healthy"},
		{name: "no quota evidence preserves primary", auxiliary: `{"models":{"gemini-a":{},"gemini-b":{"quotaInfo":null}}}`, wantAux: 1, wantStatus: "healthy"},
		{name: "known Gemini group skips supplement", primary: `{"groups":[{"displayName":"Gemini models","buckets":[{"window":"weekly","remainingFraction":0.5}]}]}`, wantStatus: "healthy"},
		{name: "known Gemini subfamily skips supplement", primary: `{"groups":[{"display_name":"Gemini 3 Flash","buckets":[{"remainingFraction":0.5}]}]}`, wantStatus: "healthy"},
		{name: "unknown Gemini-like label still supplements", primary: `{"groups":[{"displayName":"Gemini and future models","buckets":[{"remainingFraction":0.5}]}]}`, auxiliary: `{}`, wantAux: 1, wantStatus: "healthy"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			primary := scenario.primary
			if primary == "" {
				primary = antigravityPrimaryFixture
			}
			primaryWindows, err := ParseAntigravityUsage([]byte(primary), now.UnixMilli(), 0)
			if err != nil {
				t.Fatal(err)
			}
			file := management.AuthFile{AuthIndex: "ag-test", Type: "antigravity", ProjectID: "project-test"}
			prior := &NormalizedQuota{AuthIndex: file.AuthIndex, Windows: []QuotaWindow{{ID: "old", RemainingPercent: floatPtr(23)}}}
			before, _ := json.Marshal([]any{file, prior})
			calls := map[string]int{}
			client := &mockCPAClient{apiCallFunc: func(_ context.Context, req management.ApiCallRequest) (management.ApiCallResponse, error) {
				calls[req.URL]++
				if req.AuthIndex != file.AuthIndex || req.Header["Authorization"] != "Bearer $TOKEN$" || req.Header["User-Agent"] != "antigravity" || req.Method != http.MethodPost {
					t.Errorf("unexpected credential-backed request: %+v", req)
				}
				switch req.URL {
				case AntigravityQuotaURLDaily:
					return management.ApiCallResponse{StatusCode: 200, Body: json.RawMessage(primary)}, nil
				case AntigravitySubscriptionURL:
					return management.ApiCallResponse{StatusCode: 200, Body: json.RawMessage(`{"currentTier":{"id":"free-tier"}}`)}, nil
				case antigravityModelsTestURL:
					if req.Data != `{"project":"project-test"}` || req.Header["Content-Type"] != "application/json" {
						t.Errorf("unexpected model request payload: %+v", req)
					}
					if scenario.auxError {
						return management.ApiCallResponse{}, errors.New("auxiliary unavailable")
					}
					status := scenario.auxStatus
					if status == 0 {
						status = 200
					}
					// CPA can wrap the upstream body as JSON text.
					body, _ := json.Marshal(scenario.auxiliary)
					return management.ApiCallResponse{StatusCode: status, Body: body}, nil
				default:
					t.Errorf("unexpected URL %s", req.URL)
					return management.ApiCallResponse{}, errors.New("unexpected URL")
				}
			}}
			result, err := NewServiceWithClock(client, func() time.Time { return now }).RefreshCredentialQuota(context.Background(), file, prior)
			if err != nil || result.Error != "" || result.Status != scenario.wantStatus || result.Plan == nil || result.Plan.PlanType != "free" {
				t.Fatalf("refresh = %+v, err = %v", result, err)
			}
			wantCalls := map[string]int{AntigravityQuotaURLDaily: 1, AntigravitySubscriptionURL: 1}
			if scenario.wantAux > 0 {
				wantCalls[antigravityModelsTestURL] = scenario.wantAux
			}
			if !reflect.DeepEqual(calls, wantCalls) {
				t.Errorf("calls = %v, want %v", calls, wantCalls)
			}
			if len(result.Windows) != len(primaryWindows)+len(scenario.wantModels) {
				t.Fatalf("windows = %+v, want %d primary + %d model windows", result.Windows, len(primaryWindows), len(scenario.wantModels))
			}
			if !reflect.DeepEqual(result.Windows[:len(primaryWindows)], primaryWindows) {
				t.Errorf("primary windows changed: %+v", result.Windows)
			}
			for i, model := range scenario.wantModels {
				window := result.Windows[len(primaryWindows)+i]
				if window.ID != "ag_model_"+model || window.Model != model || window.Label != model || window.Scope != "model" || window.Kind != "model_scoped" || window.PeriodHours != nil || len(window.ModelFamilies) != 0 || window.Used != nil || window.Limit != nil {
					t.Errorf("fabricated identity, period or pool: %+v", window)
				}
				if !reflect.DeepEqual(window.RemainingPercent, scenario.wantRemaining[i]) || !reflect.DeepEqual(window.ResetAtMS, scenario.wantReset[i]) {
					t.Errorf("model reading = %+v, want remaining %v reset %v", window, scenario.wantRemaining[i], scenario.wantReset[i])
				}
				if window.RemainingPercent == nil && window.UsedPercent != nil || window.RemainingPercent != nil && (window.UsedPercent == nil || *window.UsedPercent != 100-*window.RemainingPercent) {
					t.Errorf("invalid used share: %+v", window)
				}
				if window.ResetAtMS == nil && (window.ResetAccuracy != "" || window.ResetLabel != "") || window.ResetAtMS != nil && (window.ResetAccuracy != "exact" || window.ResetLabel == "") {
					t.Errorf("invalid reset provenance: %+v", window)
				}
			}
			after, _ := json.Marshal([]any{file, prior})
			if string(before) != string(after) {
				t.Fatal("refresh mutated input credential or previous observation")
			}
		})
	}
}

func TestAntigravityModelSupplementPrimaryFailures(t *testing.T) {
	for _, scenario := range []struct {
		name, project, provider, body string
		status, wantPrimary          int
	}{
		{"missing project", "", "antigravity", `{}`, 200, 0},
		{"primary HTTP failure", "project-test", "antigravity", `{}`, 503, 3},
		{"primary parse failure", "project-test", "antigravity", `[]`, 200, 1},
		{"generic Gemini is not Antigravity", "project-test", "gemini", `{}`, 200, 0},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			calls := 0
			client := &mockCPAClient{apiCallFunc: func(_ context.Context, req management.ApiCallRequest) (management.ApiCallResponse, error) {
				calls++
				if !strings.HasSuffix(req.URL, ":retrieveUserQuotaSummary") {
					t.Errorf("supplement or subscription called after primary failure: %s", req.URL)
				}
				return management.ApiCallResponse{StatusCode: scenario.status, Body: json.RawMessage(scenario.body)}, nil
			}}
			prior := &NormalizedQuota{ObservedAtMS: 42, Windows: []QuotaWindow{{ID: "prior", RemainingPercent: floatPtr(40)}}}
			result, err := NewService(client).RefreshCredentialQuota(context.Background(), management.AuthFile{AuthIndex: "ag-test", Type: scenario.provider, ProjectID: scenario.project}, prior)
			if err != nil || result.Error == "" || result.Status != "stale" || result.ObservedAtMS != 42 || !reflect.DeepEqual(result.Windows, prior.Windows) || calls != scenario.wantPrimary {
				t.Fatalf("primary failure semantics changed: %+v err=%v calls=%d", result, err, calls)
			}
		})
	}
}

func TestAntigravityModelsURLBoundary(t *testing.T) {
	if !IsAllowedQuotaURL(antigravityModelsTestURL) {
		t.Errorf("verified model-quota endpoint is not allowed")
	}
	for _, target := range []string{
		"http://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
		"https://daily-cloudcode-pa.googleapis.com.attacker.test/v1internal:fetchAvailableModels",
		"https://daily-cloudcode-pa.googleapis.com@attacker.test/v1internal:fetchAvailableModels",
		"https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
		"https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels",
		antigravityModelsTestURL + "Extra", antigravityModelsTestURL + "/extra",
		antigravityModelsTestURL + "/../loadCodeAssist", antigravityModelsTestURL + "/%2e%2e/loadCodeAssist",
		"https://daily-cloudcode-pa.googleapis.com/other/../v1internal:fetchAvailableModels",
	} {
		if IsAllowedQuotaURL(target) {
			t.Errorf("unexpected authority granted to %q", target)
		}
	}
}
