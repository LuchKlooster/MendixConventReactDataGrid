/**
 * Exports a dataset to a CSV file and triggers a browser download.
 *
 * NOTE: Only the rows currently loaded in the datasource are exported.
 * If paging is active, configure the datasource in Studio Pro to load
 * all rows before exporting (set page size to a high limit, or disable paging).
 */
export interface CsvColumn {
    header: string;
    getValue: (row: unknown) => string;
}

function escapeCsvCell(value: string): string {
    // Wrap in quotes if value contains comma, newline or double-quote
    if (value.includes(",") || value.includes("\n") || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export function exportToCsv(filename: string, columns: CsvColumn[], rows: unknown[]): void {
    const headerRow = columns.map(c => escapeCsvCell(c.header)).join(",");

    const dataRows = rows.map(row =>
        columns.map(c => escapeCsvCell(c.getValue(row))).join(",")
    );

    const csvContent = [headerRow, ...dataRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
