# Semgrep fixture tests for qa-testing-rules Python rules.
# Annotated lines must be matched by the named rule.
# Clean alternatives (no annotation) verify the rule doesn't fire on correct code.

import time


# ── qa-no-sleep-in-tests-python (ERROR) ──────────────────────────────────────

def test_sleep_bad():
    do_work_async()
    # ruleid: qa-no-sleep-in-tests-python
    time.sleep(0.1)
    assert get_result() == "done"


# Clean alternative: poll or wait for a deterministic signal.
def test_sleep_ok():
    do_work_async()
    wait_until(lambda: get_result() == "done", timeout=1.0)
    assert get_result() == "done"


# ── stubs so the fixture file is parseable ────────────────────────────────────

def do_work_async():
    pass


def get_result():
    return "done"


def wait_until(condition, timeout):
    import time as _time
    deadline = _time.monotonic() + timeout
    while _time.monotonic() < deadline:
        if condition():
            return
        _time.monotonic()  # just checking clock, not sleeping
    raise TimeoutError("condition not met")
