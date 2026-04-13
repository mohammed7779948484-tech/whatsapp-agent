# Knowledge Uploads

## Purpose
Owner-facing knowledge file upload, listing, retry, and deletion UI with associated Server Actions.

## Dependencies
- `modules/knowledge` - upload orchestration, file listing, deletion, retry, and workspace knowledge summaries
- `core/auth` - owner session enforcement for dashboard surfaces

## Public API
| Export | Type | Description |
|---|---|---|
| `knowledgeUploadsConfig` | Config | Feature registry metadata |
| `KnowledgeUploadsPage` | Component | Owner dashboard page for knowledge uploads |
| `KnowledgeFileDisplayStatus` | Type | UI status union for uploaded knowledge files |
| `mapFileToDisplayStatus` | Function | Maps persisted file states to UI display status |
| `KNOWLEDGE_UPLOADS_FEATURE_ID` | Constant | Feature registry identifier |
| `KNOWLEDGE_PAGE_PATH` | Constant | Dashboard route path for knowledge uploads |

## Notes
- This feature does not query Payload directly; it delegates business logic to `modules/knowledge`.
- Upload validation happens in the Server Action before orchestration is handed to the module service.
