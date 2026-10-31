package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bizasbot/shell-pamc/internal/crypto"
)

// writtenBackup opens a database, takes one migration backup and returns the path of the
// encrypted file together with its cipher.
func writtenBackup(t *testing.T) (string, *crypto.Cipher) {
	t.Helper()
	cipher, err := crypto.New("01234567890123456789012345678901")
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	backupDirectory := filepath.Join(directory, "backups")
	db, err := Open(context.Background(), filepath.Join(directory, "test.db"), WithBackupConfig(BackupConfig{
		Cipher:    cipher,
		Directory: backupDirectory,
		Retention: 2,
		FreeSpace: func(string) (uint64, error) { return 1 << 30, nil },
	}))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.createMigrationBackup(context.Background(), 100); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(backupDirectory)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".db.enc") {
			return filepath.Join(backupDirectory, entry.Name()), cipher
		}
	}
	t.Fatal("no .db.enc file written")
	return "", nil
}

func formatOf(t *testing.T, path string) string {
	t.Helper()
	encoded, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var envelope encryptedBackup
	if err := json.Unmarshal(encoded, &envelope); err != nil {
		t.Fatal(err)
	}
	return envelope.Format
}

func TestNewBackupsCarryTheShellPAMCFormat(t *testing.T) {
	path, _ := writtenBackup(t)
	if got := formatOf(t, path); got != "shell-pamc/sqlite-backup-v1" {
		t.Fatalf("backup format = %q, want shell-pamc/sqlite-backup-v1", got)
	}
}

// A backup written before the rename names the old product and must stay restorable:
// the operator keeps backups for the same reason a migration takes one.
func TestRestoreStillAcceptsABackupWrittenUnderTheOldName(t *testing.T) {
	path, cipher := writtenBackup(t)
	encoded, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var envelope encryptedBackup
	if err := json.Unmarshal(encoded, &envelope); err != nil {
		t.Fatal(err)
	}
	envelope.Format = "oh-my-cpa/sqlite-backup-v1"
	legacy, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, legacy, 0o600); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(legacy)
	if err := os.WriteFile(path+".sha256", []byte(hex.EncodeToString(digest[:])+"  "+filepath.Base(path)+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := RestoreBackupSmoke(context.Background(), path, cipher); err != nil {
		t.Fatalf("a backup under the old format must still restore: %v", err)
	}
}

func TestRestoreRejectsAnUnknownBackupFormat(t *testing.T) {
	path, cipher := writtenBackup(t)
	encoded, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var envelope encryptedBackup
	if err := json.Unmarshal(encoded, &envelope); err != nil {
		t.Fatal(err)
	}
	envelope.Format = "someone-else/sqlite-backup-v1"
	other, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, other, 0o600); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(other)
	if err := os.WriteFile(path+".sha256", []byte(hex.EncodeToString(digest[:])+"  "+filepath.Base(path)+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	err = RestoreBackupSmoke(context.Background(), path, cipher)
	if err == nil || !strings.Contains(err.Error(), "backup envelope is invalid") {
		t.Fatalf("expected an invalid envelope error, got %v", err)
	}
}
