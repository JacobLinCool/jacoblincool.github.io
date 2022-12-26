import { json } from "@sveltejs/kit";
import { file } from "$lib/server/blog/db";

export const prerender = true;

export async function GET({ params }: { params: { slug: string } }) {
	return json({ filepath: file[params.slug] });
}
