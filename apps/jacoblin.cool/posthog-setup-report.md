<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this SvelteKit project. New files were created for client-side initialization (`src/hooks.client.ts`) and a server-side PostHog singleton (`src/lib/server/posthog.ts`). The existing `src/hooks.server.ts` was updated to add a reverse proxy for PostHog (routing `/ingest/*` to PostHog servers to avoid ad blockers) and server-side error capture via `handleError`. Event tracking was added to the chat stores, auth components, and the chat stream API route. User identification via `posthog.identify()` is wired to Firebase Auth state changes, and `posthog.reset()` is called on sign-out. `svelte.config.js` was updated with `paths.relative: false` to enable session replay.

The packages `posthog-js` and `posthog-node` were added to `package.json`. Run `pnpm install` from the monorepo root to install them.

| Event                    | Description                                                               | File                                        |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------- |
| `chat_turn_started`      | Fired when a user submits a message and a chat turn begins                | `src/lib/stores/chat.svelte.ts`             |
| `chat_turn_completed`    | Fired when a chat turn finishes successfully with response metadata       | `src/lib/stores/chat.svelte.ts`             |
| `chat_turn_failed`       | Fired when a chat turn errors out before or during streaming              | `src/lib/stores/chat.svelte.ts`             |
| `response_copied`        | Fired when a user copies an assistant message to clipboard                | `src/lib/stores/chat.svelte.ts`             |
| `context_status_toggled` | Fired when the context status panel is expanded or collapsed              | `src/lib/stores/chat.svelte.ts`             |
| `prompt_chip_clicked`    | Fired when a prompt chip shortcut is selected by the user                 | `src/lib/components/chat/ChatPanel.svelte`  |
| `login_google_clicked`   | Fired when the user clicks Continue with Google in the login modal        | `src/lib/components/auth/LoginModal.svelte` |
| `login_success`          | Fired when a user successfully signs in with Google                       | `src/lib/components/auth/LoginModal.svelte` |
| `chat_turn_submitted`    | Server-side event fired when a chat request is authenticated and accepted | `src/routes/api/chat/stream/+server.ts`     |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/346546/dashboard/1370930)
- [Chat turns started vs completed](https://us.posthog.com/project/346546/insights/Os9nMFGO)
- [Login conversion funnel](https://us.posthog.com/project/346546/insights/tUQlc8IH)
- [Chat turn failures](https://us.posthog.com/project/346546/insights/38cR84CY)
- [User engagement actions](https://us.posthog.com/project/346546/insights/5HrAwClu)

**Before deploying:** run `pnpm install` from the monorepo root to install `posthog-js` and `posthog-node`.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
