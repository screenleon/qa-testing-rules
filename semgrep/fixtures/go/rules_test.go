// Semgrep fixture tests for qa-testing-rules Go rules.
// Lines annotated with "// ruleid: <id>" must be matched by the named rule.
// Clean alternatives (no annotation) verify the rule doesn't fire on correct code.

package example_test

import (
	"os"
	"testing"
	"time"
)

// ── qa-no-sleep-in-tests-go (ERROR) ──────────────────────────────────────────

func TestSleepBad(t *testing.T) {
	// ruleid: qa-no-sleep-in-tests-go
	time.Sleep(100 * time.Millisecond)
}

// Clean alternative: wait on a channel instead of sleeping.
func TestSleepOk(t *testing.T) {
	done := make(chan struct{})
	go func() { close(done) }()
	<-done // deterministic; no sleep needed
}

// ── qa-no-chdir-in-tests-go (WARNING) ────────────────────────────────────────

func TestChdirBad(t *testing.T) {
	// ruleid: qa-no-chdir-in-tests-go
	os.Chdir("/tmp") //nolint:errcheck
}

// Clean alternative: pass paths as parameters or use t.TempDir().
func TestChdirOk(t *testing.T) {
	dir := t.TempDir()
	_ = dir // pass dir to SUT instead of chdir
}

// ── qa-use-t-setenv-go (WARNING) ─────────────────────────────────────────────

func TestSetenvBad(t *testing.T) {
	// ruleid: qa-use-t-setenv-go
	os.Setenv("DB_HOST", "localhost") //nolint:errcheck
}

// Clean alternative: t.Setenv auto-restores after the test.
func TestSetenvOk(t *testing.T) {
	t.Setenv("DB_HOST", "localhost") // restored automatically by testing framework
}
