import * as XLSX from "xlsx";

export interface ExcelColumn {
    header: string;
    getValue: (row: unknown) => string;
}

export function exportToExcel(filename: string, columns: ExcelColumn[], rows: unknown[]): void {
    // Build array-of-arrays: header row + data rows
    const headerRow = columns.map(c => c.header);
    const dataRows  = rows.map(row => columns.map(c => c.getValue(row)));

    const worksheetData = [headerRow, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Auto column widths based on the longest cell value
    const colWidths = columns.map((col, colIdx) => {
        const maxLen = Math.max(
            col.header.length,
            ...rows.map(row => String(columns[colIdx].getValue(row)).length)
        );
        return { wch: Math.min(maxLen + 2, 60) };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const xlsxFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, xlsxFilename);
}
