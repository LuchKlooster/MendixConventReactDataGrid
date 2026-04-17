/**
 * This file was generated from ReactDataGrid.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { ComponentType, CSSProperties, ReactNode } from "react";
import { ActionValue, EditableValue, ListValue, ListActionValue, ListAttributeValue, ListExpressionValue, ListWidgetValue } from "mendix";
import { Big } from "big.js";

export type ShowContentAsEnum = "attribute" | "dynamicText" | "customContent";

export type DisplayStyleEnum = "value" | "progressBar";

export type AlignmentEnum = "auto" | "left" | "center" | "right";

export type AggregateFunctionEnum = "none" | "sum" | "count" | "average";

export interface ColumnsType {
    showContentAs: ShowContentAsEnum;
    attribute?: ListAttributeValue<string | Big | boolean | Date>;
    header: string;
    width: number;
    dynamicText?: ListExpressionValue<string>;
    content?: ListWidgetValue;
    sortable: boolean;
    resizable: boolean;
    frozen: boolean;
    groupBy: boolean;
    cellClass?: ListExpressionValue<string>;
    displayStyle: DisplayStyleEnum;
    alignment: AlignmentEnum;
    decimalPlaces: number;
    currencySymbol: string;
    dateFormat: string;
    aggregateFunction: AggregateFunctionEnum;
}

export type SummaryPositionEnum = "none" | "top" | "bottom";

export interface ColumnsPreviewType {
    showContentAs: ShowContentAsEnum;
    attribute: string;
    header: string;
    width: number | null;
    dynamicText: string;
    content: { widgetCount: number; renderer: ComponentType<{ children: ReactNode; caption?: string }> };
    sortable: boolean;
    resizable: boolean;
    frozen: boolean;
    groupBy: boolean;
    cellClass: string;
    displayStyle: DisplayStyleEnum;
    alignment: AlignmentEnum;
    decimalPlaces: number | null;
    currencySymbol: string;
    dateFormat: string;
    aggregateFunction: AggregateFunctionEnum;
}

export interface ReactDataGridContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    datasource: ListValue;
    columns: ColumnsType[];
    enableRowSelection: boolean;
    onRowSelectAction?: ListActionValue;
    onRowDeselectAction?: ListActionValue;
    enableCsvExport: boolean;
    enableExcelExport: boolean;
    enablePdfExport: boolean;
    csvFilename: string;
    toolbarWidgets?: ReactNode;
    onRowClickAction?: ListActionValue;
    emptyPlaceholder: string;
    enableMasterDetail: boolean;
    detailContent?: ListWidgetValue;
    detailHeight: number;
    configAttribute?: EditableValue<string>;
    onConfigChangeAction?: ActionValue;
    enableFilters: boolean;
    summaryPosition: SummaryPositionEnum;
    enableGroupBy: boolean;
    enableColumnChooser: boolean;
    enableColumnReorder: boolean;
    rowHeight: number;
    gridHeight: number;
}

export interface ReactDataGridPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    datasource: {} | { caption: string } | { type: string } | null;
    columns: ColumnsPreviewType[];
    enableRowSelection: boolean;
    onRowSelectAction: {} | null;
    onRowDeselectAction: {} | null;
    enableCsvExport: boolean;
    enableExcelExport: boolean;
    enablePdfExport: boolean;
    csvFilename: string;
    toolbarWidgets: { widgetCount: number; renderer: ComponentType<{ children: ReactNode; caption?: string }> };
    onRowClickAction: {} | null;
    emptyPlaceholder: string;
    enableMasterDetail: boolean;
    detailContent: { widgetCount: number; renderer: ComponentType<{ children: ReactNode; caption?: string }> };
    detailHeight: number | null;
    configAttribute: string;
    onConfigChangeAction: {} | null;
    enableFilters: boolean;
    summaryPosition: SummaryPositionEnum;
    enableGroupBy: boolean;
    enableColumnChooser: boolean;
    enableColumnReorder: boolean;
    rowHeight: number | null;
    gridHeight: number | null;
}
