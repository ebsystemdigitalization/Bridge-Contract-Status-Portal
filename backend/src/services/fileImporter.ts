import * as XLSX from 'xlsx';
import * as officeCrypto from 'officecrypto-tool';

function parseExcelDate(value: unknown): string {
    if (!value || value === 'N/A') {
        return 'N/A';
    }
    try {
        let date: Date;
        // Excel serial date
        if (!isNaN(Number(value)) && Number(value) > 10000) {
            const excelEpoch = new Date(1899, 11, 30);

            date = new Date(
                excelEpoch.getTime() + Number(value) * 86400000
            );
        } 
        else {
            date = new Date(String(value));
        }

        if (isNaN(date.getTime())) {
            return String(value).trim();
        }
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    } catch {
        return String(value).trim();
    }
}

function calculateContractStatus(contractEndDate: string) {
    if (!contractEndDate || contractEndDate === 'N/A') {
        return {
            status: 'ACTIVE',
            remainingMonths: 0
        };
    }

    try {
        const [day, month, year] = contractEndDate
            .split('/')
            .map(Number);
        const endDate = new Date(
            year,
            month - 1,
            day
        );
        const today = new Date();

        if (endDate < today) {
            return {
                status: 'EXPIRED',
                remainingMonths: 0
            };
        }

        const diffMonths =
            (endDate.getFullYear() - today.getFullYear()) * 12 +
            (endDate.getMonth() - today.getMonth());

        return {
            status: 'ACTIVE',
            remainingMonths: Math.max(diffMonths, 0)
        };
    } catch {
        return {
            status: 'ACTIVE',
            remainingMonths: 0
        };
    }
}

export async function parseExcelBuffer(
    buffer: Buffer,
    password?: string
) {
    let excelBuffer = buffer;
    if (password) {
        try {
            const encrypted =
                officeCrypto.isEncrypted(buffer);
            if (encrypted) {
                excelBuffer = await officeCrypto.decrypt( buffer, { password } );
            } else {
                console.log(
                    "Excel file is not encrypted. Password ignored."
                );
            }
        } catch(error) {
            console.error(
                "Excel decrypt error:",
                error
            );
            throw new Error(
                'Invalid Excel password.'
            );
        }
    }

    const workbook = XLSX.read(excelBuffer, {
        type: 'buffer'
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error('Excel file has no sheets.');
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows =
        XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: ''
        });

    if (!rows.length) {
        throw new Error('Excel file is empty.');
    }
    return rows.map((row: Record<string, unknown>) => {
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

        const {
            status,
            remainingMonths
        } = calculateContractStatus(contractEndDate);

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
            contractStatus: status,
            remainingMonths
        };
    });
}