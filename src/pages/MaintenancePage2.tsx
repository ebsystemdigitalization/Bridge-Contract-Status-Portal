import * as XLSX from 'xlsx';

function parseExcelDate(dateVal) {

    if (!dateVal || dateVal === 'N/A') {
        return 'N/A';
    }

    try {
        let date;
        // Excel serial date
        if (!isNaN(Number(dateVal)) && Number(dateVal) > 10000) {
            const excelEpoch = new Date(1899, 11, 30);
            date = new Date(
                excelEpoch.getTime() +
                Number(dateVal) * 86400000
            );
        }

        // String date
        else {
            const parts = String(dateVal).split(/[/.-]/);
            if (parts.length === 3) {
                const d = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                const y = parts[2].length === 2
                    ? 2000 + parseInt(parts[2])
                    : parseInt(parts[2]);
                date = new Date(y, m, d);
            } else {
                date = new Date(dateVal);
            }
        }
        if (!isNaN(date.getTime())) {
            const d = date.getDate();
            const m = date.getMonth() + 1;
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        }
        return String(dateVal).trim();
    } catch {
        return String(dateVal).trim();
    }
}

function calculateContractStatus(endDate) {
    if (!endDate || endDate === 'N/A') {
        return {
            status: 'EXPIRED',
            remainingMonths: 0
        };
    }
    const parts = endDate.split('/');
    if (parts.length !== 3) {
        return {
            status: 'EXPIRED',
            remainingMonths: 0
        };
    }
    const end = new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0])
    );
    const today = new Date();

    if (end < today) {
        return {
            status: 'EXPIRED',
            remainingMonths: 0
        };
    }

    const months =
        (end.getFullYear() - today.getFullYear()) * 12 +
        (end.getMonth() - today.getMonth());

    return {
        status: 'ACTIVE',
        remainingMonths: Math.max(months, 0)
    };
}

export function parseExcelBuffer(buffer) {
    const workbook = XLSX.read(buffer, {
        type: 'buffer'
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(
        worksheet,
        {
            defval: ''
        }
    );

    if (!rows.length) {
        throw new Error(
            'Excel file is empty.'
        );
    }

    return rows.map(row => {
        const billingAccountNumber =
            String(
                row.BILLING_ACCOUNT_NUMBER ||
                row['BILLING ACCOUNT NUMBER'] ||
                ''
            ).trim();

        const msisdn =
            String(
                row.MSISDN ||
                row.MOBILE_NUMBER ||
                row['MOBILE NUMBER'] ||
                ''
            ).trim();

        const productName =
            String(
                row.PRODUCT_NAME ||
                row.PRODUCT ||
                ''
            ).trim();

        const contractName =
            String(
                row.CONTRACT_NAME ||
                ''
            ).trim();

        const planName =
            String(
                row.PLAN_NAME ||
                row.PLAN ||
                ''
            ).trim();

        const startDate =
            parseExcelDate(
                row.CONTRACT_START_DATE ||
                row['CONTRACT START DATE'] ||
                ''
            );

        const endDate =
            parseExcelDate(
                row.CONTRACT_END_DATE ||
                row['CONTRACT END DATE'] ||
                ''
            );

        const duration =
            Number(
                row.CONTRACT_DURATION_IN_MONTHS ||
                row.CONTRACT_DURATION ||
                0
            );

        const penalty =
            Number(
                row.CONTRACT_PENALTY_AMOUNT ||
                row.CONTRACT_PENALTY ||
                0
            );

        const segment =
            String(
                row.SEGMENT ||
                ''
            ).trim();

        const {
            status,
            remainingMonths
        } = calculateContractStatus(endDate);

        return {
            billingAccountNumber,
            msisdn,
            productName,
            contractName,
            planName,
            contractStartDate: startDate,
            contractEndDate: endDate,
            contractDuration: duration,
            contractPenaltyAmount: penalty,
            segment,
            contractStatus: status,
            remainingMonths
        };
    });
}