# Health API Contract

**Branch**: `001-project-foundation`
**Date**: 2026-04-02

## Overview

The foundation exposes two health check endpoints for deployment monitoring and dependency verification. These are the only external-facing endpoints in Phase 1 (besides the admin panel and login page).

---

## Endpoints

### GET /api/health

**Purpose**: Liveness probe — confirms the application process is running and can serve requests.

**Authentication**: None required (public endpoint).

**Request**: No body, no query parameters.

**Success Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-04-02T20:00:00.000Z"
}
```

**Failure**: This endpoint should never fail if the application is running. If it does not respond, the application process is down.

**Behavior Notes**:
- Does NOT check database or any external dependency.
- Returns immediately (< 50ms under normal conditions).
- Used by deployment orchestrators for liveness probes.

---

### GET /api/health/ready

**Purpose**: Readiness probe — confirms the application is fully operational with all critical dependencies reachable.

**Authentication**: None required (public endpoint).

**Request**: No body, no query parameters.

**Success Response** (200 OK):
```json
{
  "status": "ready",
  "timestamp": "2026-04-02T20:00:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

**Failure Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "timestamp": "2026-04-02T20:00:00.000Z",
  "checks": {
    "database": "unreachable"
  },
  "reason": "One or more dependencies are not reachable"
}
```

**Behavior Notes**:
- Checks database connectivity by executing a lightweight query (e.g., `SELECT 1`).
- Returns 503 if any checked dependency is unreachable.
- Timeout: individual dependency checks time out after 5 seconds.
- Used by deployment orchestrators for readiness probes and by monitoring dashboards.

---

## Job Route Placeholders

The following routes exist as scaffolding and return `501 Not Implemented` in Phase 1. They accept POST only.

| Route | Phase Populated |
|-------|----------------|
| POST /api/jobs/ingest-parse | Phase 4 |
| POST /api/jobs/ingest-chunk | Phase 4 |
| POST /api/jobs/ingest-embed | Phase 4 |
| POST /api/jobs/delete-file-artifacts | Phase 4 |
| POST /api/jobs/cleanup-retention | Phase 2 |
| POST /api/jobs/process-inbound-message | Phase 5 |

**Placeholder Response** (501 Not Implemented):
```json
{
  "error": "Not implemented",
  "job": "<job-name>"
}
```

**Security Note**: In production, all job routes will validate QStash signatures. In Phase 1, they simply return 501 for any request.
