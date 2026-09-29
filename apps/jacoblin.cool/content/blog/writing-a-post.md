---
title: '開始寫一篇文章'
description: '部落格的本機草稿範例：文字、程式碼、圖片與表格。'
date: '2026-09-29'
draft: true
lang: zh-TW
tags: [寫作]
---

這是一篇用來預覽排版的草稿，正式網站不會顯示。你可以修改它，或用 `pnpm blog:new my-first-post "我的第一篇文章"` 建立自己的文章。

## 從一個想法開始

直接用 Markdown 寫作。可以放入 **粗體**、_斜體_、[連結](https://jacoblin.cool)，也可以用清單整理想法：

- 最近遇到的研究問題
- 實作過程中的發現
- 一件值得記錄的小事

> 一篇文章可以很短。先把想法留下來，再慢慢延伸。

## 加入程式碼

```typescript
const idea = 'Something worth sharing';
console.log(idea);
```

圖片放在 `static/blog/文章名稱/`，再以 `![圖片描述](/blog/文章名稱/image.png)` 引用。替圖片寫清楚的描述，讀者比較容易理解內容。

| 欄位          | 用途                      |
| ------------- | ------------------------- |
| `title`       | 文章標題                  |
| `description` | 列表與分享時的簡介        |
| `date`        | 發布日期                  |
| `draft`       | 設為 `false` 後隨部署公開 |

## 準備發布

完成內容後，修改最上方的標題、簡介與日期，並把 `draft: true` 改為 `draft: false`。將檔案提交到 Git，隨網站下一次部署發布。

網址由檔名決定，修改標題不會改變網址。完整操作方式請見專案 README。
