import { requireFirebaseUser } from '$lib/server/auth/verify-firebase-token';

export const requireOwner = async (
    request: Request,
    firestoreProjectId: string,
    ownerUid: string | null
) => {
    if (!ownerUid) {
        throw new Error('OWNER_UID is not configured on this deployment.');
    }

    const user = await requireFirebaseUser(request, firestoreProjectId);
    if (user.uid !== ownerUid) {
        throw new Error('Forbidden: owner-only endpoint.');
    }

    return user;
};
