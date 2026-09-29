import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [slug, ...titleParts] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(
        'Usage: pnpm blog:new my-post "文章標題"\nUse a lowercase, hyphen-separated URL slug.'
    );
    process.exit(1);
}
const directory = new URL('../content/blog/', import.meta.url);
const file = new URL(`${slug}.md`, directory);
const title = titleParts.join(' ') || slug.replaceAll('-', ' ');
const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());
const source = `---
title: ${JSON.stringify(title)}
description: "用一兩句話介紹這篇文章。"
date: "${date}"
draft: true
lang: zh-TW
tags: []
---

在這裡開始寫作。
`;
await mkdir(directory, { recursive: true });
try {
    await writeFile(file, source, { flag: 'wx' });
} catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.error(`Post already exists: ${fileURLToPath(file)}`);
    process.exit(1);
}
console.log(
    `Created ${fileURLToPath(file)}\nPreview: /blog/${slug}\nSet draft: false when ready to publish.`
);
