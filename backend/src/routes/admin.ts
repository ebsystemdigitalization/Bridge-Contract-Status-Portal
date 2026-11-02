import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';

import { firestore, isFirestoreAvailable, serverTimestamp } from '../firebaseAdmin.js';
import { requireAdmin, requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { serializeDoc } from '../utils/firestore.js';

const adminLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
const adminMutationLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
const whitelistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

type DmsWhitelistRow = Record<string, unknown>;

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

function readColumn(row: DmsWhitelistRow, names: string[]) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) {
      return row[name];
    }
  }
  return undefined;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeLoginId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return normalizeText(value).replace(/\s+/g, '');
}

function validateLoginId(loginId: string) {
  return /^\d{6,20}$/.test(loginId);
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

adminRouter.get('/dms-whitelist', requireSuperAdmin, async (_req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }

  const snapshot = await firestore.collection('dms_whitelist').limit(500).get();
  const records = snapshot.docs
    .map(doc => ({ ...serializeDoc(doc), loginId: doc.id }))
    .sort((left: any, right: any) => {
      const dealerComparison = String(left.dealerCode || '').localeCompare(String(right.dealerCode || ''));
      if (dealerComparison !== 0) return dealerComparison;
      return String(left.accessType || '').localeCompare(String(right.accessType || ''));
    });

  return res.json({ records, readCount: snapshot.size });
});

adminRouter.post(
  '/dms-whitelist/import',
  requireSuperAdmin,
  adminMutationLimiter,
  whitelistUpload.single('file'),
  async (req, res) => {
    if (!isFirestoreAvailable() || !firestore) {
      return res.status(503).json({ error: 'Firestore is not available.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Whitelist file is required.' });
    }

    const filename = req.file.originalname.toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].some(extension => filename.endsWith(extension))) {
      return res.status(400).json({ error: 'Unsupported file type. Allowed: XLSX, XLS, CSV.' });
    }

    let rows: DmsWhitelistRow[];
    try {
      const workbook = XLSX.read(req.file.buffer, {
        type: 'buffer',
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        sheetRows: 1001
      });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ error: 'The whitelist workbook has no worksheets.' });
      }

      rows = XLSX.utils.sheet_to_json<DmsWhitelistRow>(workbook.Sheets[firstSheetName], {
        defval: ''
      });
    } catch (error) {
      console.error('DMS whitelist parsing failed:', error);
      return res.status(400).json({ error: 'Unable to read the whitelist file.' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'The whitelist file contains no dealer records.' });
    }

    if (rows.length > 1000) {
      return res.status(413).json({ error: 'The whitelist file exceeds 1,000 dealer rows.' });
    }

    const whitelist = new Map<string, {
      loginId: string;
      dealerCode: string;
      dealerCompany: string;
      accessType: 'Owner' | 'Supervisor';
    }>();
    const validationErrors: string[] = [];

    rows.forEach((row, index) => {
      const excelRow = index + 2;
      const dealerCode = normalizeText(readColumn(row, ['Dealer Code', 'DMS Code', 'Dealer DMS Outlet ID'])).toUpperCase();
      const dealerCompany = normalizeText(readColumn(row, ['Dealer Company', 'Dealer Company Name', 'Company Name']));
      const ownerLoginId = normalizeLoginId(readColumn(row, ['Owner Login ID', 'Owner ID']));
      const supervisorLoginId = normalizeLoginId(readColumn(row, ['Supervisor Login ID', 'Supervisor ID', 'SV Login ID']));

      if (!dealerCode) validationErrors.push(`Row ${excelRow}: Dealer Code is required.`);
      if (!dealerCompany) validationErrors.push(`Row ${excelRow}: Dealer Company is required.`);
      if (!ownerLoginId && !supervisorLoginId) {
        validationErrors.push(`Row ${excelRow}: Owner Login ID or Supervisor Login ID is required.`);
      }

      const addLoginId = (loginId: string, accessType: 'Owner' | 'Supervisor') => {
        if (!loginId) return;
        if (!validateLoginId(loginId)) {
          validationErrors.push(`Row ${excelRow}: ${accessType} Login ID must contain 6 to 20 digits.`);
          return;
        }
        if (whitelist.has(loginId)) {
          validationErrors.push(`Row ${excelRow}: Login ID ${loginId} appears more than once.`);
          return;
        }
        whitelist.set(loginId, { loginId, dealerCode, dealerCompany, accessType });
      };

      addLoginId(ownerLoginId, 'Owner');
      addLoginId(supervisorLoginId, 'Supervisor');
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Whitelist validation failed.',
        details: validationErrors.slice(0, 25)
      });
    }

    const entries = Array.from(whitelist.values());
    for (let index = 0; index < entries.length; index += 500) {
      const batch = firestore.batch();
      for (const record of entries.slice(index, index + 500)) {
        const reference = firestore.collection('dms_whitelist').doc(record.loginId);
        batch.set(reference, {
          ...record,
          status: 'Active',
          sourceFileName: req.file.originalname,
          uploadedBy: req.user?.oid || null,
          uploadedByUsername: req.user?.name || 'N/A',
          uploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
    }

    await writeAudit(
      req,
      null,
      'DMS_WHITELIST_IMPORT',
      `Imported ${entries.length} DMS Login IDs from ${rows.length} dealer rows using file ${req.file.originalname}`
    );

    return res.json({
      dealersProcessed: rows.length,
      loginIdsProcessed: entries.length,
      ownerLoginIds: entries.filter(record => record.accessType === 'Owner').length,
      supervisorLoginIds: entries.filter(record => record.accessType === 'Supervisor').length
    });
  }
);

adminRouter.patch(
  '/dms-whitelist/:loginId/status',
  requireSuperAdmin,
  adminMutationLimiter,
  async (req, res) => {
    if (!isFirestoreAvailable() || !firestore) {
      return res.status(503).json({ error: 'Firestore is not available.' });
    }

    const loginId = normalizeLoginId(req.params.loginId);
    const status = normalizeText(req.body?.status);
    if (!validateLoginId(loginId)) {
      return res.status(400).json({ error: 'A valid DMS Login ID is required.' });
    }
    if (!['Active', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be Active or Rejected.' });
    }

    const reference = firestore.collection('dms_whitelist').doc(loginId);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      return res.status(404).json({ error: 'DMS whitelist record not found.' });
    }

    const previous = snapshot.data() as any;
    await reference.update({
      status,
      updatedBy: req.user?.oid || null,
      updatedAt: serverTimestamp()
    });

    await writeAudit(
      req,
      { uid: loginId, username: loginId },
      'DMS_WHITELIST_STATUS_CHANGE',
      `Changed DMS Login ID ${loginId} from [${previous.status}] to [${status}]`
    );

    return res.json({ record: { ...previous, loginId, status } });
  }
);

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
  const limitCount = req.query.all === 'true' ? 50000 : 50;
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
