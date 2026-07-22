# CircleCI Verification Security Boundary

The `pull-request-verification` workflow checks source, tests, web bundles, Catalyst Function bundles, schemas, and the pinned Node 18 refresh-runtime compatibility suite. It does not deploy or mutate Catalyst resources.

The compatibility runtime is the exact `node@18.20.8` development dependency recorded in `tools/node18-runtime/package-lock.json`. CI runs `npm ci --prefix tools/node18-runtime` before the dependency cache is saved. Keeping this tooling package outside the root npm workspaces prevents its `.bin/node` shim from shadowing the pinned CircleCI Node 24 runtime on Linux or Windows. The compatibility wrapper resolves `tools/node18-runtime/node_modules/node/bin/node` directly, proves the binary reports `v18.20.8`, builds a fresh refresh Function bundle in a temporary directory, and loads and executes the deployed entry path under that binary. It does not use `npx`, download a runtime during verification, or depend on an unpinned system Node 18 installation.

The CircleCI project that runs this workflow must not contain production secrets, deployment tokens, Catalyst production credentials, or a context that exposes them. Repository configuration can prove that the workflow declares no context, environment mapping, or deploy command. Project environment variables cannot be inspected or ruled out by repository tests, so a CircleCI administrator must verify that boundary in project settings.

Production deployment credentials belong only in a separate, restricted, approval-gated context or deployment project. That deployment boundary must require named operator approval and must not be attached to pull-request verification jobs.
