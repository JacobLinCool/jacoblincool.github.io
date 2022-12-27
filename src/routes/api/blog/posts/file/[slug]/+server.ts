import { json } from "@sveltejs/kit";
import { file, initialized } from "$lib/server/blog/db";

export const prerender = true;

export async function GET({ params }: { params: { slug: string } }) {
	await initialized;
	return json({ filepath: file[params.slug] });
}
