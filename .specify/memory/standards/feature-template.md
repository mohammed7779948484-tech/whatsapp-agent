# Feature Template

> Use this template when creating a **new feature** in the `src/features/` directory.
> A feature is a self-contained business unit with its own UI, actions, and logic.
> Features MUST NOT own DB schema or query Payload directly — delegate to modules.

---

## Pre-Creation Checklist

- [ ] Feature name is kebab-case (e.g., `order-tracking`, `product-reviews`)
- [ ] Is this truly a feature? (Has UI? → YES = Feature. Pure logic used by 2+ features? → Module instead)
- [ ] No duplicate logic exists in another feature
- [ ] Dependencies identified (which modules does this feature call?)
- [ ] Constitution Article VI §4 confirmed: no direct DB access, no payload/collections imports

---

## Folder Structure

```
src/features/[feature-name]/
├── README.md              # REQUIRED — Purpose, dependencies, public API
├── feature.config.ts      # REQUIRED — Feature metadata
├── index.ts               # REQUIRED — Public API exports ONLY
├── ui/
│   ├── [MainComponent].tsx        # PascalCase for .tsx files
│   └── _components/               # Private components (NOT exported)
│       └── [SubComponent].tsx
├── actions/
│   └── [verb-noun].action.ts      # e.g., add-to-cart.action.ts
├── logic/
│   ├── use-[feature].ts           # Zustand store (UI state ONLY)
│   └── [feature].service.ts       # Feature-level orchestration (calls modules)
├── types.ts               # REQUIRED — Feature-specific types/interfaces
├── constants.ts           # REQUIRED — Feature constants (UPPER_SNAKE_CASE)
└── tests/
    ├── unit/
    └── integration/
```

> **No `db/` folder in features.** Schema belongs in `src/payload/collections/`.
> Queries and mutations belong in the module that owns the domain.

---

## Required Files

### 1. `feature.config.ts`

```typescript
import type { FeatureConfig } from '@/features/_registry/types'

export const [featureName]Config: FeatureConfig = {
  id: '[feature-name]',
  name: '[Feature Display Name]',
  description: '[Brief description of what this feature does]',
  dependencies: [], // e.g., ['modules/catalog', 'modules/orders']
}
```

### 2. `index.ts` (Public API)

```typescript
// Public UI components
export { MainComponent } from './ui/MainComponent'

// Public hooks/stores (if any)
export { useFeatureName } from './logic/use-[feature]'

// Public types
export type { FeatureType } from './types'

// NEVER export _components — they are private
// NEVER export actions — they are called directly by the app layer
```

### 3. `README.md`

```markdown
# [Feature Name]

## Purpose
[One paragraph describing what this feature does]

## Dependencies
- `modules/[x]` — [why]

## Public API
| Export | Type | Description |
|---|---|---|
| `MainComponent` | Component | [description] |
| `useFeatureName` | Hook | [description] |

## Notes
- [Any important implementation notes]
```

### 4. `types.ts`

```typescript
// Feature-specific types and interfaces
// Use 'interface' for expandable object shapes
// Use 'type' for unions, primitives, intersections

export interface FeatureItem {
  id: string
  // ...
}

export type FeatureStatus = 'active' | 'inactive'
```

### 5. `constants.ts`

```typescript
// Feature constants — UPPER_SNAKE_CASE
export const MAX_ITEMS = 10
export const FEATURE_CACHE_TTL = 60 * 5 // 5 minutes
```

---

## Server Action Template

```typescript
// actions/[verb-noun].action.ts
'use server'

import { z } from 'zod'
import { Logger } from '@/core/logger'
import { AppError } from '@/core/errors/app-error'
import { verifySession } from '@/core/auth/dal'
import { SomeService } from '@/modules/[module-name]'
import type { ActionResult } from '@/shared/types/common'

const inputSchema = z.object({
  // Define Zod schema here
})

export async function verbNounAction(input: unknown): Promise<ActionResult> {
  const logger = new Logger()

  try {
    // 1. Verify session via DAL (MANDATORY)
    const session = await verifySession()
    if (!session) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }
    }

    // 2. Validate input with Zod
    const data = inputSchema.parse(input)

    // 3. Call module service for business logic (NO inline DB logic in actions)
    //    Pass tenantId from session — modules enforce tenant isolation
    const service = new SomeService()
    const result = await service.doSomething({
      ...data,
      tenantId: session.tenantId, // MANDATORY for tenant-owned data
    })

    // 4. Return structured result
    return { success: true, data: result }

  } catch (error) {
    logger.error(error as Error, '[verb-noun] action failed')

    if (error instanceof AppError) {
      return { success: false, error: error.message, code: error.code }
    }

    return { success: false, error: 'An unexpected error occurred', code: 'UNKNOWN_ERROR' }
  }
}
```

> **Tenant rule**: Any operation against tenant-owned data (workspaces, agents, knowledge
> files, conversations, messages, etc.) MUST pass `tenantId` from the verified session.
> Never derive or trust tenantId from client input.

---

## Import Rules Reminder

```typescript
// ✅ ALLOWED imports for features
import { SomeService } from '@/modules/[module-name]'  // Modules (via index.ts)
import { Logger } from '@/core/logger'                  // Core
import { Button } from '@/shared/ui/button'             // Shared UI
import { formatUSD } from '@/shared/lib/format'         // Shared lib
import type { Product } from '@/payload-types'          // Generated Payload types

// ❌ FORBIDDEN imports for features
import { X } from '@/features/other-feature'            // Other features
import { Y } from '@/app/some-page'                     // App layer
import { Z } from '@/widgets/header'                    // Widgets
import { W } from '@/payload/collections/x'             // Payload collections
import { V } from '@/payload/hooks/x'                   // Payload hooks
// Never call getPayloadClient() inside a feature — delegate to a module
```

---

## Registration (MANDATORY)

After creating the feature, register it in `features/_registry/index.ts`:

```typescript
import { newFeatureConfig } from '../[feature-name]/feature.config'

export const FEATURES = {
  // ... existing features
  '[feature-name]': newFeatureConfig,
} as const
```

---

## Final Checklist

- [ ] All files use **kebab-case** (except `.tsx` components → PascalCase)
- [ ] `feature.config.ts`, `index.ts`, `types.ts`, `constants.ts`, `README.md` all created
- [ ] **No `db/` folder** — schema in `src/payload/collections/`, DB access in modules
- [ ] Public API in `index.ts` — no deep imports
- [ ] Server actions have: Zod validation + try-catch + module calls + logger
- [ ] **`tenantId` from session** passed to all module calls touching tenant-owned data
- [ ] **Session verified** via DAL in every action — never trust client input for identity
- [ ] Registered in `_registry/index.ts`
- [ ] No cross-feature imports
- [ ] No direct Payload/DB imports in this feature
- [ ] Tests cover: happy path + **unauthorized access** + **wrong tenant** scenarios (Article XV)
