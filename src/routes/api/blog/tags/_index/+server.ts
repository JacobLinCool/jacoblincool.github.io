import { json } from "@sveltejs/kit";
import { db } from "$lib/server/blog/db";

export const prerender = true;

export async function GET() {
	return json(Object.values(db.tag));
}
