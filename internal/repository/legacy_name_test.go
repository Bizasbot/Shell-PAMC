package repository

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFiles(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

func exists(dir, name string) bool {
	_, err := os.Stat(filepath.Join(dir, name))
	return err == nil
}

func TestLegacyDatabaseMovesWithItsWALAndSharedMemory(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{
		"oh-my-cpa.db": "main", "oh-my-cpa.db-wal": "wal", "oh-my-cpa.db-shm": "shm",
	})
	migrated, err := MigrateLegacyDatabaseName(dir)
	if err != nil || !migrated {
		t.Fatalf("migrated=%v err=%v, want true and nil", migrated, err)
	}
	for suffix, want := range map[string]string{"": "main", "-wal": "wal", "-shm": "shm"} {
		got, readErr := os.ReadFile(filepath.Join(dir, "shell-pamc.db"+suffix))
		if readErr != nil || string(got) != want {
			t.Errorf("shell-pamc.db%s = %q (%v), want %q", suffix, got, readErr, want)
		}
		if exists(dir, "oh-my-cpa.db"+suffix) {
			t.Errorf("oh-my-cpa.db%s must not remain after the move", suffix)
		}
	}
}

func TestLegacyDatabaseWithoutSiblingFilesStillMoves(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{"oh-my-cpa.db": "main"})
	if migrated, err := MigrateLegacyDatabaseName(dir); err != nil || !migrated {
		t.Fatalf("migrated=%v err=%v", migrated, err)
	}
	if !exists(dir, "shell-pamc.db") || exists(dir, "shell-pamc.db-wal") {
		t.Fatal("only the main file existed, only the main file should appear")
	}
}

func TestNewInstallationHasNothingToMigrate(t *testing.T) {
	dir := t.TempDir()
	if migrated, err := MigrateLegacyDatabaseName(dir); err != nil || migrated {
		t.Fatalf("migrated=%v err=%v, want false and nil", migrated, err)
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Fatalf("an empty directory must stay empty, got %d entries", len(entries))
	}
}

func TestAlreadyMigratedInstallationIsLeftAlone(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{"shell-pamc.db": "current"})
	if migrated, err := MigrateLegacyDatabaseName(dir); err != nil || migrated {
		t.Fatalf("migrated=%v err=%v, want false and nil", migrated, err)
	}
}

// Booting on an empty new database while the old one still holds the data would look
// like data loss, so both files existing is an error and neither file is touched.
func TestBothDatabasesPresentIsRefusedAndNothingChanges(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, map[string]string{"oh-my-cpa.db": "old", "shell-pamc.db": "new"})
	migrated, err := MigrateLegacyDatabaseName(dir)
	if err == nil || migrated {
		t.Fatalf("migrated=%v err=%v, want false and an error", migrated, err)
	}
	for name, want := range map[string]string{"oh-my-cpa.db": "old", "shell-pamc.db": "new"} {
		got, _ := os.ReadFile(filepath.Join(dir, name))
		if string(got) != want {
			t.Errorf("%s = %q, want %q untouched", name, got, want)
		}
	}
}
