# WhatsApp Connection

## Purpose
Provides the owner-facing WhatsApp session management UI for provisioning a WAHA session,
viewing its connection state, and disconnecting the workspace number.

## Dependencies
- `modules/whatsapp` - session provisioning, lookup, and disconnect logic

## Public API
| Export | Type | Description |
|---|---|---|
| `WhatsAppConnectionPage` | Component | Main dashboard page for WhatsApp session management |
| `WhatsAppDashboardSummary` | Component | Small summary view of the workspace connection state |
| `whatsappConnectionConfig` | Config | Feature registry metadata |

## Notes
- The feature never queries Payload directly; all session work is delegated to `modules/whatsapp`.
- QR refresh is wired through `refresh-whatsapp-qr.action.ts` and the QR card client state flow.
