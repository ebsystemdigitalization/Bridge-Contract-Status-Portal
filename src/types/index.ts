/**
 * Enum for Firestore operation types used in error tracking.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Interface for detailed Firestore error information.
 */
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

/**
 * Interface representing a customer contract record.
 */
export interface ContractData {
  id?: string;
  billingAccountNumber: string;
  msisdn: string;
  username?: string; // For Fibre accounts
  planName: string;
  productName: string;
  contractName: string;
  contractStartDate: string;
  contractEndDate: string;
  contractDuration: number;
  contractPenaltyAmount: number;
  contractStatus: 'ACTIVE' | 'EXPIRED';
  remainingMonths: number;
  segment?: string;
  updatedAt?: any;
}

/**
 * Enum for user approval status.
 */
export enum UserStatus {
  PENDING = 'Pending',
  ACTIVE = 'Active',
  REJECTED = 'Rejected',
}

/**
 * Interface for the authenticated user's profile.
 */
export interface UserProfile {
  uid: string;
  username: string;
  email?: string;
  adb2cEmail?: string; // Shadow account email for internal verification
  role: 'superadmin' | 'admin' | 'user';
  status: UserStatus;
  createdAt: any;
  lastLoginAt?: any;
}

/**
 * Interface for security audit logs.
 */
export interface AuditLog {
  id?: string;
  adminId: string;
  adminUsername: string;
  adminRole: 'superadmin' | 'admin' | 'user';
  targetUserId: string | null;
  targetUserUsername: string | null;
  action: string;
  details: string;
  timestamp: any;
}
