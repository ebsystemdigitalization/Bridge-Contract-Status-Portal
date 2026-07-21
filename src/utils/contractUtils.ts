import { differenceInMonths, isValid } from 'date-fns';

/**
 * Calculates the remaining months and status of a contract based on its end date.
 * @param endDateStr The contract end date in DD/MM/YYYY format.
 * @returns An object containing the remaining months and the contract status.
 */
export const calculateContractStatus = (endDateStr: string) => {
  if (!endDateStr || endDateStr === 'N/A') {
    return { remainingMonths: 0, status: 'EXPIRED' as const };
  }

  try {
    const parts = endDateStr.split('/');
    if (parts.length !== 3) {
      return { remainingMonths: 0, status: 'EXPIRED' as const };
    }

    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const y = parseInt(parts[2]);
    const end = new Date(y, m, d);

    if (!isValid(end)) {
      return { remainingMonths: 0, status: 'EXPIRED' as const };
    }

    const now = new Date();
    // Set to start of day for fair comparison
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diff = differenceInMonths(end, now);
    const remainingMonths = Math.max(0, diff);
    const status = end >= now ? 'ACTIVE' : 'EXPIRED';

    return { remainingMonths, status };
  } catch {
    return { remainingMonths: 0, status: 'EXPIRED' as const };
  }
};
