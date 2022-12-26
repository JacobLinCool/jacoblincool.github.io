import { json } from "@sveltejs/kit";
import { db, initialized } from "$lib/server/blog/db";

export const prerender = true;

export async function GET() {
	await initialized;
	return json(db);
}
