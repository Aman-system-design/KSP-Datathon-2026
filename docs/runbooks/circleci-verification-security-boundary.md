# CircleCI Verification Security Boundary

The `pull-request-verification` workflow checks source, tests, web bundles, Catalyst Function bundles, schemas, and the pinned Node 18 refresh-runtime compatibility suite. It does not deploy or mutate Catalyst resources.

The compatibility runtime uses exact `18.20.8` optional dependencies for the available Linux x64, Linux arm64, Windows x64, and macOS x64 prebuilt binary packages recorded in `tools/node18-runtime/package-lock.json`. CI runs `npm ci --prefix tools/node18-runtime --ignore-scripts` before the dependency cache is saved. The lock requires integrity metadata and forbids install-script packages, so compatibility verification never runs a lifecycle downloader. Keeping this tooling package outside the root npm workspaces prevents its `.bin/node` shim from shadowing the pinned CircleCI Node 24 runtime. The wrapper selects the package for the current platform and architecture, resolves its binary directly, proves it reports `v18.20.8`, builds a fresh refresh Function bundle in a temporary directory, and loads and executes the deployed entry path under that binary. Unsupported hosts fail with an explicit message; there is no `npx`, network fallback, or unpinned system Node 18 fallback. macOS arm64 is unsupported because an exact 18.20.8 package is not published.

| Host | Locked package | Support |
|---|---|---|
| CircleCI Linux x64 | `node-linux-x64@18.20.8` | Verified |
| Local Linux arm64 | `node-linux-arm64@18.20.8` | Locked |
| Local Windows x64 | `node-win-x64@18.20.8` | Verified |
| Local macOS x64 | `node-darwin-x64@18.20.8` | Locked |
| Local macOS arm64 | None published at 18.20.8 | Unsupported; fails closed |

The CircleCI project that runs this workflow must not contain production secrets, deployment tokens, Catalyst production credentials, or a context that exposes them. Repository configuration can prove that the workflow declares no context, environment mapping, or deploy command. Project environment variables cannot be inspected or ruled out by repository tests, so a CircleCI administrator must verify that boundary in project settings.

Production deployment credentials belong only in a separate, restricted, approval-gated context or deployment project. That deployment boundary must require named operator approval and must not be attached to pull-request verification jobs.
