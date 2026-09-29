import {
    getPublications,
    getScholarVerifiedDate,
    getStaticScholarProfile
} from '$lib/server/content/home-adapter';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
    publications: getPublications(),
    scholar: getStaticScholarProfile(),
    verifiedAt: getScholarVerifiedDate()
});
