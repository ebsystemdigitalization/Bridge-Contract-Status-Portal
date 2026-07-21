import { Router } from 'express';
import { firestore, isFirestoreAvailable, serverTimestamp } from '../firebaseAdmin.js';
import { requireAdmin, requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { serializeDoc } from '../utils/firestore.js';

const adminLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
const adminMutationLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

function validateAdminStatusPayload(payload: any) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'payload must be an object.' };
  }

  if (typeof payload.uid !== 'string' || !payload.uid.trim()) {
    return { error: 'uid must be a non-empty string.' };
  }

  if (typeof payload.status !== 'string' || !['Active', 'Pending', 'Rejected'].includes(payload.status)) {
    return { error: 'status must be one of Active, Pending, or Rejected.' };
  }

  return null;
}

function validateAdminRolePayload(payload: any) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'payload must be an object.' };
  }

  if (typeof payload.uid !== 'string' || !payload.uid.trim()) {
    return { error: 'uid must be a non-empty string.' };
  }

  if (typeof payload.role !== 'string' || !['admin', 'user'].includes(payload.role)) {
    return { error: 'role must be either admin or user.' };
  }

  return null;
}

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin, adminLimiter);

adminRouter.get('/users', async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  let query: FirebaseFirestore.Query = firestore.collection('users').limit(100);
  if (req.user?.role !== 'superadmin') {
    query = firestore.collection('users').where('role', 'in', ['admin', 'user']).limit(100);
  }

  const snapshot = await query.get();
  return res.json({
    users: snapshot.docs.map(doc => ({ ...serializeDoc(doc), uid: doc.id })),
    readCount: snapshot.size
  });
});

adminRouter.patch('/users/status', adminMutationLimiter, async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const validationError = validateAdminStatusPayload(req.body);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  const { uid, status } = req.body as { uid: string; status: string };
  if (uid === req.user?.oid) return res.status(400).json({ error: 'You cannot modify your own status.' });

  const targetRef = firestore.collection('users').doc(uid);
  const target = await targetRef.get();
  if (!target.exists) return res.status(404).json({ error: 'User not found.' });

  const targetUser = target.data() as any;
  if (targetUser.role === 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only Superadmins can modify Admin status.' });
  }
  if (targetUser.role === 'superadmin') {
    return res.status(403).json({ error: 'Superadmin status cannot be modified.' });
  }

  await targetRef.update({ status });
  await writeAudit(req, targetUser, 'STATUS_CHANGE', `STATUS UPDATE: Changed from [${targetUser.status}] to [${status}]`);
  return res.json({ user: { ...targetUser, uid, status } });
});

adminRouter.patch('/users/role', requireSuperAdmin, adminMutationLimiter, async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const validationError = validateAdminRolePayload(req.body);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  const { uid, role } = req.body as { uid: string; role: string };
  if (uid === req.user?.oid) return res.status(400).json({ error: 'You cannot modify your own role.' });

  const targetRef = firestore.collection('users').doc(uid);
  const target = await targetRef.get();
  if (!target.exists) return res.status(404).json({ error: 'User not found.' });

  const targetUser = target.data() as any;
  if (targetUser.role === 'superadmin') {
    return res.status(403).json({ error: 'Superadmin roles cannot be modified.' });
  }

  await targetRef.update({ role });
  await writeAudit(req, targetUser, 'ROLE_CHANGE', `ROLE ESCALATION: Updated from [${targetUser.role}] to [${role}]`);
  return res.json({ user: { ...targetUser, uid, role } });
});

adminRouter.delete('/users/:uid', adminMutationLimiter, async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const uid = req.params.uid;
  if (uid === req.user?.oid) return res.status(400).json({ error: 'You cannot delete yourself.' });

  const targetRef = firestore.collection('users').doc(uid);
  const target = await targetRef.get();
  if (!target.exists) return res.status(404).json({ error: 'User not found.' });

  const targetUser = target.data() as any;
  if (targetUser.role === 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only Superadmins can delete Admins.' });
  }
  if (targetUser.role === 'superadmin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only Superadmins can manage other Superadmins.' });
  }

  await targetRef.delete();
  await writeAudit(req, targetUser, 'USER_DELETE', 'Permanently deleted user database record');
  return res.status(204).send();
});

adminRouter.get('/audit-logs', async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  let query: FirebaseFirestore.Query = firestore.collection('audit_logs').orderBy('timestamp', 'desc').limit(20);
  if (req.user?.role !== 'superadmin') {
    query = firestore.collection('audit_logs').where('adminRole', 'in', ['admin', 'user']).orderBy('timestamp', 'desc').limit(20);
  }

  const snapshot = await query.get();
  return res.json({ logs: snapshot.docs.map(serializeDoc), readCount: snapshot.size });
});

adminRouter.get('/search-logs', async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const limitCount = req.query.all === 'true' ? 5000 : 50;
  const snapshot = await firestore.collection('search_logs').orderBy('timestamp', 'desc').limit(limitCount).get();
  return res.json({ logs: snapshot.docs.map(serializeDoc), readCount: snapshot.size });
});

async function writeAudit(req: Express.Request, targetUser: any, action: string, details: string) {
  if (!isFirestoreAvailable() || !firestore) {
    return;
  }

  await firestore.collection('audit_logs').add({
    adminId: req.user?.oid,
    adminUsername: req.user?.name || 'N/A',
    adminRole: req.user?.role,
    targetUserId: targetUser?.uid || null,
    targetUserUsername: targetUser?.username || null,
    action,
    details,
    timestamp: serverTimestamp()
  });
}
