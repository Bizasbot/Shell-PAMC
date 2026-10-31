package repository

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	legacyDatabaseName  = "oh-my-cpa.db"
	currentDatabaseName = "shell-pamc.db"
)

// MigrateLegacyDatabaseName renames a database written under the product's old name,
// together with its WAL and shared-memory files, so an installation upgraded in place
// keeps its data instead of booting on an empty file.
//
// It reports whether a rename happened. Both names existing is an error rather than a
// choice: picking one would either hide the data in the other or overwrite it, and the
// operator is the one who knows which is real. The sibling files move before the main
// file, so an interruption never leaves a new-name database next to an old-name WAL
// that SQLite would then ignore.
func MigrateLegacyDatabaseName(dataDir string) (bool, error) {
	legacy := filepath.Join(dataDir, legacyDatabaseName)
	current := filepath.Join(dataDir, currentDatabaseName)
	if _, err := os.Stat(legacy); errors.Is(err, os.ErrNotExist) {
		return false, nil
	} else if err != nil {
		return false, fmt.Errorf("inspect legacy database: %w", err)
	}
	if _, err := os.Stat(current); err == nil {
		return false, fmt.Errorf("both %s and %s exist in %s; keep the one that holds your data and remove the other", legacyDatabaseName, currentDatabaseName, dataDir)
	} else if !errors.Is(err, os.ErrNotExist) {
		return false, fmt.Errorf("inspect database: %w", err)
	}
	for _, suffix := range []string{"-wal", "-shm", ""} {
		if err := os.Rename(legacy+suffix, current+suffix); err != nil && !errors.Is(err, os.ErrNotExist) {
			return false, fmt.Errorf("rename %s%s: %w", legacyDatabaseName, suffix, err)
		}
	}
	return true, nil
}
