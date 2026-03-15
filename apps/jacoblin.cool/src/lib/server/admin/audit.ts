import { type Firestore } from 'fires2rest';

export const writeAdminAudit = async (
    db: Firestore,
    actorUid: string,
    action: string,
    target: string,
    meta: Record<string, unknown> = {}
) => {
    const now = new Date().toISOString();
    await db.collection('admin_audit').add({
        actorUid,
        action,
        target,
        meta,
        createdAt: now
    });
};
