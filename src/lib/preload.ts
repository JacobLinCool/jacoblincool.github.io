import { preloadData } from "$app/navigation";

const preloaded = new Set();

export function preload(links: string[], after = 100) {
	setTimeout(async () => {
		console.log("already preloaded", preloaded);
		const filtered = links.filter((link) => !preloaded.has(link));
		filtered.forEach((link) => preloaded.add(link));
		try {
			await Promise.all(filtered.map((link) => preloadData(link)));
			console.log("preloaded", filtered);
		} catch (err) {
			console.error("preload error", err);
		}
	}, after);
}
