import { db, initialized } from "$lib/server/blog/db";
import { expect, test } from "@playwright/test";

await initialized;

for (const tag of Object.values(db.tag)) {
	test(`blog tag "${tag.name}" (${tag.slug})`, async ({ page }) => {
		await page.goto(`/blog/tag/${tag.slug}`);
		expect(await page.textContent("h1")).toBe(tag.name);
	});
}
