package agent

import (
	"context"
	"errors"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/oh-my-cpa/oh-my-cpa/internal/capability"
)

// WEB_SEARCH lets the model look something up on the open internet. It reads the DuckDuckGo HTML
// endpoint, which needs no API key, and returns titles, links and snippets.
const WEB_SEARCH = "web_search"

const (
	MAX_SEARCH_RESULTS     = 8
	MAX_SEARCH_QUERY_CHARS = 300

	WEB_SEARCH_DESCRIPTION = "Search the whole internet for current information and return up to 8 results (title, url, snippet). Use it for anything recent, factual or unknown to you, then cite the urls you relied on."
)

type WebSearchInput struct {
	Query string `json:"query" jsonschema:"What to search for, at most 300 characters"`
}

type WebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

type WebSearchOutput struct {
	Query   string            `json:"query"`
	Results []WebSearchResult `json:"results"`
}

var (
	searchLink    = regexp.MustCompile(`(?s)<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>`)
	searchSnippet = regexp.MustCompile(`(?s)<a[^>]*class="result__snippet"[^>]*>(.*?)</a>`)
	searchTag     = regexp.MustCompile(`<[^>]+>`)
)

func cleanSearchText(raw string) string {
	return strings.Join(strings.Fields(html.UnescapeString(searchTag.ReplaceAllString(raw, ""))), " ")
}

// unwrapSearchURL turns DuckDuckGo's redirect link into the real destination.
func unwrapSearchURL(raw string) string {
	raw = html.UnescapeString(raw)
	if strings.HasPrefix(raw, "//") {
		raw = "https:" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if target := parsed.Query().Get("uddg"); target != "" {
		return target
	}
	return raw
}

func parseSearchResults(page string) []WebSearchResult {
	links := searchLink.FindAllStringSubmatch(page, -1)
	snippets := searchSnippet.FindAllStringSubmatch(page, -1)
	results := []WebSearchResult{}
	for i, link := range links {
		if len(results) >= MAX_SEARCH_RESULTS {
			break
		}
		result := WebSearchResult{Title: cleanSearchText(link[2]), URL: unwrapSearchURL(link[1])}
		if i < len(snippets) {
			result.Snippet = cleanSearchText(snippets[i][1])
		}
		results = append(results, result)
	}
	return results
}

func searchWeb(ctx context.Context, query string) (WebSearchOutput, error) {
	query = strings.TrimSpace(query)
	if query == "" || len([]rune(query)) > MAX_SEARCH_QUERY_CHARS {
		return WebSearchOutput{}, errors.New("invalid_tool_arguments")
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://html.duckduckgo.com/html/", strings.NewReader(url.Values{"q": {query}}.Encode()))
	if err != nil {
		return WebSearchOutput{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return WebSearchOutput{}, errors.New("web_search_unreachable")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil || response.StatusCode != http.StatusOK {
		return WebSearchOutput{}, errors.New("web_search_unreachable")
	}
	return WebSearchOutput{Query: query, Results: parseSearchResults(string(body))}, nil
}

// RegisterWebSearch adds the internet search capability, offered to the built-in Agent only.
func RegisterWebSearch(registry *capability.Registry) error {
	metadata := capability.Metadata{Name: WEB_SEARCH, Description: WEB_SEARCH_DESCRIPTION, Version: 1, Permission: "read", Risk: "low", Adapters: []string{"agent"}}
	return capability.Register(registry, metadata, nil, func(ctx context.Context, input WebSearchInput, _, _ string) (WebSearchOutput, error) {
		return searchWeb(ctx, input.Query)
	})
}
