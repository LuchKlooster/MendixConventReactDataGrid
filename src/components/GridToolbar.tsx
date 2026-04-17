import { ReactElement, ReactNode, useEffect, useRef, useState } from "react";
import { ObjectItem } from "mendix";
import { ColumnConfig } from "./DataGridComponent";
import { exportToCsv } from "../utils/exportToCsv";
import { exportToExcel } from "../utils/exportToExcel";
import { exportToPdf } from "../utils/exportToPdf";

function formatDateValue(date: Date, format: string): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const monthAbbr  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dayNames   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayAbbr    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return format.replace(/EEEE|E|MMMM|MMM|MM|M|LLLL|LLL|LL|L|yyyy|YYYY|yy|dd|d|HH|H|hh|h|mm|m|ss|s|a/g, token => {
        switch (token) {
            case "EEEE": return dayNames[date.getDay()];
            case "E":    return dayAbbr[date.getDay()];
            case "MMMM":
            case "LLLL": return monthNames[date.getMonth()];
            case "MMM":
            case "LLL":  return monthAbbr[date.getMonth()];
            case "MM":
            case "LL":   return pad(date.getMonth() + 1);
            case "M":
            case "L":    return String(date.getMonth() + 1);
            case "yyyy":
            case "YYYY": return String(date.getFullYear());
            case "yy":   return pad(date.getFullYear() % 100);
            case "dd":   return pad(date.getDate());
            case "d":    return String(date.getDate());
            case "HH":   return pad(date.getHours());
            case "H":    return String(date.getHours());
            case "hh":   return pad(date.getHours() % 12 || 12);
            case "h":    return String(date.getHours() % 12 || 12);
            case "mm":   return pad(date.getMinutes());
            case "m":    return String(date.getMinutes());
            case "ss":   return pad(date.getSeconds());
            case "s":    return String(date.getSeconds());
            case "a":    return date.getHours() < 12 ? "AM" : "PM";
            default:     return token;
        }
    });
}

function formatNumericValue(val: unknown, col: ColumnConfig): string {
    const num = parseFloat(String(val));
    if (isNaN(num)) return String(val ?? "");
    const fixed = col.decimalPlaces >= 0 ? num.toFixed(col.decimalPlaces) : String(parseFloat(num.toFixed(4)));
    return col.currencySymbol ? `${col.currencySymbol} ${fixed}` : fixed;
}

interface GridToolbarProps {
    enableCsvExport: boolean;
    enableExcelExport: boolean;
    enablePdfExport: boolean;
    csvFilename: string;
    columns: ColumnConfig[];
    rows: ObjectItem[];
    selectedRows: ReadonlySet<string>;
    toolbarWidgets?: ReactNode;
    enableFilters: boolean;
    filtersVisible: boolean;
    hasActiveFilters: boolean;
    onToggleFilters: () => void;
    onClearFilters: () => void;
    enableGroupBy: boolean;
    groupByBarVisible: boolean;
    groupableColumnCount: number;
    activeGroupByCount: number;
    onToggleGroupByBar: () => void;
    enableColumnChooser: boolean;
    hiddenColumns: ReadonlySet<string>;
    onToggleColumnVisibility: (columnKey: string) => void;
}

