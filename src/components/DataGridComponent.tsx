import { CSSProperties, Fragment, Key, ReactElement, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataGrid, { TreeDataGrid, Column, Row, SortColumn, SelectColumn, RenderRowProps, RowHeightArgs, RenderSortStatusProps } from "react-data-grid";
import { ObjectItem, ListAttributeValue, ListActionValue, ListWidgetValue, ListExpressionValue, EditableValue, ActionValue } from "mendix";
import type { Big } from "big.js";
import { GridToolbar } from "./GridToolbar";

export type ShowContentAs = "attribute" | "dynamicText" | "customContent";

type SummaryRow = { id: string };

export interface ColumnConfig {
    columnKey: string;
    showContentAs: ShowContentAs;
    attribute?: ListAttributeValue<string | Big | Date | boolean>;
    dynamicText?: ListExpressionValue<string>;
    content?: ListWidgetValue;
    header: string;
    width: number;
    sortable: boolean;
    resizable: boolean;
    frozen: boolean;
    groupBy: boolean;
    cellClass?: ListExpressionValue<string>;
    aggregateFunction: "none" | "sum" | "count" | "average";
    displayStyle: "value" | "progressBar";
    alignment: "auto" | "left" | "center" | "right";
    decimalPlaces: number;
    currencySymbol: string;
    dateFormat: string;
}

function matchesFilter(filterValue: string, attrType: string, rawValue: unknown, displayValue: string): boolean {
    const f = filterValue.trim();
    if (!f) return true;

    if (attrType === "Boolean") {
        const cell = rawValue === true ? "true" : rawValue === false ? "false" : "";
        return cell === f;
    }

    if (attrType === "Integer" || attrType === "Long" || attrType === "Decimal" || attrType === "AutoNumber") {
        const opMatch = f.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
        if (opMatch) {
            const op = opMatch[1];
            const num = parseFloat(opMatch[2].replace(",", "."));
            const cellNum = rawValue != null ? parseFloat(String(rawValue)) : NaN;
            if (isNaN(cellNum) || isNaN(num)) return false;
            switch (op) {
                case ">":  return cellNum > num;
                case ">=": return cellNum >= num;
                case "<":  return cellNum < num;
                case "<=": return cellNum <= num;
                case "=":  return cellNum === num;
            }
        }
    }

    return displayValue.toLowerCase().includes(f.toLowerCase());
}

// Extract the stable numeric suffix from a Mendix attribute ID.
// e.g. "attr_jge_13" → "13"  (stable across browser sessions)
// Non-attribute column keys start with "__" and are already session-stable — return as-is.
// Falls back to the full id if no numeric suffix is found.
function getStableKey(columnKey: string): string {
    if (columnKey.startsWith("__")) return columnKey;
    const m = columnKey.match(/_(\d+)$/);
    return m ? m[1] : columnKey;
}

function formatAggValue(val: number, col: ColumnConfig): string {
    if (col.decimalPlaces >= 0) {
        const fixed = val.toFixed(col.decimalPlaces);
        return col.currencySymbol ? `${col.currencySymbol} ${fixed}` : fixed;
    }
    // Auto: trim trailing zeros but keep up to 4 decimal places
    const rounded = parseFloat(val.toFixed(4));
    const str = String(rounded);
    return col.currencySymbol ? `${col.currencySymbol} ${str}` : str;
}

function resolveAlignment(col: ColumnConfig): "left" | "center" | "right" {
    if (col.alignment !== "auto") return col.alignment;
    if (!col.attribute) return "left";
    const t = col.attribute.type;
    if (t === "Integer" || t === "Long" || t === "Decimal" || t === "AutoNumber") return "right";
    if (t === "Boolean") return "center";
    return "left";
}

function formatDateValue(date: Date, format: string): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const monthAbbr  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dayNames   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayAbbr    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    // Tokens ordered longest-first within each group to prevent partial matches
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

export interface DataGridComponentProps {
    rows: ObjectItem[];
    columns: ColumnConfig[];
    rowHeight: number;
    gridHeight: number;
    // Row click (non-selection click)
    onRowClickAction?: ListActionValue;
    emptyPlaceholder: string;
    className?: string;
    style?: CSSProperties;
    onSortChange?: (sortColumns: SortColumn[]) => void;
    // Row selection
    enableRowSelection: boolean;
    onRowSelectAction?: ListActionValue;
    onRowDeselectAction?: ListActionValue;
    // CSV / Excel / PDF export
    enableCsvExport: boolean;
    enableExcelExport: boolean;
    enablePdfExport: boolean;
    csvFilename: string;
    // Toolbar widgets (rendered next to Export button)
    toolbarWidgets?: ReactNode;
    // Filters
    enableFilters: boolean;
    // Group by
    enableGroupBy: boolean;
    // Column chooser
    enableColumnChooser: boolean;
    // Column reorder
    enableColumnReorder: boolean;
    // Personalization
    configAttribute?: EditableValue<string>;
    onConfigChangeAction?: ActionValue;
    // Summary row
    summaryPosition: "none" | "top" | "bottom";
    // Master / Detail
    detailContent?: ListWidgetValue;
    detailHeight: number;
}


function EmptyRowsRenderer({ message }: { message: string }): ReactElement {
    return (
        <div className="rdg-empty-placeholder">
            {message}
        </div>
    );
}

export function DataGridComponent({
    rows,
    columns,
    rowHeight,
    gridHeight,
    onRowClickAction,
    emptyPlaceholder,
    className,
    style,
    onSortChange,
    enableRowSelection,
    onRowSelectAction,
    onRowDeselectAction,
    enableCsvExport,
    enableExcelExport,
    enablePdfExport,
    csvFilename,
    toolbarWidgets,
    enableFilters,
    enableGroupBy,
    enableColumnChooser,
    enableColumnReorder,
    configAttribute,
    onConfigChangeAction,
    summaryPosition,
    detailContent,
    detailHeight
}: DataGridComponentProps): ReactElement {
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
    const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [columnOrder, setColumnOrder] = useState<readonly string[]>([]);
    const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<unknown>>(() => new Set());
    const [activeGroupBySet, setActiveGroupBySet] = useState<ReadonlySet<string>>(() => new Set<string>());
    const [expandedRowIds, setExpandedRowIds] = useState<ReadonlySet<string>>(() => new Set());
    const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(() => new Set());
    const [groupByBarVisible, setGroupByBarVisible] = useState(false);

    // Personalization: stable refs so effects don't stale-close over props
    const configAttributeRef = useRef(configAttribute);
    configAttributeRef.current = configAttribute;
    const onConfigChangeActionRef = useRef(onConfigChangeAction);
    onConfigChangeActionRef.current = onConfigChangeAction;
    const onSortChangeRef = useRef(onSortChange);
    onSortChangeRef.current = onSortChange;

    // Derive a primitive from configAttribute so React can track it as a dep.
    // undefined  = attribute not yet available (status !== "available")
    // ""         = attribute available, no value stored
    // "...json..." = attribute available with stored config
    const rawConfigValue: string | undefined =
        configAttribute?.status === "available"
            ? (configAttribute.value ?? "")
            : undefined;

    // True once the stored config has been read and applied to state.
    const configAppliedRef = useRef(false);

    // Set to true in the load effect; consumed (→ false + early-return) in the
    // save effect on the very next run.  Prevents save from overwriting the
    // just-loaded config with the initial empty state.
    const configJustLoadedRef = useRef(false);

    // Load persisted config exactly once, as soon as configAttribute is available.
    // Using rawConfigValue as the dep means React fires this effect when the
    // attribute transitions from unavailable (undefined) to available (string).
    // Only column IDs that exist in the current widget are applied so that stale
    // keys from old entity configurations don't accumulate in the saved config.
    useEffect(() => {
        if (configAppliedRef.current) return;
        if (rawConfigValue === undefined) return; // attribute not available yet

        configAppliedRef.current = true;
        configJustLoadedRef.current = true;

        if (!rawConfigValue) return; // attribute available but empty — use defaults

        try {
            const cfg = JSON.parse(rawConfigValue);

            // Build stable-key ("13") → current attribute.id ("attr_jge_13") mapping.
            // This makes config portable across browser sessions where Mendix regenerates
            // attribute IDs but keeps the numeric suffix stable.
            const stableToId = new Map<string, string>();
            for (const id of columnKeysRef.current) {
                stableToId.set(getStableKey(id), id);
            }

            // filtersVisible: independent of column IDs
            if (cfg.filtersVisible != null) setFiltersVisible(Boolean(cfg.filtersVisible));

            // filters: translate stable keys → current attribute IDs
            if (cfg.filters && typeof cfg.filters === "object") {
                const validFilters: Record<string, string> = {};
                for (const [k, v] of Object.entries(cfg.filters as Record<string, string>)) {
                    const currentId = stableToId.get(k);
                    if (currentId) validFilters[currentId] = v;
                }
                if (Object.keys(validFilters).length > 0) setFilters(validFilters);
            }

            // columnOrder: translate stable keys → current attribute IDs
            if (Array.isArray(cfg.columnOrder) && cfg.columnOrder.length > 0) {
                const validOrder = (cfg.columnOrder as string[])
                    .map(k => stableToId.get(k))
                    .filter(Boolean) as string[];
                if (validOrder.length > 0) setColumnOrder(validOrder);
            }

            // sortColumns: translate stable columnKey → current attribute ID
            if (Array.isArray(cfg.sortColumns) && cfg.sortColumns.length > 0) {
                const validSort = (cfg.sortColumns as SortColumn[])
                    .map(sc => {
                        const currentId = stableToId.get(sc.columnKey);
                        return currentId ? { ...sc, columnKey: currentId } : null;
                    })
                    .filter(Boolean) as SortColumn[];
                if (validSort.length > 0) {
                    setSortColumns(validSort);
                    try { onSortChangeRef.current?.(validSort); } catch { /* ignored */ }
                }
            }

            // groupBy: translate stable keys → current attribute IDs
            if (Array.isArray(cfg.groupBy)) {
                const validGroupBy = (cfg.groupBy as string[])
                    .map(k => stableToId.get(k))
                    .filter(Boolean) as string[];
                setActiveGroupBySet(new Set(validGroupBy));
            }

            // hiddenColumns: translate stable keys → current attribute IDs
            if (Array.isArray(cfg.hiddenColumns)) {
                const validHidden = (cfg.hiddenColumns as string[])
                    .map(k => stableToId.get(k))
                    .filter(Boolean) as string[];
                if (validHidden.length > 0) setHiddenColumns(new Set(validHidden));
            }
        } catch {
            // Invalid JSON — ignore and use defaults
        }
    }, [rawConfigValue]); // fires when attribute becomes available

    // Save config whenever relevant state changes (only after initial load).
    useEffect(() => {
        if (configJustLoadedRef.current) {
            configJustLoadedRef.current = false;
            return;
        }
        if (!configAppliedRef.current) return;
        const attr = configAttributeRef.current;
        if (!attr || attr.status !== "available") return;

        // Translate current attribute IDs → stable numeric keys before persisting,
        // so the config remains valid across sessions where Mendix regenerates IDs.
        const stableFilters: Record<string, string> = {};
        for (const [id, val] of Object.entries(filters)) {
            stableFilters[getStableKey(id)] = val;
        }
        const stableColumnOrder = (columnOrder as string[]).map(id => getStableKey(id));
        const stableSortColumns = (sortColumns as readonly SortColumn[]).map(sc => ({
            ...sc,
            columnKey: getStableKey(sc.columnKey)
        }));
        const stableGroupBy = [...(activeGroupBySet as ReadonlySet<string>)].map(id => getStableKey(id));
        const stableHiddenColumns = [...(hiddenColumns as ReadonlySet<string>)].map(id => getStableKey(id));
        const json = JSON.stringify({
            sortColumns: stableSortColumns,
            filters: stableFilters,
            filtersVisible,
            columnOrder: stableColumnOrder,
            groupBy: stableGroupBy,
            hiddenColumns: stableHiddenColumns
        });
        if (attr.value === json) return;
        try {
            attr.setValue(json);
            const action = onConfigChangeActionRef.current;
            if (action?.canExecute) action.execute();
        } catch {
            // Swallow — errors must not reach Mendix's error boundary
        }
    }, [sortColumns, filters, filtersVisible, columnOrder, activeGroupBySet, hiddenColumns]);

    const handleToggleFilters   = useCallback(() => setFiltersVisible(v => !v), []);
    const handleClearFilters    = useCallback(() => setFilters({}), []);
    const handleToggleGroupByBar = useCallback(() => setGroupByBarVisible(v => !v), []);

    const handleToggleColumnVisibility = useCallback((columnKey: string) => {
        setHiddenColumns(prev => {
            const next = new Set(prev);
            if (next.has(columnKey)) next.delete(columnKey);
            else next.add(columnKey);
            return next;
        });
    }, []);
    const hasActiveFilters = Object.values(filters).some(v => v.trim() !== "");

    // Sort
    const handleSortColumnsChange = useCallback(
        (newSortColumns: SortColumn[]) => {
            setSortColumns(newSortColumns);
            onSortChange?.(newSortColumns);
        },
        [onSortChange]
    );

    // Row selection: diff old vs new set and fire per-row actions
    const handleSelectedRowsChange = useCallback(
        (newSelectedRows: ReadonlySet<string>) => {
            if (onRowSelectAction) {
                newSelectedRows.forEach(id => {
                    if (!selectedRows.has(id)) {
                        const row = rows.find(r => r.id === id);
                        if (row) {
                            const action = onRowSelectAction.get(row);
                            if (action.canExecute) action.execute();
                        }
                    }
                });
            }
            if (onRowDeselectAction) {
                selectedRows.forEach(id => {
                    if (!newSelectedRows.has(id)) {
                        const row = rows.find(r => r.id === id);
                        if (row) {
                            const action = onRowDeselectAction.get(row);
                            if (action.canExecute) action.execute();
                        }
                    }
                });
            }
            setSelectedRows(newSelectedRows);
        },
        [rows, selectedRows, onRowSelectAction, onRowDeselectAction]
    );

    // Row click (fires for non-checkbox cells)
    const handleCellClick = useCallback(
        ({ row, column }: { row: ObjectItem; column: { key: string } }) => {
            if (column.key === "select-row") return; // checkbox column — skip
            if (onRowClickAction) {
                const action = onRowClickAction.get(row);
                if (action.canExecute) action.execute();
            }
        },
        [onRowClickAction]
    );

    // Client-side filtering (only attribute columns support filtering)
    const filteredRows = useMemo(() => {
        if (!enableFilters || !filtersVisible) return rows;
        const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== "");
        if (activeFilters.length === 0) return rows;
        return rows.filter(row =>
            activeFilters.every(([colKey, filterValue]) => {
                const col = columns.find(c => c.columnKey === colKey);
                if (!col || !col.attribute) return true;
                const val = col.attribute.get(row);
                return matchesFilter(filterValue, col.attribute.type, val.value, val.displayValue ?? "");
            })
        );
    }, [rows, filters, columns, enableFilters, filtersVisible]);

    // Summary rows — one dummy row; cells computed via closure over filteredRows
    const summaryRows: readonly SummaryRow[] = useMemo(
        () => summaryPosition !== "none" ? [{ id: "summary" }] : [],
        [summaryPosition]
    );

    // Build grid columns
    const dataColumns: Column<ObjectItem, SummaryRow>[] = columns.map(col => {
        const align = resolveAlignment(col);
        const isAttribute = col.showContentAs === "attribute" && col.attribute != null;
        const isDynamic  = col.showContentAs === "dynamicText";
        const isCustom   = col.showContentAs === "customContent";
        return {
            key: col.columnKey,
            name: col.header,
            width: col.width,
            sortable: isAttribute ? col.sortable : false,
            resizable: col.resizable,
            frozen: col.frozen,
            draggable: enableColumnReorder,
            cellClass: col.cellClass ? (row: ObjectItem) => col.cellClass!.get(row).value ?? "" : undefined,

            renderHeaderCell({ sortDirection, priority }: RenderSortStatusProps) {
                const sortIndicator = sortDirection ? (
                    <span className="rdg-sort-status" aria-hidden="true">
                        <span className="rdg-sort-status__icon">{sortDirection === "ASC" ? "▲" : "▼"}</span>
                        {priority != null && priority > 0 && (
                            <span className="rdg-sort-status__priority">{priority}</span>
                        )}
                    </span>
                ) : null;

                // Custom content columns: no filter input (can't filter widgets)
                const canFilter = isAttribute && enableFilters && filtersVisible;
                if (!canFilter) {
                    return (
                        <span className="rdg-header-label">
                            <span className={`rdg-cell-value rdg-cell-value--${align}`}>{col.header}</span>
                            {sortIndicator}
                        </span>
                    );
                }
                const filterVal = filters[col.columnKey] ?? "";
                const onChange = (val: string) =>
                    setFilters(prev => ({ ...prev, [col.columnKey]: val }));
                const stop = (e: React.SyntheticEvent) => e.stopPropagation();
                const t = col.attribute!.type;
                const isBoolean = t === "Boolean";
                const isNumeric = t === "Integer" || t === "Long" || t === "Decimal" || t === "AutoNumber";
                return (
                    <div className="rdg-header-filter-cell">
                        <span className="rdg-header-label rdg-header-filter-label">
                            <span className={`rdg-cell-value rdg-cell-value--${align}`}>{col.header}</span>
                            {sortIndicator}
                        </span>
                        {isBoolean ? (
                            <select
                                className="rdg-header-filter-input rdg-header-filter-select"
                                style={{ height: rowHeight }}
                                value={filterVal}
                                onChange={e => { onChange(e.target.value); stop(e); }}
                                onClick={stop}
                            >
                                <option value="">All</option>
                                <option value="true">✓ True</option>
                                <option value="false">✗ False</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="rdg-header-filter-input"
                                style={{ height: rowHeight }}
                                value={filterVal}
                                placeholder={isNumeric ? "=5  >10  <=20" : "Filter…"}
                                onChange={e => { onChange(e.target.value); stop(e); }}
                                onClick={stop}
                                onKeyDown={stop}
                            />
                        )}
                    </div>
                );
            },

            renderCell({ row }: { row: ObjectItem }) {
                // ── Custom content ──────────────────────────────────────────
                if (isCustom) {
                    return (
                        <div className="rdg-cell-custom-content">
                            {col.content?.get(row) as ReactNode}
                        </div>
                    );
                }

                // ── Dynamic text ─────────────────────────────────────────────
                if (isDynamic) {
                    const dynVal = col.dynamicText?.get(row);
                    return (
                        <span className={`rdg-cell-value rdg-cell-value--${align}`}>
                            {dynVal?.value ?? ""}
                        </span>
                    );
                }

                // ── Attribute ────────────────────────────────────────────────
                if (!col.attribute) return null;
                const value = col.attribute.get(row);

                // ── Progress bar ─────────────────────────────────────────────
                if (col.displayStyle === "progressBar") {
                    const isNumeric = col.attribute.type === "Decimal" || col.attribute.type === "Integer"
                        || col.attribute.type === "Long" || col.attribute.type === "AutoNumber";
                    if (isNumeric && value.value != null) {
                        const raw = parseFloat(String(value.value));
                        const pct = Math.min(100, Math.max(0, isNaN(raw) ? 0 : raw));
                        const label = col.decimalPlaces >= 0
                            ? `${(value.value as Big).toFixed(col.decimalPlaces)}%`
                            : (value.displayValue ?? `${Math.round(pct)}%`);
                        return (
                            <div className="rdg-cell-progress">
                                <div className="rdg-cell-progress__track">
                                    <div className="rdg-cell-progress__fill" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="rdg-cell-progress__label">{label}</span>
                            </div>
                        );
                    }
                }

                if (col.attribute.type === "Boolean") {
                    const checked = value.value as boolean | undefined;
                    return (
                        <div className="rdg-cell-bool-wrap">
                            <div className={`rdg-cell-bool-box${checked === true ? " rdg-cell-bool-box--checked" : ""}`} />
                        </div>
                    );
                }

                if (
                    (col.attribute.type === "Decimal" || col.attribute.type === "Integer" ||
                     col.attribute.type === "Long"    || col.attribute.type === "AutoNumber") &&
                    col.decimalPlaces >= 0 && value.value != null
                ) {
                    const formatted = (value.value as Big).toFixed(col.decimalPlaces);
                    const display = col.currencySymbol ? `${col.currencySymbol} ${formatted}` : formatted;
                    return <span className={`rdg-cell-value rdg-cell-value--${align}`}>{display}</span>;
                }

                if (col.attribute.type === "DateTime" && col.dateFormat && value.value instanceof Date) {
                    return <span className={`rdg-cell-value rdg-cell-value--${align}`}>{formatDateValue(value.value as Date, col.dateFormat)}</span>;
                }

                return <span className={`rdg-cell-value rdg-cell-value--${align}`}>{value.displayValue ?? ""}</span>;
            },

            renderSummaryCell: col.aggregateFunction === "none" ? undefined : () => {
                const fn = col.aggregateFunction;
                const isNumericAttr = isAttribute && col.attribute != null &&
                    ["Integer", "Long", "Decimal", "AutoNumber"].includes(col.attribute.type);

                if (fn === "count") {
                    return (
                        <span className={`rdg-summary-cell rdg-cell-value rdg-cell-value--right`}>
                            <span className="rdg-summary-cell__label">#</span>
                            {filteredRows.length}
                        </span>
                    );
                }

                if (!isNumericAttr) return null;

                const values = filteredRows
                    .map(r => col.attribute!.get(r).value)
                    .filter(v => v != null)
                    .map(v => parseFloat(String(v)))
                    .filter(n => !isNaN(n));

                if (fn === "sum") {
                    const sum = values.reduce((a, b) => a + b, 0);
                    return (
                        <span className={`rdg-summary-cell rdg-cell-value rdg-cell-value--right`}>
                            <span className="rdg-summary-cell__label">∑</span>
                            {formatAggValue(sum, col)}
                        </span>
                    );
                }

                if (fn === "average") {
                    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                    return (
                        <span className={`rdg-summary-cell rdg-cell-value rdg-cell-value--right`}>
                            <span className="rdg-summary-cell__label">⌀</span>
                            {formatAggValue(avg, col)}
                        </span>
                    );
                }

                return null;
            }
        };
    });

    // Stable ref holding the current column keys — updated each render so
    // handleColumnsReorder always has the latest keys without being recreated.
    const columnKeysRef = useRef<string[]>([]);
    columnKeysRef.current = columns.map(c => c.columnKey);

    // Column reordering — no dep on dataColumns so the callback is stable.
    // The effective base mirrors what orderedDataColumns renders: valid saved
    // keys first, then any current columns not in the saved list.  This ensures
    // dragging always works even when the saved columnOrder has stale or partial
    // keys (e.g. after entity changes or adding new columns to the widget).
    const handleColumnsReorder = useCallback((sourceKey: string, targetKey: string) => {
        setColumnOrder(prev => {
            const currentKeys = [...columnKeysRef.current];
            let base: string[];
            if (prev.length > 0) {
                // Keep only the saved keys that still exist, then append new ones
                const validSaved = prev.filter(k => currentKeys.includes(k));
                const extra = currentKeys.filter(k => !prev.includes(k));
                base = [...validSaved, ...extra];
            } else {
                base = currentKeys;
            }
            const from = base.indexOf(sourceKey);
            const to = base.indexOf(targetKey);
            if (from === -1 || to === -1) return prev;
            base.splice(to, 0, base.splice(from, 1)[0]);
            return base;
        });
    }, []); // stable — reads keys via ref

    // Row grouping
    // groupableColumns: attribute columns configured with groupBy=true.
    // Only attribute columns can be grouped (dynamicText/customContent cannot).
    const groupableColumns = useMemo(
        () => columns.filter(c => c.groupBy && c.showContentAs === "attribute" && c.attribute != null),
        [columns]
    );

    const handleToggleGroupBy = useCallback((key: string) => {
        setActiveGroupBySet(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    // activeGroupByKeys: ordered by original column position so the grouping
    // hierarchy (outer → inner) stays predictable.
    const activeGroupByKeys = useMemo(
        () => groupableColumns
            .filter(c => activeGroupBySet.has(c.columnKey))
            .map(c => c.columnKey),
        [groupableColumns, activeGroupBySet]
    );

    const rowGrouper = useCallback(
        (rows: readonly ObjectItem[], columnKey: string): Record<string, readonly ObjectItem[]> => {
            const col = columns.find(c => c.columnKey === columnKey);
            if (!col || !col.attribute) return {};
            const result: Record<string, ObjectItem[]> = {};
            const attr = col.attribute;
            for (const row of rows) {
                const val = attr.get(row);
                const key = val.displayValue ?? String(val.value ?? "(empty)");
                if (!result[key]) result[key] = [];
                result[key].push(row);
            }
            return result;
        },
        [columns]
    );

    const orderedDataColumns = useMemo(() => {
        if (!enableColumnReorder || columnOrder.length === 0) return dataColumns;
        const ordered = columnOrder
            .map(key => dataColumns.find(c => c.key === key))
            .filter(Boolean) as Column<ObjectItem, SummaryRow>[];
        // Include any new columns not yet in the order
        const extra = dataColumns.filter(c => !columnOrder.includes(c.key));
        return [...ordered, ...extra];
    }, [dataColumns, columnOrder, enableColumnReorder]);

    // Master / Detail
    const handleToggleExpand = useCallback((rowId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(rowId)) next.delete(rowId);
            else next.add(rowId);
            return next;
        });
    }, []);

    const expandToggleColumn: Column<ObjectItem> | null = detailContent
        ? {
            key: "__expand__",
            name: "",
            width: 35,
            minWidth: 35,
            maxWidth: 35,
            resizable: false,
            sortable: false,
            frozen: false,
            renderCell({ row }: { row: ObjectItem }) {
                const isExpanded = expandedRowIds.has(row.id);
                return (
                    <button
                        className={`rdg-expand-btn${isExpanded ? " rdg-expand-btn--open" : ""}`}
                        onClick={(e) => handleToggleExpand(row.id, e)}
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? "▼" : "▶"}
                    </button>
                );
            }
        }
        : null;

    // rowHeight: function when detail is active so expanded rows get extra space
    const computedRowHeight = useMemo(() => {
        if (!detailContent) return rowHeight;
        return (row: ObjectItem) => expandedRowIds.has(row.id) ? rowHeight + detailHeight : rowHeight;
    }, [detailContent, rowHeight, detailHeight, expandedRowIds]);

    // rowHeight for TreeDataGrid uses RowHeightArgs (ROW | GROUP)
    const computedRowHeightTree = useMemo(() => {
        if (!detailContent) return rowHeight;
        return (args: RowHeightArgs<ObjectItem>) =>
            args.type === "ROW" && expandedRowIds.has(args.row.id)
                ? rowHeight + detailHeight
                : rowHeight;
    }, [detailContent, rowHeight, detailHeight, expandedRowIds]);

    // renderRow: wrap with detail panel for expanded rows
    // Start the detail panel after the SelectColumn (if any); the expand toggle
    // column is included so the detail panel aligns visually with the master data.
    // Column order: [SelectColumn?] [expandToggle] [data...] [actions?]
    const detailGridColumnStart = enableRowSelection ? 3 : 2;

    const renderDetailRow = useCallback(
        (key: Key, props: RenderRowProps<ObjectItem>): ReactNode => {
            const isExpanded = expandedRowIds.has(props.row.id);
            if (!isExpanded || !detailContent) return <Row key={key} {...props} />;
            return (
                <Fragment key={key}>
                    {/*
                     * Pass height={rowHeight} (base) so that --rdg-row-height stays at
                     * the base height and cells render at the correct position.
                     * The grid track is rowHeight + detailHeight (from computedRowHeight),
                     * leaving detailHeight pixels of space below the Row for the panel.
                     */}
                    <Row {...props} height={rowHeight} />
                    <div
                        className="rdg-detail-panel"
                        style={{
                            gridRowStart: props.gridRowStart,
                            gridColumn: `${detailGridColumnStart} / -1`,
                            marginTop: rowHeight,
                            height: detailHeight,
                        }}
                    >
                        {detailContent.get(props.row) as ReactNode}
                    </div>
                </Fragment>
            );
        },
        [expandedRowIds, detailContent, rowHeight, detailHeight, detailGridColumnStart]
    );

    const visibleDataColumns = useMemo(
        () => orderedDataColumns.filter(c => !hiddenColumns.has(c.key)),
        [orderedDataColumns, hiddenColumns]
    );

    const gridColumns: Column<ObjectItem, SummaryRow>[] = [
        ...(enableRowSelection ? [SelectColumn as Column<ObjectItem, SummaryRow>] : []),
        ...(expandToggleColumn ? [expandToggleColumn as Column<ObjectItem, SummaryRow>] : []),
        ...visibleDataColumns
    ];

    const toolbarVisible = enableCsvExport || enableExcelExport || enablePdfExport || !!toolbarWidgets || enableFilters || enableGroupBy || enableColumnChooser;

    return (
        <div className={`widget-react-data-grid ${className ?? ""}`} style={style}>
            {enableGroupBy && groupByBarVisible && groupableColumns.length > 0 && (
                <div className="rdg-groupby-bar">
                    <span className="rdg-groupby-bar__label">Group by:</span>
                    {groupableColumns.map(col => (
                        <label key={col.columnKey} className="rdg-groupby-bar__item">
                            <input
                                type="checkbox"
                                className="rdg-groupby-bar__checkbox"
                                checked={activeGroupBySet.has(col.columnKey)}
                                onChange={() => handleToggleGroupBy(col.columnKey)}
                            />
                            {col.header}
                        </label>
                    ))}
                </div>
            )}
            {toolbarVisible && (
                <GridToolbar
                    enableCsvExport={enableCsvExport}
                    enableExcelExport={enableExcelExport}
                    enablePdfExport={enablePdfExport}
                    csvFilename={csvFilename}
                    columns={columns}
                    rows={rows}
                    selectedRows={selectedRows}
                    toolbarWidgets={toolbarWidgets}
                    enableFilters={enableFilters}
                    filtersVisible={filtersVisible}
                    hasActiveFilters={hasActiveFilters}
                    onToggleFilters={handleToggleFilters}
                    onClearFilters={handleClearFilters}
                    enableGroupBy={enableGroupBy}
                    groupByBarVisible={groupByBarVisible}
                    groupableColumnCount={groupableColumns.length}
                    activeGroupByCount={activeGroupByKeys.length}
                    onToggleGroupByBar={handleToggleGroupByBar}
                    enableColumnChooser={enableColumnChooser}
                    hiddenColumns={hiddenColumns}
                    onToggleColumnVisibility={handleToggleColumnVisibility}
                />
            )}
            {enableGroupBy && groupByBarVisible && activeGroupByKeys.length > 0 ? (
                <TreeDataGrid
                    style={{ height: gridHeight, width: "100%" }}
                    columns={gridColumns}
                    rows={filteredRows}
                    rowHeight={computedRowHeightTree}
                    headerRowHeight={enableFilters && filtersVisible ? rowHeight + 32 : undefined}
                    rowKeyGetter={(row: ObjectItem) => row.id}
                    sortColumns={sortColumns}
                    onSortColumnsChange={handleSortColumnsChange}
                    onCellClick={handleCellClick}
                    onColumnsReorder={enableColumnReorder ? handleColumnsReorder : undefined}
                    selectedRows={enableRowSelection ? selectedRows : undefined}
                    onSelectedRowsChange={enableRowSelection ? handleSelectedRowsChange : undefined}
                    groupBy={activeGroupByKeys}
                    rowGrouper={rowGrouper}
                    expandedGroupIds={expandedGroupIds}
                    onExpandedGroupIdsChange={setExpandedGroupIds}
                    topSummaryRows={summaryPosition === "top" && summaryRows.length > 0 ? summaryRows : undefined}
                    bottomSummaryRows={summaryPosition === "bottom" && summaryRows.length > 0 ? summaryRows : undefined}
                    renderers={{
                        noRowsFallback: <EmptyRowsRenderer message={emptyPlaceholder} />,
                        renderRow: detailContent ? renderDetailRow : undefined
                    }}
                />
            ) : (
                <DataGrid
                    style={{ height: gridHeight, width: "100%" }}
                    columns={gridColumns}
                    rows={filteredRows}
                    rowHeight={computedRowHeight}
                    headerRowHeight={enableFilters && filtersVisible ? rowHeight + 32 : undefined}
                    rowKeyGetter={(row: ObjectItem) => row.id}
                    sortColumns={sortColumns}
                    onSortColumnsChange={handleSortColumnsChange}
                    onCellClick={handleCellClick}
                    onColumnsReorder={enableColumnReorder ? handleColumnsReorder : undefined}
                    selectedRows={enableRowSelection ? selectedRows : undefined}
                    onSelectedRowsChange={enableRowSelection ? handleSelectedRowsChange : undefined}
                    topSummaryRows={summaryPosition === "top" && summaryRows.length > 0 ? summaryRows : undefined}
                    bottomSummaryRows={summaryPosition === "bottom" && summaryRows.length > 0 ? summaryRows : undefined}
                    renderers={{
                        noRowsFallback: <EmptyRowsRenderer message={emptyPlaceholder} />,
                        renderRow: detailContent ? renderDetailRow : undefined
                    }}
                />
            )}
        </div>
    );
}
