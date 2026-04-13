# Quickstart: WAHA Integration and Workspace Status Gate

**Branch**: `003-waha-workspace-status`

---

## Prerequisites

Before starting Phase 3 implementation:

1. ✅ Spec 1 (Project Foundation) is complete and verified
2. ✅ Spec 2 (Database Setup) is complete and verified
3. ✅ All collections exist: `whatsapp_sessions`, `agents`, `workspaces`
4. ✅ `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
5. ✅ WAHA gateway is deployed and accessible (separate infrastructure)
6. ✅ WAHA environment variables are configured in `.env`

## Required Environment Variables

Add to `.env` (most already exist from Spec 1 scaffolding — verify values):

```bash
# WAHA Configuration
WAHA_BASE_URL=https://your-waha-host.example.com
WAHA_ADMIN_API_KEY=your-waha-admin-api-key
WAHA_WEBHOOK_HMAC_SECRET=your-hmac-secret-min-32-chars
WAHA_ALLOWED_IPS=203.0.113.10,203.0.113.11
ENABLE_WAHA_SANDBOX=false
```

## Validation Sequence

After implementation, validate in this order:

### 1. Build Validation
```bash
pnpm typecheck
pnpm lint
pnpm build
```

### 2. Unit Test Validation
```bash
pnpm test:unit
```

Expected passing tests:
- WAHA webhook HMAC verification (valid, invalid, missing)
- IP allowlist validation (allowed, blocked, empty list in sandbox)
- Workspace status gate (active → pass, paused → block, disabled → block)
- Locale detection (Arabic text, English text, mixed, empty)
- WAHA status mapping (WORKING → connected, SCAN_QR_CODE → qr_pending, etc.)
- System reply locale resolution (agent pref, detection, default)

### 3. Integration Test Validation
```bash
pnpm test:integration
```

Expected passing tests:
- Webhook route accepts valid HMAC + allowed IP
- Webhook route rejects invalid HMAC
- Webhook route rejects disallowed IP
- Session status events update `whatsapp_sessions` record
- Paused/disabled message events return the fixed unavailability reply without AI work
- Unsupported non-text message events return the fixed text-only reply
- Unknown session name returns 200 (no crash)

### 4. End-to-End Smoke Test (Manual or Script)

1. Log in as an owner
2. Navigate to WhatsApp Connection page
3. Click "Provision Session" → verify QR appears
4. Click "Refresh QR" → verify new QR appears
5. Click "Disconnect" → verify status changes to disconnected
6. Visit Dashboard → verify connection widget shows correct status
7. Set workspace to "paused" via admin → verify status gate returns unavailability reply
8. Set workspace back to "active" → verify status gate passes

### 5. Webhook Smoke Test

Use `curl` to simulate a WAHA webhook:

```bash
# Compute HMAC for the body
BODY='{"event":"session.status","session":"workspace_1","payload":{"status":"WORKING"},"me":{"id":"966500000001@c.us"}}'
HMAC=$(echo -n "$BODY" | openssl dgst -sha512 -hmac "$WAHA_WEBHOOK_HMAC_SECRET" | awk '{print $2}')

curl -X POST http://localhost:3000/api/webhooks/waha \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Hmac: $HMAC" \
  -d "$BODY"
```

Expected: `200 OK` with `{"status":"ok"}`

## Spec Closure Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Build passes (`pnpm typecheck`, `pnpm lint`, `pnpm build`)
- [ ] Manual smoke test completed (provision → QR → disconnect flow)
- [ ] Webhook smoke test completed
- [ ] Dashboard widget displays correct states
- [ ] Workspace status gate blocks paused/disabled workspaces
- [ ] Handover document created at `docs/waha-workspace-status-implementation-handover.md`
