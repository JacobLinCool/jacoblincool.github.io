# jacoblin.cool

SvelteKit personal website with a shared research knowledge registry, an AI assistant, and a Markdown blog. The application uses the Cloudflare adapter.

## 新增部落格文章

在 repository 根目錄執行：

```sh
pnpm blog:new my-first-post "我的第一篇文章"
```

這會建立 `apps/jacoblin.cool/content/blog/my-first-post.md`。修改 Markdown 即可，不必註冊路由或編輯文章索引。檔名決定永久網址 `/blog/my-first-post`，修改標題不會影響網址。指令不會覆寫既有文章。

```yaml
---
title: '我的第一篇文章'
description: '顯示在文章列表與分享預覽的簡介。'
date: '2026-09-29'
draft: true
lang: zh-TW
tags: [研究, 開發]
---
```

在 front matter 後寫文章正文。日期使用 `YYYY-MM-DD`；`lang` 可選 `zh-TW` 或 `en`；`tags` 可省略。修訂文章時可加上 `updated: "2026-09-30"`。未知欄位、無效日期與缺少必要欄位會回報包含檔名的錯誤，避免拼字錯誤導致意外發布。

1. 執行 `pnpm --filter jacoblin.cool dev:site`，開啟終端機顯示的本機網址及 `/blog`。
2. 草稿會出現在開發模式列表，可點入閱讀頁預覽，並標示 Draft preview。
3. 寫完後把 `draft: true` 改為 `draft: false`。
4. 提交檔案，隨 Cloudflare 上的網站部署發布。`pnpm --filter jacoblin.cool build` 建置；`pnpm --filter jacoblin.cool preview` 可檢查正式模式。

正式模式的列表、文章路由與 RSS 都不會公開草稿。`date` 是顯示與排序日期，**不是排程發布設定**；是否公開由 `draft` 決定。Markdown 草稿仍會被提交到 Git，若 repository 為公開，請勿在其中保存機密內容。

支援標題與自動目錄、清單、引用、程式碼區塊、表格及圖片。原始 HTML 顯示為文字。圖片放在 `static/blog/my-first-post/`，以 `![圖片描述](/blog/my-first-post/example.png)` 引用。

RSS 位於 `/blog/rss.xml`，文章發布後會自動加入。初始的 `writing-a-post.md` 是排版教學草稿，正式網站會顯示尚未有文章的狀態，直到第一篇文章發布。

## Development

```sh
pnpm install --frozen-lockfile
cp apps/jacoblin.cool/.env.example apps/jacoblin.cool/.env
pnpm --filter jacoblin.cool dev:site
```

`dev:site` previews the website without starting Firebase emulators. To test authenticated chat and persistence, configure the Firebase, TypeSafe and Gemini environment variables, then run `pnpm --filter jacoblin.cool dev` for the emulator workflow. Placeholder environment values are sufficient for rendering the blog and publication pages, but do not enable live chat.

```sh
pnpm --filter jacoblin.cool check
pnpm test
pnpm lint
pnpm --filter jacoblin.cool build
```

## Chat scroll checks

Run `pnpm --filter jacoblin.cool chat:scroll` and open `http://127.0.0.1:5175/__scroll_lab`. The opt-in fixture uses the real homepage layout and chat components with synthetic messages, and blocks model requests. Its controls cover short/long histories, a single long answer with wide code and tables, context status, streaming, interrupted replies, enlarged text, and desktop/narrow/short viewports. Finish builds and type checks before opening this separate Vite server because development tooling shares generated files.

Check that the last message clears the composer at the bottom, scrolling up preserves the reading position during streaming, “Latest response” resumes following, and a new turn or viewport resize keeps the bottom visible when following. For native keyboard scrolling, open `http://127.0.0.1:5175/?__scroll_check=1&scenario=long`. Narrow iframe sizes test responsive layout; they do not emulate a real mobile software keyboard or device safe-area insets.

## Chat prompt engine

