package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/oh-my-cpa/oh-my-cpa/internal/cpa/gateway"
	"github.com/oh-my-cpa/oh-my-cpa/internal/cpa/management"
)

// writeRunError answers a browser-facing run or Agent request with a stable machine code.
func writeRunError(writer http.ResponseWriter, status int, code string) {
	writeJSON(writer, status, map[string]string{"code": code})
}

// clientKeyForResolution returns the plaintext of the one key a fingerprint names.
//
// This is the only place the fingerprint-to-key join runs, so CPA's key list is fetched once
// per API request rather than once per layer that needs the answer.
func (h *Handler) clientKeyForResolution(ctx context.Context, client *management.Client, fingerprint string) (string, error) {
	keys, err := client.ClientAPIKeys(ctx)
	if err != nil {
		return "", err
	}
	for _, key := range keys {
		key = strings.TrimSpace(key)
		identity, err := h.repo.UsageClientKeyFingerprint(key)
		if err != nil {
			return "", err
		}
		if identity == fingerprint {
			return key, nil
		}
	}
	return "", errClientKeyMissing
}

// errClientKeyMissing separates "no such key" from "the gateway could not be reached".
//
// The first is an operator's stale selection and the second is an outage; they ask for
// different things, and a console answering both with one failure cannot say which.
var errClientKeyMissing = errors.New("client_key_missing")

func (h *Handler) modelsClient(writer http.ResponseWriter, request *http.Request, fingerprint string) (*gateway.Client, bool) {
	if fingerprint == "" || len(fingerprint) > 256 {
		writeRunError(writer, 400, "client_key_required")
		return nil, false
	}
	managementClient, ok := h.managementClientOrError(writer, request)
	if !ok {
		return nil, false
	}
	key, err := h.clientKeyForResolution(request.Context(), managementClient, fingerprint)
	if errors.Is(err, errClientKeyMissing) {
		writeRunError(writer, 409, "client_key_missing")
		return nil, false
	}
	if err != nil {
		writeRunError(writer, 502, "gateway_unavailable")
		return nil, false
	}
	client, err := gateway.NewClient(managementClient.BaseURL(), key, h.cfg.TLSSkipVerify)
	if err != nil {
		writeRunError(writer, 502, "gateway_unavailable")
		return nil, false
	}
	return client, true
}

// listAgentModels projects the call points one client key can reach, for the Agent's selector.
func (h *Handler) listAgentModels(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	client, ok := h.modelsClient(writer, request, request.URL.Query().Get("client_key_fingerprint"))
	if !ok {
		return
	}
	models, err := client.ListModels(request.Context())
	if err != nil {
		writeJSON(writer, 502, gateway.ErrorEvent(err))
		return
	}
	writeJSON(writer, 200, map[string]any{"models": models})
}
