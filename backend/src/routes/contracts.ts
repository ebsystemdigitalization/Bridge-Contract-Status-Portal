import { Router } from 'express';
import { firestore, isFirestoreAvailable, serverTimestamp, writeBatch } from '../firebaseAdmin.js';
import { requireAdmin, requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { serializeDoc } from '../utils/firestore.js';
import multer from 'multer';
import { parseExcelBuffer } from '../services/fileImporter.js';

export function validateContractPayload(contract: any) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return false;
  }

  const requiredFields = ['billingAccountNumber', 'msisdn', 'contractStatus', 'planName', 'productName'];
  if (!requiredFields.every(field => typeof contract[field] === 'string' && contract[field].trim())) {
    return false;
  }

  if (!['ACTIVE', 'EXPIRED'].includes(contract.contractStatus)) {
    return false;
  }

  if (typeof contract.segment !== 'undefined' && (typeof contract.segment !== 'string' || contract.segment.length > 100)) {
    return false;
  }

  return true;
}

export function buildContractDocId(contract: any) {
  const base = [
    contract.msisdn,
    contract.billingAccountNumber,
    contract.productName,
    contract.contractName,
    contract.contractStartDate,
    contract.contractEndDate,
    contract.contractDuration,
    contract.contractPenaltyAmount,
    contract.segment
  ].filter(value => value !== undefined && value !== null).map(value => String(value)).join('_');

  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
}

const importLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
const purgeLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 });
const searchLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
export const contractsRouter = Router();

contractsRouter.post( '/search', requireAuth, searchLimiter, async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const { searchBy, searchTerm } = req.body || {};
  const normalizedTerm = String(searchTerm || '').trim();

  if (!normalizedTerm) {
    return res.status(400).json({ error: 'searchTerm is required.' });
  }

  const field = searchBy === 'billingAccountNumber' ? 'billingAccountNumber' : 'msisdn';
  const snapshot = await firestore
    .collection('contracts')
    .where(field, '==', normalizedTerm)
    .limit(5)
    .get();

  let results = snapshot.docs.map(doc => serializeDoc(doc));
  if (searchBy === 'msisdn') {
    results = results.filter((item: any) => !String(item.msisdn || '').includes('@'));
  } else if (searchBy === 'username') {
    results = results.filter((item: any) => String(item.msisdn || '').includes('@'));
  }

  if (results.length > 0) {
    await firestore.collection('search_logs').add({
      userId: req.user?.oid,
      username: req.user?.name || 'N/A',
      email: req.user?.email || '',
      searchBy,
      searchTerm: normalizedTerm,
      resultsCount: results.length,
      timestamp: serverTimestamp()
    });
  }

  return res.json({ results, queryCount: 1, readCount: snapshot.size });
});

contractsRouter.post( '/import', requireAuth, requireAdmin, importLimiter, upload.single('file'), async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  if (!req.file) {
      return res.status(400).json({
          error: 'Upload file is required.'
      });
  }

  const allowedExtensions = [ '.xlsx', '.xls', '.csv', '.zip' ];
  const filename = req.file.originalname.toLowerCase();

  if (!allowedExtensions.some(ext => filename.endsWith(ext))) {
      return res.status(400).json({
          error: 'Unsupported file type. Allowed: XLSX, XLS, CSV, ZIP.'
      });
  }  

  const password = req.body.password 
      ? String(req.body.password)
      : undefined;

  console.log("File:", req.file.originalname);
  console.log("Password provided:", !!password);

  let contracts;
  try {
      contracts = await parseExcelBuffer( req.file.buffer, password );
  }
  catch(error) {
      console.error("IMPORT ERROR:", error);
      return res.status(400).json({
          error: 'Unable to read Excel file.',
          details: error instanceof Error ? error.message : String(error)
      });
  }
  if (!contracts.length) {
      return res.status(400).json({
          error: 'Excel file contains no records.'
      });
  }
  if (contracts.length > 300000) {
    return res.status(413).json({ error: 'Import payload is too large.' });
  }
  if (contracts.some((item: any) => !item || typeof item !== 'object' || Array.isArray(item))) {
    return res.status(400).json({ error: 'Each contract entry must be an object.' });
  }

  if (contracts.some((item: any) => !validateContractPayload(item))) {
    return res.status(400).json({ error: 'Each contract entry failed validation.' });
  }

  const unique = new Map<string, any>();
  for (const contract of contracts) {
    const docId = buildContractDocId(contract);
    if (!docId) {
      return res.status(400).json({ error: 'Each contract entry must produce a valid document id.' });
    }

    unique.set(docId, {
      ...contract,
      updatedAt: serverTimestamp()
    });
  }

  const entries = Array.from(unique.entries());
  for (let i = 0; i < entries.length; i += 500) {
    const batch = writeBatch();
    for (const [docId, contract] of entries.slice(i, i + 500)) {
      batch.set(firestore.collection('contracts').doc(docId), contract);
    }
    await batch.commit();
  }

  await firestore.collection('audit_logs').add({
    adminId: req.user?.oid,
    adminUsername: req.user?.name || 'N/A',
    adminRole: req.user?.role,
    targetUserId: null,
    targetUserUsername: null,
    action: 'BULK_UPLOAD',
    details: `Processed ${contracts.length} rows. Unique: ${entries.length}, Merged Dupes: ${contracts.length - entries.length}`,
    timestamp: serverTimestamp()
  });

  return res.json({
    totalRows: contracts.length,
    totalUnique: entries.length,
    duplicatesMerged: contracts.length - entries.length
  });
});

contractsRouter.delete('/purge', requireAuth, requireSuperAdmin, purgeLimiter, async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  if (req.body?.confirm !== true || req.body?.confirmToken !== 'PURGE_CONTRACTS') {
    return res.status(400).json({ error: 'Confirmation required. Send {"confirm": true, "confirmToken": "PURGE_CONTRACTS"}.' });
  }
  let deletedCount = 0;
  let hasMore = true;

  while (hasMore) {
    const snapshot = await firestore.collection('contracts').limit(500).get();
    if (snapshot.empty) break;

    const batch = writeBatch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += snapshot.size;
    hasMore = snapshot.size === 500;
  }

  await firestore.collection('audit_logs').add({
    adminId: req.user?.oid,
    adminUsername: req.user?.name || 'N/A',
    adminRole: req.user?.role,
    targetUserId: null,
    targetUserUsername: null,
    action: 'DATABASE_PURGE',
    details: `Permanently deleted ${deletedCount} contract records.`,
    timestamp: serverTimestamp()
  });

  return res.json({ deletedCount });
});
