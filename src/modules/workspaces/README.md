# Workspaces Module

## Purpose
Encapsulates workspace status gate logic and owner-scoped workspace lookup for trusted
webhook/job flows and owner-facing dashboard flows.

## Consumers

| Feature/Layer | Usage |
|---|---|
| `app/api/webhooks/waha` | Workspace status gate for inbound WhatsApp events |
| `features/whatsapp-connection` | Owner-scoped workspace lookup where needed |
| `app/api/jobs/process-inbound-message` | Future reuse of status gate in deferred processing |

## Public API

| Export | Type | Description |
|---|---|---|
| `WorkspacesService` | Class | Workspace status gate and owner workspace lookup |
| `WorkspaceGateResult` | Type | Result union returned by the status gate |
| `isActiveWorkspace` | Function | Simple workspace status validator |

## Dependencies
- `shared/lib` - locale detection and fixed system replies
- `shared/types` - locale and workspace status types
- `core/errors` - typed domain errors
- `core/logger` - operational logging

## Notes
- Locale chain for fixed replies is: `agent.language_preference` -> `localeFromText(inboundText)` -> Arabic default.
- Do not duplicate locale resolution in callers; use `resolveReplyLocale(...)` from the service.
- `checkStatusGate(...)` is intended for trusted webhook/job paths and intentionally uses `overrideAccess: true` for workspace/agent reads.
