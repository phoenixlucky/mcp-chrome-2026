# Engineering Optimization Baseline

Captured on 2026-09-29 from the current working tree with Node.js 24 and pnpm.
This snapshot includes existing uncommitted changes, including the WASM-only
extension package work.

## Local Measurements

| Measure                            |                                                           Result | How to reproduce                                                                |
| ---------------------------------- | ---------------------------------------------------------------: | ------------------------------------------------------------------------------- |
| Extension production output        |                                                          9.04 MB | `pnpm build:extension`                                                          |
| Chrome extension ZIP               |                                        6,478,613 bytes (6.48 MB) | `pnpm --filter @ethanwilkins/chrome-mcp-server-2026 zip`                        |
| Background bundle                  |                                                          2.76 MB | Read WXT production build output                                                |
| Largest separate chunks            |      ELK 1.43 MB; semantic engine 893.85 KB; sidepanel 667.46 KB | Read WXT production build output                                                |
| Extension tests                    |                                       73 files, 639 tests passed | `pnpm --filter @ethanwilkins/chrome-mcp-server-2026 test -- --reporter=default` |
| Native server tests                |                                       19 suites, 85 tests passed | `pnpm --filter @ethanwilkins/mcp-chrome-bridge-2026 test -- --runInBand`        |
| Typecheck / lint / workspace build |                                                           Passed | `pnpm typecheck`, `pnpm lint`, `pnpm build`                                     |
| Phase 8 mixed admission load       | 1,000 requests; 0 queued/active/rejected/timed out at completion | `pnpm check:phase8:built` after `pnpm build`                                    |
| Recent GitHub Actions CI sample    |                     10/10 successful; latest workflow took 132 s | `gh run list --workflow ci.yml --limit 10`                                      |

The production ZIP checker confirmed required WASM assets are present, JSEP
assets are absent, and the archive is below the 6.6 MB limit.

The latest CI workflow's parallel jobs took 110 s (checks), 125 s
(desktop-native), and 128 s (WASM). Installing `wasm-pack` v0.15.0 took 82 s,
including about 73 s compiling it. Both workflows now pin and cache this binary;
the next GitHub Actions run must confirm the cache hit and measured improvement.

## Measurements Requiring External Runners

Cold Chrome extension startup and real page-operation latency are not available
from this local run. The local smoke endpoint returned HTTP 403, so no browser
actions were executed. Capture those timings on the prepared Windows Chrome
acceptance runner before setting numeric targets. Keep the same browser profile,
fixture pages, machine, and operation script when comparing future measurements.
Record CI job durations separately for the checks, desktop-native, and WASM jobs
so parallel runtime is not confused with total work.

## Current Notes

- The first full extension test run exposed a wall-clock-sensitive combobox
  test under parallel load. Its threshold was widened while retaining the
  140 ms delayed-option scenario; the full suite then passed.
- CI builds the workspace before running the phase 8 admission gate. CI now
  uses the gate against that existing build; the local `check:phase8` command
  still builds Native server first for standalone use.
