import * as XLSX from 'xlsx';
import * as officeCrypto from 'officecrypto-tool';

function logMemory(stage: string): void {
    const memory = process.memoryUsage();

    console.log(`Memory usage — ${stage}:`, {
        rssMB: Math.round(memory.rss / 1024 / 1024),
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        externalMB: Math.round(memory.external / 1024 / 1024)
    });
}

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
        } else {
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
    console.log('Starting Excel processing:', {
        encryptedFileSizeMB:
            Math.round((buffer.length / 1024 / 1024) * 100) / 100,
        passwordProvided: Boolean(password)
    });

    logMemory('before decryption');

    let excelBuffer: Buffer = buffer;

    const encrypted = officeCrypto.isEncrypted(buffer);

    if (encrypted && !password) {
        throw new Error(
            'File is password-protected. Please provide the Excel password.'
        );
    }

    if (encrypted && password) {
        try {
            console.log('Starting Excel decryption...');

            excelBuffer = await officeCrypto.decrypt(
                buffer,
                { password }
            );

            console.log('Excel decryption completed:', {
                decryptedFileSizeMB:
                    Math.round(
                        (excelBuffer.length / 1024 / 1024) * 100
                    ) / 100
            });

            logMemory('after decryption');
        } catch (error) {
            console.error('Excel decrypt error:', error);

            throw new Error(
                'Unable to decrypt Excel file. Please check the password.'
            );
        }
    } else {
        console.log(
            'Excel file is not encrypted. Decryption skipped.'
        );
    }

    let workbook: XLSX.WorkBook;

    try {
        console.log('Starting workbook parsing...');

        workbook = XLSX.read(excelBuffer, {
            type: 'buffer',

            // Uses less memory for large worksheets.
            dense: true,

            // Skip unnecessary workbook information.
            cellStyles: false,
            cellHTML: false,
            cellFormula: false,
            bookVBA: false,

            // Read only up to the application limit plus one row.
            sheetRows: 300001
        });

        console.log('Workbook parsing completed.');

        logMemory('after workbook parsing');
    } catch (error) {
        console.error('Workbook parsing error:', error);

        throw new Error(
            'Unable to parse the decrypted Excel workbook.'
        );
    }

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
        throw new Error('Excel file has no sheets.');
    }

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error(
            'The first Excel worksheet could not be read.'
        );
    }

    console.log('Starting worksheet conversion:', {
        sheetName
    });

    let rows: Record<string, unknown>[];

    try {
        rows =
            XLSX.utils.sheet_to_json<Record<string, unknown>>(
                worksheet,
                {
                    defval: '',
                    raw: true
                }
            );

        console.log('Worksheet conversion completed:', {
            rowCount: rows.length
        });

        logMemory('after worksheet conversion');
    } catch (error) {
        console.error('Worksheet conversion error:', error);

        throw new Error(
            'Unable to convert the Excel worksheet into records.'
        );
    }

    if (!rows.length) {
        throw new Error('Excel file is empty.');
    }

    if (rows.length > 300000) {
        throw new Error(
            'Excel file contains more than 300,000 records.'
        );
    }

    const contracts = rows.map(
        (row: Record<string, unknown>) => {
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
        }
    );

    console.log('Excel processing completed:', {
        contractCount: contracts.length
    });

    logMemory('after contract mapping');

    return contracts;
}