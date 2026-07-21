import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

function serializeValue(value: any): any {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }
  return value;
}

export function serializeDoc<T = any>(doc: QueryDocumentSnapshot): T {
  return {
    id: doc.id,
    ...serializeValue(doc.data())
  } as T;
}
