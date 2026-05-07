# Open Design Daemon

This directory must contain the nexu-io/open-design source before the Docker sidecar can be built.

## Setup

Clone the full repo here:

```bash
# From the codepulse repo root:
git clone https://github.com/nexu-io/open-design.git open-design
```

Then build and start the sidecar:

```bash
docker compose up --build -d
```

The daemon will be available at http://localhost:17456

## Notes

- The Dockerfile uses `node:24-alpine` — required for `better-sqlite3` ABI compatibility (RESEARCH.md Pitfall 7)
- Data is persisted in the `open-design-data` Docker volume at `/app/.od`
- Health check: `curl http://localhost:17456/api/health`
