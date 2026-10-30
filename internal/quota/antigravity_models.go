package quota

import (
	"encoding/json"
	"sort"
	"strings"
	"time"
)

func hasAntigravityGeminiScope(windows []QuotaWindow) bool {
	for _, window := range windows {
		// These families come from the summary's exact reviewed group mapping,
		// not substring matches against an upstream display label.
		for _, family := range window.ModelFamilies {
			switch family {
			case "gemini", "gemini-3-pro", "gemini-3-flash":
				return true
			}
		}
	}
	return false
}

func parseAntigravityModels(raw []byte, nowMS int64) []QuotaWindow {
	var payload struct {
		Models map[string]json.RawMessage `json:"models"`
	}
	if json.Unmarshal(raw, &payload) != nil {
		return nil
	}
	modelIDs := make([]string, 0, len(payload.Models))
	for modelID := range payload.Models {
		if strings.HasPrefix(modelID, "gemini-") && len(modelID) > len("gemini-") {
			modelIDs = append(modelIDs, modelID)
		}
	}
	sort.Strings(modelIDs)
	var windows []QuotaWindow
	for _, modelID := range modelIDs {
		var model struct {
			QuotaInfo *struct {
				RemainingFraction any `json:"remainingFraction"`
				ResetTime         any `json:"resetTime"`
			} `json:"quotaInfo"`
		}
		if json.Unmarshal(payload.Models[modelID], &model) != nil || model.QuotaInfo == nil {
			continue
		}
		window := QuotaWindow{
			ID: "ag_model_" + modelID, Label: modelID,
			Scope: "model", Kind: "model_scoped", Model: modelID,
		}
		if value := model.QuotaInfo.RemainingFraction; value != nil {
			fraction, ok := value.(float64)
			if !ok || fraction < 0 || fraction > 1 {
				continue
			}
			remaining := fraction * 100
			used := 100 - remaining
			window.RemainingPercent, window.UsedPercent = &remaining, &used
		}
		if reset, ok := model.QuotaInfo.ResetTime.(string); ok {
			if instant, err := time.Parse(time.RFC3339, reset); err == nil {
				ms := instant.UnixMilli()
				window.ResetAtMS = &ms
				window.ResetLabel = formatResetInstant(ms, nowMS)
				window.ResetAccuracy = "exact"
			}
		}
		// Equal observations do not establish independent account pools or
		// aliases. Neither a period nor a broader model family is inferred.
		windows = append(windows, window)
	}
	return windows
}
