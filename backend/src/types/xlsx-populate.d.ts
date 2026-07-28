declare module 'xlsx-populate' {
    interface Workbook {
        outputAsync(): Promise<Buffer>;
    }

    interface XlsxPopulate {
        fromDataAsync(
            data: Buffer,
            password?: string
        ): Promise<Workbook>;
    }

    const XlsxPopulate: XlsxPopulate;

    export default XlsxPopulate;
}