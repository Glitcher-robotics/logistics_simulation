# Working on Logistics Simulation

## Read first

1. `docs/PRODUCT.md`: the user's actual problem and current scope.
2. `docs/ARCHITECTURE.md`: contracts, coordinates, engine/view separation.
3. `docs/PLAN.md`: completed work, next vertical slice, acceptance criteria.
4. `docs/VALIDATION.md`: verification commands and known model limits.

## Product constraints

- Build a spatial 3D logistics simulator. The warehouse viewport and observable robot work are the primary product; metrics support them.
- The objective is AMR/forklift fleet sizing, operating-policy evaluation, productivity, and finding bottlenecks before deployment.
- Do not replace the 3D application with charts, an inline demo, a video, or precomputed decorative animation.
- No real factory data is available. Use clearly identified synthetic scenarios. Assets must run locally without CDN requests or API keys.
- This bootstrap supports **one AMR**. Do not expose fleet controls until shared-space arbitration exists and has tests.

## Implementation contracts

- `src/sim` is pure TypeScript: no React, Three.js, DOM, wall clock, timers, or random globals.
- The simulation clock owns all movement, task, pallet, and completion state. Rendering only projects snapshots. Never advance business state by FPS or animation frames.
- Coordinates: metres; floor `(x, z)`; elevation `y`; seconds; radians. CAD `(x, y)` maps to floor `(x, z)` after explicit unit conversion.
- Validate scenario files at the boundary. Duplicate IDs, missing references, disconnected task routes, invalid numbers, and out-of-bounds routes must fail with an actionable error.
- Preserve deterministic replay. If randomness is introduced, add an explicit seed and test repeatability.
- A rendered pallet must be owned by exactly one place: pickup, robot, or drop-off. Task completion occurs only after unloading finishes.
- Dispose render resources/listeners on unmount. Report WebGL failures visibly.
- Public scenarios and exported reports contain no private plant data or credentials. Never introduce proprietary model downloads without an explicit asset decision.

## Development loop

1. Choose one acceptance item in `docs/PLAN.md`; keep the change reviewable.
2. Implement domain behavior before connecting the viewer.
3. Add meaningful tests for new simulation rules, imported data, or regressions.
4. Run `pnpm check`; for behavior visible in the application also run `pnpm test:e2e` and inspect the 3D viewport.
5. Update the plan, assumptions, and user-facing docs to match what actually works.
6. Report changes, evidence, and remaining limits. Do not label future features as complete.

Do not change `scenarios/expected/` merely to make tests pass. Explain the changed physical or operational rule and independently check the expected result first. Never claim transport capacity, collision safety, navigation equivalence, or manufacturer-controller accuracy from this bootstrap.

## Repository map

- `src/sim`: scenario validation, routing, deterministic event engine, headless report.
- `src/viewer`: Three.js scene and snapshot projection.
- `src/app`: application controls and simulation orchestration.
- `scenarios`: versioned synthetic inputs and independently checked expectations.
- `tests/e2e`: browser workflows, real WebGL viewport smoke tests.
- `scripts`: environment checks, verification runner, headless scenario CLI.
- `.github/workflows`: CI using the same local commands.

Keep product, geometry, and assumptions separate. DWG conversion, robot controllers, and physics are adapters with explicit scope, not silent behavior added to the renderer.
