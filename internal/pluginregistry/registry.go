// Package pluginregistry names the plugin registry Shell-PAMC publishes for CPA's
// plugin store.
//
// The registry document itself lives in this repository (`plugins/registry.json`) and
// is served from the `master` branch, so the address is a compile-time fact rather
// than an operator setting: every installation has the source, and the console is
// what switches it off when the operator asks.
package pluginregistry

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

const (
	// OMCSourceURL is where CPA reads Shell-PAMC's plugin registry.
	OMCSourceURL = "https://raw.githubusercontent.com/Bizasbot/Shell-PAMC/main/plugins/registry.json"
	// OMCSourceName is what the console calls the registry. CPA derives a source's
	// name from the URL's host, which for a raw GitHub address says nothing about
	// who publishes it.
	OMCSourceName = "Shell-PAMC"
)

// SourceID is the id CPA assigns a configured registry: `source-` followed by the
// first 12 hex characters of the URL's SHA-256. Mirrored here because a fixture or a
// test that names the source by id has to name the one the gateway computes.
func SourceID(registryURL string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(registryURL)))
	return "source-" + hex.EncodeToString(sum[:])[:12]
}
