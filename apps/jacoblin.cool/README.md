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

`dev:site` previews the website without starting Firebase emulators. To test authenticated chat and persistence, configure the Firebase and Gemini environment variables, then run `pnpm --filter jacoblin.cool dev` for the emulator workflow. Placeholder environment values are sufficient for rendering the blog and publication pages, but do not enable live chat.

```sh
pnpm --filter jacoblin.cool check
pnpm test
pnpm lint
pnpm --filter jacoblin.cool build
```

## Publications

Publication data lives in `packages/agent/assets/knowledge.items.json`; categories live in `knowledge.graph.json`, and home-page/chat bindings in `site-ui.json`. The home page shows five recent papers, and `/publications` lists the complete collection by year. Both views and the assistant use the same registry.

The September 29, 2026 snapshot includes all 11 records from [Google Scholar](https://scholar.google.com/citations?user=BdzYgY0AAAAJ), with titles and authors checked against publisher/arXiv pages linked in each record. Scholar citation counts are a dated snapshot, not a live integration. [Balance of Benchmarks](https://arxiv.org/abs/2608.30044) uses the revised v3 title and author list; [session-level SLA](https://ieeexplore.ieee.org/document/11461430/) is listed under its ICASSP 2026 publication year.
