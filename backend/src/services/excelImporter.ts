import * as XLSX from 'xlsx';

function parseExcelDate(value) {
    if (!value || value === 'N/A') {
        return 'N/A';
    }

    try {
        let date;
        // Excel serial date
        if (!isNaN(Number(value)) && Number(value) > 10000) {
            const excelEpoch = new Date(1899, 11, 30);
            date = new Date(
                excelEpoch.getTime() + Number(value) * 86400000
            );
        } 
        // Normal date string
        else {
            date = new Date(value);
        }
        if (isNaN(date.getTime())) {
            return String(value).trim();
        }
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    } catch {
        return String(value).trim();
    }
}

export function parseExcelBuffer(buffer) {
    const workbook = XLSX.read(buffer, {
        type: 'buffer'
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error('Excel file has no sheets.');
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: ''
    });

    if (!rows.length) {
        throw new Error('Excel file is empty.');
    }

    return rows.map(row => {

        const billingAccountNumber =
            String(
                row.BILLING_ACCOUNT_NUMBER ||
                row['BILLING ACCOUNT NUMBER'] ||
                row.BILLING_ACC ||
                row.ACCOUNT_NO ||
                'N/A'
            ).trim();

        const msisdn =
            String(
                row.MSISDN ||
                row.MOBILE_NUMBER ||
                row['MOBILE NUMBER'] ||
                row.PHONE_NUMBER ||
                'N/A'
            ).trim();

        const productName =
            String(
                row.PRODUCT_NAME ||
                row.PRODUCT ||
                'N/A'
            ).trim();

        const contractName =
            String(
                row.CONTRACT_NAME ||
                row['CONTRACT NAME'] ||
                'N/A'
            ).trim();

        const planName =
            String(
                row.PLAN_NAME ||
                row.PLAN ||
                row.SUBSCRIPTION_PLAN ||
                'N/A'
            ).trim();

        const contractStartDate =
            parseExcelDate(
                row.CONTRACT_START_DATE ||
                row['CONTRACT START DATE'] ||
                row.START_DATE
            );

        const contractEndDate =
            parseExcelDate(
                row.CONTRACT_END_DATE ||
                row['CONTRACT END DATE'] ||
                row.END_DATE
            );

        const contractDuration =
            Number(
                row.CONTRACT_DURATION_IN_MONTHS ||
                row.CONTRACT_DURATION ||
                row['CONTRACT DURATION'] ||
                row.TENURE ||
                0
            );

        const contractPenaltyAmount =
            Number(
                row.CONTRACT_PENALTY_AMOUNT ||
                row.CONTRACT_PENALTY ||
                row['CONTRACT PENALTY'] ||
                row.PENALTY ||
                0
            );

        const segment =
            String(
                row.SEGMENT ||
                row.Segment ||
                row.segment ||
                'N/A'
            ).trim();

        return {
            billingAccountNumber,
            msisdn,
            productName,
            contractName,
            planName,
            contractStartDate,
            contractEndDate,
            contractDuration,
            contractPenaltyAmount,
            segment,

            // Default value.
            // Your previous frontend calculated this dynamically.
            contractStatus: 'ACTIVE',

            remainingMonths: 0
        };
    });
}