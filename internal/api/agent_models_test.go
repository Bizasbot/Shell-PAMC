package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
)

func TestAgentModelsUseStableKeyAndProjectModels(t *testing.T) {
	fixture := newProviderTestFixture(t)
	var keyMu sync.Mutex
	keys := []string{"agent-fixture-first", "agent-fixture-second"}
	var authValue string
	upstream := newFakeCPA(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		keyMu.Lock()
		defer keyMu.Unlock()
		switch request.URL.Path {
		case "/v8/management/config":
			json.NewEncoder(writer).Encode(map[string]any{"access": map[string]any{"api-keys": keys}})
		case "/v1/models":
			authValue = request.Header.Get("Authorization")
			io.WriteString(writer, `{"data":[{"id":"model-alias","secret":"omit-me"}]}`)
		default:
			t.Errorf("unexpected path %s", request.URL.Path)
		}
	}))
	defer upstream.Close()
	pointGatewayAt(t, fixture.handler, upstream.URL)
	fingerprint, err := fixture.handler.repo.UsageClientKeyFingerprint(keys[0])
	if err != nil {
		t.Fatal(err)
	}
	path := fixture.baseURL + "/shell-pamc/api/v1/agent/models?client_key_fingerprint=" + fingerprint
	response, body := getJSON(t, fixture.client, path)
	if response.StatusCode != 200 || !strings.Contains(string(body), "model-alias") || !strings.Contains(string(body), "call_point") || strings.Contains(string(body), "omit-me") {
		t.Fatalf("models %d %s", response.StatusCode, body)
	}
	keyMu.Lock()
	keys[0], keys[1] = keys[1], keys[0]
	keyMu.Unlock()
	response, _ = getJSON(t, fixture.client, path)
	keyMu.Lock()
	selectedAuth := authValue
	keys = keys[:1]
	keyMu.Unlock()
	if response.StatusCode != 200 || selectedAuth != "Bearer agent-fixture-first" {
		t.Fatal("reordering changed identity")
	}
	response, body = getJSON(t, fixture.client, path)
	if response.StatusCode != 409 || !strings.Contains(string(body), "client_key_missing") {
		t.Fatalf("deleted key %d %s", response.StatusCode, body)
	}
}
func pointGatewayAt(t *testing.T, handler *Handler, baseURL string) {
	t.Helper()
	instance, err := handler.repo.GetInstance(context.Background(), "default")
	if err != nil {
		t.Fatal(err)
	}
	instance.BaseURL = baseURL
	if err := handler.repo.UpsertInstance(context.Background(), instance); err != nil {
		t.Fatal(err)
	}
}
