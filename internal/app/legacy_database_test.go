package app

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bizasbot/shell-pamc/internal/config"
)

func quietLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func startableConfig(t *testing.T, dataDir string) config.Config {
	t.Helper()
	// The application refuses to start without an IANA zone, and a Windows host has none.
	t.Setenv("TZ", "UTC")
	return config.Config{
		ListenAddr:   "127.0.0.1:0",
		BasePath:     "/shell-pamc",
		DataDir:      dataDir,
		DatabasePath: filepath.Join(dataDir, "shell-pamc.db"),
		MasterKey:    "01234567890123456789012345678901",
		Release:      config.ReleaseConfig{OMCRepository: "Bizasbot/Shell-PAMC", CPARepository: "router-for-me/CLIProxyAPI"},
	}
}

// An installation upgraded in place keeps its data: the first boot under the new name
// finds the old file and renames it rather than creating an empty database beside it.
func TestStartupAdoptsADatabaseWrittenUnderTheOldName(t *testing.T) {
	dir := t.TempDir()
	first, err := newApp(context.Background(), startableConfig(t, dir), quietLogger())
	if err != nil {
		t.Fatalf("first boot: %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	for _, suffix := range []string{"", "-wal", "-shm"} {
		current, legacy := filepath.Join(dir, "shell-pamc.db"+suffix), filepath.Join(dir, "oh-my-cpa.db"+suffix)
		if _, err := os.Stat(current); err == nil {
			if err := os.Rename(current, legacy); err != nil {
				t.Fatal(err)
			}
		}
	}
	second, err := newApp(context.Background(), startableConfig(t, dir), quietLogger())
	if err != nil {
		t.Fatalf("boot after the rename: %v", err)
	}
	defer second.Close()
	if _, err := os.Stat(filepath.Join(dir, "oh-my-cpa.db")); err == nil {
		t.Fatal("the old file must have been renamed, not copied")
	}
	if _, err := os.Stat(filepath.Join(dir, "shell-pamc.db")); err != nil {
		t.Fatalf("the database must live under the new name: %v", err)
	}
}

func TestStartupRefusesWhenBothDatabasesExist(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"oh-my-cpa.db", "shell-pamc.db"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	app, err := newApp(context.Background(), startableConfig(t, dir), quietLogger())
	if err == nil {
		_ = app.Close()
		t.Fatal("two databases is ambiguous and must stop the boot")
	}
	if !strings.Contains(err.Error(), "oh-my-cpa.db and shell-pamc.db") {
		t.Fatalf("the boot must stop on the ambiguity, got: %v", err)
	}
}
