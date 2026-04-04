# Auth Login

## Purpose
Provides the customer owner login form used by the public `/login` route.

## Dependencies
- `core/auth` - session and redirect rules are enforced by the surrounding app flow

## Public API
| Export | Type | Description |
|---|---|---|
| `LoginForm` | Component | Owner login form that posts credentials to Payload auth |

## Notes
- This feature is UI-only in the foundation spec.
- Authentication is delegated to Payload's built-in `/api/users/login` endpoint.