export function GridToolbar({
    enableCsvExport,
    enableExcelExport,
    enablePdfExport,
    csvFilename,
    columns,
    rows,
    selectedRows,
    toolbarWidgets,
    enableFilters,
    filtersVisible,
    hasActiveFilters,
    onToggleFilters,
    onClearFilters,
    enableGroupBy,
    groupByBarVisible,
    groupableColumnCount,
    activeGroupByCount,
    onToggleGroupByBar,
    enableColumnChooser,
    hiddenColumns,
    onToggleColumnVisibility
}: GridToolbarProps): ReactElement | null {
    const [colChooserOpen, setColChooserOpen] = useState(false);
    const colChooserRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!colChooserOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (!colChooserRef.current?.contains(e.target as Node)) {
                setColChooserOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [colChooserOpen]);

    if (!enableCsvExport && !enableExcelExport && !enablePdfExport && !toolbarWidgets && !enableFilters && !enableGroupBy && !enableColumnChooser) {
        return null;
    }

    const rowsToExport =
        selectedRows.size > 0
            ? rows.filter(r => selectedRows.has(r.id))
            : rows;

    const selectionSuffix = selectedRows.size > 0 ? ` (${selectedRows.size})` : "";

    const exportColumns = columns
        .filter(col => !hiddenColumns.has(col.columnKey))
        .filter(col => col.showContentAs !== "customContent")
        .map(col => ({
        header: col.header,
        getValue: (row: unknown) => {
            if (col.showContentAs === "attribute" && col.attribute) {
                const ev = col.attribute.get(row as ObjectItem);
                const type = col.attribute.type;
                if (type === "Boolean") {
                    return ev.value === true ? "True" : ev.value === false ? "False" : "";
                }
                if (type === "DateTime" && ev.value instanceof Date && col.dateFormat) {
                    return formatDateValue(ev.value, col.dateFormat);
                }
                if ((type === "Decimal" || type === "Integer" || type === "Long" || type === "AutoNumber")
                    && ev.value != null && (col.decimalPlaces >= 0 || col.currencySymbol)) {
                    return formatNumericValue(ev.value, col);
                }
                return ev.displayValue ?? "";
            }
            if (col.showContentAs === "dynamicText" && col.dynamicText) {
                return col.dynamicText.get(row as ObjectItem).value ?? "";
            }
            return "";
        }
    }));

    const handleCsvExport = () => {
        exportToCsv(csvFilename || "export", exportColumns, rowsToExport);
    };

    const handleExcelExport = () => {
        exportToExcel(csvFilename || "export", exportColumns, rowsToExport);
    };

    const handlePdfExport = () => {
        exportToPdf(csvFilename || "export", exportColumns, rowsToExport);
    };

    const hiddenCount = hiddenColumns.size;

    return (
        <div className="rdg-toolbar">
            {toolbarWidgets}
            {enableColumnChooser && (
                <div className="rdg-col-chooser" ref={colChooserRef}>
                    <button
                        type="button"
                        className={`rdg-toolbar__btn rdg-toolbar__btn--col-chooser${colChooserOpen ? " rdg-toolbar__btn--active" : ""}`}
                        onClick={() => setColChooserOpen(v => !v)}
                        title="Show or hide columns"
                    >
                        <span className="rdg-toolbar__icon" aria-hidden="true">☰</span>
                        Columns{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
                    </button>
                    {colChooserOpen && (
                        <div className="rdg-col-chooser__panel">
                            {columns.map(col => (
                                <label key={col.columnKey} className="rdg-col-chooser__item">
                                    <input
                                        type="checkbox"
                                        checked={!hiddenColumns.has(col.columnKey)}
                                        onChange={() => onToggleColumnVisibility(col.columnKey)}
                                    />
                                    <span>{col.header || "(no header)"}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {enableGroupBy && (
                <button
                    type="button"
                    className="rdg-toolbar__btn rdg-toolbar__btn--groupby"
                    onClick={onToggleGroupByBar}
                    title={groupByBarVisible ? "Hide group by bar" : "Show group by bar"}
                    disabled={groupableColumnCount === 0}
                >
                    <span className="rdg-toolbar__icon" aria-hidden="true">⊞</span>
                    Group by{activeGroupByCount > 0 ? ` (${activeGroupByCount})` : ""}
                </button>
            )}
            {enableFilters && (
                <button
                    type="button"
                    className="rdg-toolbar__btn rdg-toolbar__btn--toggle-filters"
                    onClick={onToggleFilters}
                    title={filtersVisible ? "Hide filters" : "Show filters"}
                >
                    <span className="rdg-toolbar__icon" aria-hidden="true">⊟</span>
                    {filtersVisible ? "Hide filters" : "Show filters"}
                </button>
            )}
            {enableFilters && filtersVisible && (
                <button
                    type="button"
                    className="rdg-toolbar__btn rdg-toolbar__btn--clear-filters"
                    onClick={onClearFilters}
                    disabled={!hasActiveFilters}
                    title="Clear all filters"
                >
                    <span className="rdg-toolbar__icon" aria-hidden="true">✕</span>
                    Clear filters
                </button>
            )}
            {enableCsvExport && (
                <button
                    type="button"
                    className="rdg-toolbar__btn rdg-toolbar__btn--export-csv"
                    onClick={handleCsvExport}
                    title="Download the current data as a CSV file"
                >
                    <span className="rdg-toolbar__icon" aria-hidden="true">⬇</span>
                    {`Export CSV${selectionSuffix}`}
                </button>
            )}
            {enableExcelExport && (
                <button
                    type="button"
                    className="rdg-toolbar__btn rdg-toolbar__btn--export-excel"
                    onClick={handleExcelExport}
                    title="Download the current data as an Excel file"
                >
                    <span className="rdg-toolbar__icon" aria-hidden="true">⬇</span>
                    {`Export Excel${selectionSuffix}`}
                </button>
            )}
            {enablePdfExport && (
                <button
                    type="button"
                    className="rdg-toolbar__btn rdg-toolbar__btn--export-pdf"
                    onClick={handlePdfExport}
                    title="Download the current data as a PDF file"
                >
                    <span className="rdg-toolbar__icon" aria-hidden="true">⬇</span>
                    {`Export PDF${selectionSuffix}`}
                </button>
            )}
        </div>
    );
}
