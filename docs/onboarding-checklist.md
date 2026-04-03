# Customer Onboarding Checklist

Use this checklist when onboarding a new customer manually through Payload Admin.

## Before you start

- Confirm the application is running and `http://localhost:3000/admin` is reachable.
- Sign in with an admin account.
- Confirm you have the customer's workspace name, slug, and owner email ready.

## 1. Create the workspace

1. Open `Workspaces` in the Payload Admin sidebar.
2. Select `Create New`.
3. Fill in:
   - `Name` - the customer-facing workspace name
   - `Slug` - lowercase kebab-case identifier
   - `Status` - leave as `Active` unless explicitly pausing access
4. Save the workspace.

## 2. Create the owner account

1. Open `Users` in the Payload Admin sidebar.
2. Select `Create New`.
3. Fill in:
   - `Email` - customer owner login email
   - `New Password` and `Confirm Password`
   - `Role` - set to `Owner`
4. In `Workspace Access`, add exactly one workspace row.
5. Select the workspace created in step 1.
6. Save the user.

## 3. Verify the assignment

- Confirm the saved user record shows exactly one workspace under `Workspace Access`.
- Confirm the workspace exists in the tenant selector for admin users.
- Confirm no second workspace can be assigned to the owner account.

## 4. Hand off to the customer

- Share the login URL: `http://localhost:3000/login`
- Share the temporary password securely.
- Ask the customer to confirm they can reach `/dashboard` after login.

## 5. Final verification

- `GET /api/health` returns `200` with `status: "ok"`.
- `GET /api/health/ready` returns `200` with `status: "ready"`.
- Owner login succeeds and the dashboard shows the expected workspace.
