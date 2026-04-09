# Contract: WhatsApp Connection Server Actions

**Feature**: `whatsapp-connection`  
**Location**: `src/features/whatsapp-connection/actions/`

---

## `provision-whatsapp-session.action.ts`

**Input**: None (workspace resolved from authenticated owner session)

**Behavior**:
1. Verify owner session → resolve workspace ID
2. Check if a `whatsapp_sessions` record already exists for this workspace
3. If a local record exists and status is not `error`, verify the remote WAHA session still exists. If the remote session is missing, treat the local record as stale and continue to re-provision
4. If exists and status is `error` → delete WAHA session, delete local record, proceed to re-provision
5. Call WAHA `POST /api/sessions` with `name: workspace_${workspaceId}` and webhook config
6. Persist a `whatsapp_sessions` record with `provider_status: 'disconnected'` through a trusted server-side service method after the owner session/workspace is verified
7. Fetch initial QR via `GET /api/{session}/auth/qr?format=image` with `Accept: application/json`
8. Store only the returned base64 image `data` in `qr_code` and set `provider_status: 'qr_pending'`

**Output** (ActionResult):
```ts
{ success: true, data: { sessionId, providerStatus, qrCode } }
| { success: false, error: string }
```

---

## `refresh-whatsapp-qr.action.ts`

**Input**: None (workspace resolved from authenticated owner session)

**Behavior**:
1. Verify owner session → resolve workspace ID
2. Load existing `whatsapp_sessions` record for workspace
3. If no session exists → return error
4. Call WAHA `GET /api/{session}/auth/qr?format=image` with `Accept: application/json`
5. Persist the returned base64 image `data` field into `qr_code` through a trusted server-side service method for the verified workspace session

**Output** (ActionResult):
```ts
{ success: true, data: { qrCode } }
| { success: false, error: string }
```

---

## `disconnect-whatsapp-session.action.ts`

**Input**: None (workspace resolved from authenticated owner session)

**Behavior**:
1. Verify owner session → resolve workspace ID
2. Load existing `whatsapp_sessions` record for workspace
3. If no session exists → return error
4. Call WAHA `DELETE /api/sessions/{session}`
5. Persist `provider_status = 'disconnected'`, clear `connected_phone`, and clear `qr_code` through a trusted server-side service method for the verified workspace session

**Output** (ActionResult):
```ts
{ success: true }
| { success: false, error: string }
```

---

## Common Rules

- All actions use `ActionResult<T>` from `src/shared/types/action-result.ts`
- All actions call `getOwnerDashboardSession()` and use the returned `{ user, workspaceId }` from the verified owner session. The current helper redirects to `/login` on failure instead of returning `null`, so action code should not implement a dead `if (!session)` branch unless the helper is changed first.
- Owner-facing reads of `whatsapp_sessions` use authenticated user context and `overrideAccess: false`. Direct owner CRUD on the `whatsapp_sessions` collection remains closed. Create/update/delete persistence for WhatsApp Connection actions is performed only by narrowly scoped server-side service methods after the owner session and workspace are verified, so raw collection writes are not exposed through direct owner API access.
- WAHA provider client errors are caught and returned as user-friendly messages (no stack traces or secrets)
- 10-second timeout enforced on all WAHA API calls
