# Task Manager

A multi-user task manager built with Next.js (App Router, TypeScript) and SQLite.
Domain terms are defined in [CONTEXT.md](CONTEXT.md).

Requirements: Node.js 20+ (developed on Node 24) and npm.

## Install

```bash
npm install
npx playwright install chromium   # one-off: browser used by the tests (npm run test:browsers)
```

## Run the application

```bash
npm run dev                       # http://localhost:3000
```

Production build:

```bash
npm run build
npm start                         # http://localhost:3000
```

Configuration (environment variables):

| Variable          | Default                | Meaning                                                                 |
| ----------------- | ---------------------- | ----------------------------------------------------------------------- |
| `APP_TIME_ZONE`   | `UTC`                  | The one application-wide IANA time zone that defines "today".           |
| `DATABASE_PATH`   | `data/task-master.db`  | SQLite file. The schema is created by versioned migrations on first use.|

The home page shows today's date from the application clock, the only source of
"now" and "today".

## Test mode

Test mode enables two test-only controls. Start the app in test mode:

```bash
npm run dev:test                  # http://localhost:3100, build dir .next-test
```

(Equivalent: run the app with `TASK_MASTER_TEST_MODE=1` outside a production build.)
In test mode the app uses a separate database under `data/test/`, never `DATABASE_PATH`.

### The two test-only controls

Both are `POST` endpoints and exist only in test mode; in a production build
(`npm run build` + `npm start`) they respond `404 Not found`, even if
`TASK_MASTER_TEST_MODE=1` is set.

Set the clock to a chosen moment (ISO-8601), then reload the home page:

```bash
curl -X POST http://localhost:3100/api/test/clock \
  -H "content-type: application/json" -d '{"now":"2030-01-15T10:00:00Z"}'
# the home page now shows 15 January 2030
curl -X POST http://localhost:3100/api/test/clock \
  -H "content-type: application/json" -d '{"now":null}'     # back to the real clock
```

Reset to an empty database (the schema is re-created on next use):

```bash
curl -X POST http://localhost:3100/api/test/reset-database
```

By hand (no cookie) these act on a shared `default` test database and clock. Each
browser test instead carries a `tm-test-db` cookie with a unique id, which gives
it its own isolated SQLite database and clock.

## Browser tests

```bash
npm test
```

This starts the app in test mode on port 3100 (override with `TEST_PORT`) and runs
the Playwright tests in `tests/` in parallel, one isolated database per test. Tests
drive the real UI and locate elements by accessible role and label only. Shared
helpers (`app.setClock(...)`, `app.resetDatabase()`) are in `tests/support.ts`; import
`test` and `expect` from there.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
