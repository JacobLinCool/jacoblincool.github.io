import { db, initialized } from "$lib/server/blog/db";
import { expect, test } from "@playwright/test";

await initialized;

for (const post of Object.values(db.post)) {
	test(`blog post "${post.title}" (${post.slug})`, async ({ page }) => {
		await page.goto(`/blog/post/${post.slug}`);
		expect(await page.textContent("h1")).toBe(post.title);
	});
}
