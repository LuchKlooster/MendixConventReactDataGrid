import { ReactElement, useCallback } from "react";
import { SortColumn } from "react-data-grid";
import "react-data-grid/lib/styles.css";

import { ReactDataGridContainerProps } from "../typings/ReactDataGridProps";
import { DataGridComponent } from "./components/DataGridComponent";
import "./ui/ReactDataGrid.css";

export function ReactDataGrid(props: ReactDataGridContainerProps): ReactElement {
    const {
        datasource: ds,
        columns,
        rowHeight,
        gridHeight,
        onRowClickAction,
        emptyPlaceholder,
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
        summaryPosition,
        configAttribute,
        onConfigChangeAction,
        enableMasterDetail,
        detailContent,
        detailHeight,
        class: className,
        style
    } = props;

    const rows = ds.items ?? [];

    const handleSortChange = useCallback(
        (sortColumns: SortColumn[]) => {
            if (sortColumns.length === 0) {
                ds.setSortOrder(undefined);
            } else {
                const sortInstructions = sortColumns.map(sc => {
                    const colConfig = columns.find(c => c.attribute?.id === sc.columnKey);
                    const attrId = colConfig?.attribute?.id ?? sc.columnKey;
                    const dir: "asc" | "desc" = sc.direction === "DESC" ? "desc" : "asc";
                    return [attrId, dir] as [string & { __attributeIdTag: never }, "asc" | "desc"];
                });
                ds.setSortOrder(sortInstructions);
            }
        },
        [ds, columns]
    );

    const columnConfigs = columns.map((col, idx) => ({
        columnKey: col.attribute?.id ?? `__${col.showContentAs}_${idx}`,
        showContentAs: (col.showContentAs ?? "attribute") as "attribute" | "dynamicText" | "customContent",
        attribute: col.attribute ?? undefined,
        dynamicText: col.dynamicText ?? undefined,
        content: col.content ?? undefined,
        header: col.header,
        width: col.width,
        sortable: col.sortable,
        resizable: col.resizable,
        frozen: col.frozen,
        groupBy: col.groupBy ?? false,
        cellClass: col.cellClass ?? undefined,
        aggregateFunction: (col.aggregateFunction ?? "none") as "none" | "sum" | "count" | "average",
        displayStyle: (col.displayStyle ?? "value") as "value" | "progressBar",
        alignment: (col.alignment ?? "auto") as "auto" | "left" | "center" | "right",
        decimalPlaces: col.decimalPlaces ?? -1,
        currencySymbol: col.currencySymbol ?? "",
        dateFormat: col.dateFormat ?? ""
    }));

    return (
        <DataGridComponent
            rows={rows}
            columns={columnConfigs}
            rowHeight={rowHeight}
            gridHeight={gridHeight}
            onRowClickAction={onRowClickAction}
            emptyPlaceholder={emptyPlaceholder ?? "No data"}
            className={className}
            style={style}
            onSortChange={handleSortChange}
            enableRowSelection={enableRowSelection}
            onRowSelectAction={onRowSelectAction}
            onRowDeselectAction={onRowDeselectAction}
            enableCsvExport={enableCsvExport}
            enableExcelExport={enableExcelExport}
            enablePdfExport={enablePdfExport}
            csvFilename={csvFilename ?? "export"}
            toolbarWidgets={toolbarWidgets}
            enableFilters={enableFilters}
            enableColumnReorder={enableColumnReorder}
            configAttribute={configAttribute}
            onConfigChangeAction={onConfigChangeAction}
            enableGroupBy={enableGroupBy}
            enableColumnChooser={enableColumnChooser}
            summaryPosition={summaryPosition ?? "none"}
            detailContent={enableMasterDetail ? detailContent : undefined}
            detailHeight={detailHeight ?? 200}
        />
    );
}
