import type { HomeApiResponse } from '$lib/types/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
    const response = await fetch('/api/home');
    if (!response.ok) {
        throw new Error(`Unable to load home payload: ${response.status}`);
    }

    const home = (await response.json()) as HomeApiResponse;

    return {
        home
    };
};
