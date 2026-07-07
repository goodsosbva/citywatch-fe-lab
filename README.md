# CityWatch FE Lab

A city safety monitoring frontend lab. The app is built as a learning proof: each monitoring feature will expose the frontend stack behind it through X-Ray labels and proof pages.

## Workspace

- `apps/web`: Next App Router host app
- `apps/analytics-remote`: Module Federation analytics remote
- `apps/realtime-server`: WebSocket/polling demo server
- `packages/ui`: shared UI and X-Ray proof components
- `packages/api-types`: shared incident, region, and realtime message types
- `packages/config`: shared tooling config when it becomes necessary

## First implementation flow

1. Shared contracts in `packages/api-types`
2. Shared `XRayBox`/UI in `packages/ui`
3. Next host shell in `apps/web`
4. Federation smoke test in `apps/analytics-remote`
5. Monitoring features one by one