Each turn first sends one classification request to [TypeSafe System One](https://docs.typesafe.ai/api). Jev evaluates conversational scope, interaction, privacy, instruction integrity, tone, answer depth and individual knowledge relevance together, using the latest message, recent conversation and any carryover summary. Gemini then receives a composed system instruction and streams its answer. Relevant questions retain site and live tools for additional detail or current information; social turns, unrelated tasks and protected-only requests omit knowledge and tools.

Set `TYPESAFE_API_KEY` in the application's ignored `.env` for local development and in the deployment's server secrets for production. `JEV_MODEL` defaults to `jev-latest`; `GEMINI_API_KEY` and Firebase configuration are also required for live chat. None of these server credentials belong in a `PUBLIC_` variable. Jev has a six-second deadline, honors cancellation and validates the exact question IDs, choices and probability distributions. Missing credentials, timeouts and invalid responses stop the turn with an error; they do not silently select an alternate engine. Failed turns can be retried from the chat interface.

The data model lives in [`prompt-template.ts`](src/lib/server/chat/prompt-template.ts):

- An `instruction` block declares its question, named choices, the instruction for each choice, and its neutral instruction when the decision is uncertain. The six instruction blocks are listed below.
- A `knowledge` block declares an item type, a relevance question, include/catalog choices and a maximum detail count. Each matching item generates a question from its title and a bounded summary. Classifier responses cannot introduce new item IDs or arbitrary prompt text.
- `PROMPT_LIMITS` defines the shared selection and size policy, and `PROMPT_TEMPLATE_VERSION` identifies the template in telemetry. [`prompt-engine.ts`](src/lib/server/chat/prompt-engine.ts) handles classification, ranking and rendering. [`jev.ts`](src/lib/server/llm/jev.ts) owns the provider protocol and response validation.

| Block                 | Options                                                      |
| --------------------- | ------------------------------------------------------------ |
| Scope                 | `site`, `adjacent`, `social`, `off_topic`, `restricted_only` |
| Interaction           | `normal`, `critique`, `playful`, `hostile`                   |
| Privacy               | `public`, `private_requested`                                |
| Instruction integrity | `ordinary`, `override_attempt`                               |
| Tone                  | `professional`, `casual`                                     |
| Depth                 | `concise`, `detailed`                                        |

[`prompt-policy.ts`](src/lib/server/chat/prompt-policy.ts) resolves these choices into six response modes: answer, bridge, social, redirect, boundary and clarify. A standalone C++ assignment gets a brief redirect; a tiny example illustrating the paper already under discussion is allowed. Substantive criticism still gets an evidence-based answer even when rudely phrased. Gentle humor requires an invitation and is suppressed for serious criticism, privacy boundaries and abuse. The assistant represents published work without claiming to be Jacob speaking live or inventing his personality.

Scope describes the independently legitimate part of a mixed request: asking for an API key and then a real paper question preserves the paper answer while declining the secret request. Quoted prompt-injection examples in a research discussion are not active overrides. These classifications guide conversational behavior; unconditional prompt boundaries still apply, and server credentials are never injected into the prompt. Public tools remain available only for relevant questions. Other modes receive a 256-token output ceiling and no tool declarations; the runtime rejects any unexpected function call before execution. Uncertain scope asks a neutral clarification instead of assigning blame or guessing a task.

The classifier sees a bounded public title/topic catalog so that scope decisions reflect Jacob's actual work. Factual answers distinguish verified item summaries from complete papers: a general method description does not establish an experimental safeguard or a result. Criticism requires evidence for the exact challenged property; when that evidence is unavailable, the response should say so rather than invent a defense. Dynamic behavior instructions follow the knowledge data to keep the current turn's response requirements prominent.

To add a behavior, add an instruction block with its options and rendered instructions. To preload another kind of content, add a knowledge block matching that registry item type. Update the template version, add a focused case to [`prompt-engine.test.ts`](src/lib/server/chat/prompt-engine.test.ts), and check the resulting prompt budget. Questions and their behavior stay together; adding a block does not require another model request.

Both the selected probability and reported confidence must be at least 0.6, with a probability margin of at least 0.15 over the runner-up. Uncertain style choices use the block's explicit neutral instruction. During relevant turns, uncertain content remains in the title catalog. Relevant items are ranked by inclusion probability, with stable ID ordering for ties, then limited to three papers, one profile, one research direction and two projects, with six detailed items total. Every item remains discoverable by title in those turns; unselected papers contribute no summaries or details to the answer model. The assistant can retrieve those details through `get_knowledge_item`. Other response modes omit both the title catalog and details regardless of relevance votes.

The classifier receives at most six recent messages of 1,000 characters each, 2,400 characters of carryover, an 8,000-character query, and 64 catalog items. Each preloaded detail is bounded to 3,000 serialized characters; truncation is marked and full details remain available through tools. Oversized queries, indexes and catalogs are rejected explicitly. Conversation data is quoted separately from instructions. Selection telemetry records the template version, choices, probabilities, confidence, selected IDs, usage and latency, without logging raw queries or credentials. TypeSafe does receive the bounded conversation input described in the site's privacy policy.

Run the focused engine and provider checks with:

```sh
pnpm --filter jacoblin.cool exec vitest run src/lib/server/chat/prompt-engine.test.ts src/lib/server/llm/jev.test.ts
```

The opt-in semantic evaluation makes real Jev requests using local credentials and incurs provider usage. Its maintained scenarios cover criticism, profanity, invited jokes, mixed requests, private/public contact, attempted classification overrides and changes of topic or tone. It checks classification and routing, not the generated answer wording:

```sh
pnpm --filter jacoblin.cool chat:evaluate
pnpm --filter jacoblin.cool chat:evaluate --list
pnpm --filter jacoblin.cool chat:evaluate --case discussing-prompt-injection
```

## Publications

Publication data lives in `packages/agent/assets/knowledge.items.json`; categories live in `knowledge.graph.json`, and home-page/chat bindings in `site-ui.json`. The home page shows five recent papers, and `/publications` lists the complete collection by year. Both views and the assistant use the same registry.

The September 29, 2026 snapshot includes all 11 records from [Google Scholar](https://scholar.google.com/citations?user=BdzYgY0AAAAJ), with titles and authors checked against publisher/arXiv pages linked in each record. Scholar citation counts are a dated snapshot, not a live integration. [Balance of Benchmarks](https://arxiv.org/abs/2608.30044) uses the revised v3 title and author list; [session-level SLA](https://ieeexplore.ieee.org/document/11461430/) is listed under its ICASSP 2026 publication year.
