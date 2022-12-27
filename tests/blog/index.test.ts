import { db, initialized } from "$lib/server/blog/db";
import { expect, test } from "@playwright/test";

await initialized;

test("blog index", async ({ page }) => {
	await page.goto("/blog");
	expect(await page.textContent("h1")).toBe("Blog");

	const posts = await page.$$eval(".article-card", (cards) =>
		cards.map((card) => ({ title: card.querySelector("h2")?.textContent })),
	);

	const titles = Object.values(db.post).map((post) => post.title);
	for (const post of posts) {
		expect(titles).toContain(post.title);
	}
});
