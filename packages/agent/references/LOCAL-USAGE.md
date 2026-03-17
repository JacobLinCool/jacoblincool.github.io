# Local Usage

## Build

From the workspace root:

```bash
pnpm --filter @jacoblincool/agent build
```

The build writes the runtime to `scripts/`.

## CLI

List tools:

```bash
node scripts/cli.mjs list
```

Execute a tool:

```bash
node scripts/cli.mjs exec get_github_profile
node scripts/cli.mjs exec get_huggingface_model_detail --input '{"id":"JacobLinCool/some-model"}'
```

Optional environment variables:

- `GITHUB_TOKEN`
- `GITHUB_API_TOKEN`
- `GITHUB_USER`
- `HUGGINGFACE_USER`

## Package Import

```ts
import { createJacobAgentRuntime } from '@jacoblincool/agent';

const runtime = createJacobAgentRuntime({
    githubToken: process.env.GITHUB_TOKEN ?? null
});

const tools = runtime.listTools();
const result = await runtime.executeTool('get_knowledge_root', {});
```

## Notes

- `scripts/` is a build artifact and is not committed.
- The local default cache is in-memory only.
- Website-specific Firestore caching lives outside this package.
