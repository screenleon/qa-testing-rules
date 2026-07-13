// Semgrep fixture tests for qa-testing-rules Rust rules.

#[test]
fn sleep_bad() {
    // ruleid: qa-no-sleep-in-tests-rust
    std::thread::sleep(std::time::Duration::from_millis(100));
}

#[test]
// ruleid: qa-no-ignored-tests-rust
#[ignore]
fn ignored_bad() {}
