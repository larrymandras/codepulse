# Deferred Items — Phase 108

Out-of-scope discoveries found during plan execution, logged rather than fixed
(SCOPE BOUNDARY: only auto-fix issues directly caused by the current task's
changes).

## 108-01

- **`tests/unit/automation/test_pipes.py::TestPipeManagerScan::test_scan_updates_changed_pipes`
  (astridr-repo) — intermittently flaky, unrelated to this plan.** Full-suite
  run (`pytest tests/ -q`, 9795 passed / 1 failed / 112 skipped / 1 xpassed,
  391.85s) surfaced one failure in `astridr/automation/pipes.py`'s
  `PipeManager.scan()` — a filesystem-mtime-granularity race (the test writes
  a pipe file, scans, rewrites the same file with a changed schedule, scans
  again, and asserts the schedule updated; on a fast rewrite the second
  write's mtime can land in the same granularity window as the first,
  so the scan doesn't see it as changed). Confirmed flaky, not a regression:
  re-ran in isolation 3x — fail, fail, pass. No file this plan touches
  (`astridr/channels/agent_processor.py`, `astridr/engine/bootstrap/wiring.py`,
  `astridr/providers/router.py`, `docs/astridr-contract.md`, the two new/
  modified test files) has any relationship to `astridr/automation/pipes.py`
  or its test file. Not fixed; left for a future pipes-subsystem pass.
