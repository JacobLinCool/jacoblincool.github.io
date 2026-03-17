# Tool Catalog

This package exposes 9 Jacob-specific tools.

## Site Knowledge

- `get_knowledge_root`
    - Reads the published top-level knowledge collections and item counts.
    - Use this first when the caller asks a broad question about Jacob.
- `get_knowledge_node`
    - Reads one knowledge category by id, including child categories and immediate child items.
    - Use this when the caller wants a focused section such as research or publications.
- `get_knowledge_item`
    - Reads one full knowledge item by id.
    - Use this when the caller wants the actual details for one project, paper, or profile item.

## GitHub

- `get_github_profile`
    - Returns the cached GitHub profile summary for JacobLinCool.
- `get_github_repositories`
    - Returns the cached repository catalog, with optional `language`, `query`, `limit`, and `includeArchived` filters.
- `get_github_repo_detail`
    - Returns a cached repository detail, addressed by `projectId` or `repoFullName`.

## Hugging Face

- `get_huggingface_profile`
    - Returns the cached Hugging Face profile summary for JacobLinCool.
- `get_huggingface_model_detail`
    - Returns a cached Hugging Face model detail by `id`.
- `get_huggingface_space_detail`
    - Returns a cached Hugging Face Space detail by `id`.

## Result Shape

All tools return the same outer envelope:

```json
{
    "tool": "site",
    "target": "knowledge root",
    "label": "Reading knowledge root",
    "refs": ["node:research"],
    "payload": {
        "ok": true
    },
    "revision": "optional-live-revision"
}
```

`payload.ok === false` indicates a tool-level error boundary that should be surfaced directly instead of guessed around.
