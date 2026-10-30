package repository

import (
	"context"
	"fmt"
	"testing"
)

func TestPlaygroundSessionMigrationDropsOnlyThatPreference(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, fmt.Sprintf("file:playground_session_upgrade_%d?mode=memory&cache=shared", usageDSNCounter.Add(1)), withMigrationsUntil(46))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.SQL.ExecContext(ctx, `INSERT INTO ui_preferences(pref_key, pref_value, updated_at_ms) VALUES
 ('playground_session', '{"model":"gpt-5","turns":[]}', 1),
 ('agent_target', '{"model":"gpt-5"}', 2)`); err != nil {
		t.Fatal(err)
	}
	db.migrateUntil = 0
	if err := db.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	var retired, kept int
	if err := db.SQL.QueryRowContext(ctx, `SELECT COUNT(1) FROM ui_preferences WHERE pref_key = 'playground_session'`).Scan(&retired); err != nil {
		t.Fatal(err)
	}
	if err := db.SQL.QueryRowContext(ctx, `SELECT COUNT(1) FROM ui_preferences WHERE pref_key = 'agent_target'`).Scan(&kept); err != nil {
		t.Fatal(err)
	}
	if retired != 0 || kept != 1 {
		t.Fatalf("retired rows = %d, kept rows = %d, want 0 and 1", retired, kept)
	}
}
