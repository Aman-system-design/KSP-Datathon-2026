# CircleCI Verification Security Boundary

The `pull-request-verification` workflow checks source, tests, web bundles, Catalyst Function bundles, schemas, and the pinned Node 18 refresh-runtime compatibility suite. It does not deploy or mutate Catalyst resources.

The CircleCI project that runs this workflow must not contain production secrets, deployment tokens, Catalyst production credentials, or a context that exposes them. Repository configuration can prove that the workflow declares no context, environment mapping, or deploy command. Project environment variables cannot be inspected or ruled out by repository tests, so a CircleCI administrator must verify that boundary in project settings.

Production deployment credentials belong only in a separate, restricted, approval-gated context or deployment project. That deployment boundary must require named operator approval and must not be attached to pull-request verification jobs.
