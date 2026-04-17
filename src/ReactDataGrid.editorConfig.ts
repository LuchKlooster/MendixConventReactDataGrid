import { ReactDataGridPreviewProps } from "../typings/ReactDataGridProps";

export type Platform = "web" | "desktop";
export type Properties = PropertyGroup[];

type PropertyGroup = {
    caption: string;
    propertyGroups?: PropertyGroup[];
    properties?: Property[];
};

type Property = {
    key: string;
    caption: string;
    description?: string;
    objectHeaders?: string[];
    objects?: ObjectProperties[];
    properties?: Properties[];
};

type ObjectProperties = {
    properties: PropertyGroup[];
    captions?: string[];
};

export type Problem = {
    property?: string;
    severity?: "error" | "warning" | "deprecation";
    message: string;
    studioMessage?: string;
    url?: string;
    studioUrl?: string;
};

type BaseProps = {
    type: "Image" | "Container" | "RowLayout" | "Text" | "DropZone" | "Selectable" | "Datasource";
    grow?: number;
};

type TextProps = BaseProps & {
    type: "Text";
    content: string;
    fontSize?: number;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
};

type ContainerProps = BaseProps & {
    type: "Container" | "RowLayout";
    children: PreviewProps[];
    borders?: boolean;
    borderRadius?: number;
    backgroundColor?: string;
    borderWidth?: number;
    padding?: number;
};

type DropZoneProps = BaseProps & {
    type: "DropZone";
    property: object;
    placeholder?: string;
};

type DatasourceProps = BaseProps & {
    type: "Datasource";
    property: object | null;
    child?: PreviewProps;
};

export type PreviewProps = TextProps | ContainerProps | DropZoneProps | DatasourceProps;

export function getProperties(
    values: ReactDataGridPreviewProps,
    defaultProperties: Properties
): Properties {
    updateColumnsProperties(defaultProperties, values);
    return defaultProperties;
}

function updateColumnsProperties(groups: Properties, values: ReactDataGridPreviewProps): void {
    for (const group of groups) {
        if (group.propertyGroups) {
            updateColumnsProperties(group.propertyGroups, values);
        }
        if (!group.properties) continue;
        for (const prop of group.properties) {
            if (prop.key !== "columns") continue;

            // Object headers shown in Studio Pro's columns list table
            prop.objectHeaders = ["Header", "Content", "Width (px)", "Alignment"];

            if (!prop.objects) continue;
            prop.objects.forEach((obj, idx) => {
                const col = values.columns[idx];
                if (!col) return;

                // Hide/show sub-properties based on showContentAs
                const isAttr    = col.showContentAs === "attribute"    || !col.showContentAs;
                const isDynamic = col.showContentAs === "dynamicText";
                const isCustom  = col.showContentAs === "customContent";

                // Show only the relevant content property; hide the others
                hidePropertiesIn(obj.properties, isAttr    ? [] : ["attribute"]);
                hidePropertiesIn(obj.properties, isDynamic ? [] : ["dynamicText"]);
                hidePropertiesIn(obj.properties, isCustom  ? [] : ["content"]);

                // Sortable and Editable only make sense for attribute columns
                if (!isAttr) {
                    hidePropertiesIn(obj.properties, ["sortable", "groupBy",
                        "displayStyle", "decimalPlaces", "currencySymbol", "dateFormat"]);
                }


                // Summary row caption
                const contentLabel = isAttr
                    ? (col.attribute || "[No attribute]")
                    : isDynamic
                        ? (col.dynamicText || "Dynamic text")
                        : "Custom content";
                const widthLabel = col.width != null ? String(col.width) : "150";
                const alignLabel = col.alignment
                    ? col.alignment.charAt(0).toUpperCase() + col.alignment.slice(1)
                    : "Auto";

                obj.captions = [
                    col.header || "[No header]",
                    contentLabel,
                    widthLabel,
                    alignLabel
                ];
            });
        }
    }
}

/** Remove listed property keys from nested property groups. */
function hidePropertiesIn(groups: Properties | undefined, keys: string[]): void {
    if (!groups || keys.length === 0) return;
    for (const group of groups) {
        if (group.properties) {
            group.properties = group.properties.filter(p => !keys.includes(p.key));
        }
        if (group.propertyGroups) {
            hidePropertiesIn(group.propertyGroups, keys);
        }
    }
}

export function check(values: ReactDataGridPreviewProps): Problem[] {
    const errors: Problem[] = [];

    if (values.columns.length === 0) {
        errors.push({
            property: "columns",
            severity: "error",
            message: "At least one column must be configured."
        });
    }

    values.columns.forEach((col, idx) => {
        if (!col.header || col.header.trim() === "") {
            errors.push({
                property: `columns/${idx}/header`,
                severity: "warning",
                message: `Column ${idx + 1} has no header text.`
            });
        }
        if (col.width != null && col.width < 10) {
            errors.push({
                property: `columns/${idx}/width`,
                severity: "warning",
                message: `Column ${idx + 1}: width should be at least 10 px.`
            });
        }
    });

    if (values.rowHeight != null && values.rowHeight < 20) {
        errors.push({
            property: "rowHeight",
            severity: "warning",
            message: "Row height should be at least 20 px."
        });
    }

    return errors;
}

export function getPreview(values: ReactDataGridPreviewProps): PreviewProps {
    const headers: PreviewProps[] = values.columns.map(col => ({
        type: "Container" as const,
        children: [
            {
                type: "Text" as const,
                content: col.header || "(no header)",
                bold: true,
                fontColor: "#ffffff"
            }
        ],
        backgroundColor: "#264ae5",
        padding: 6,
        grow: 1,
        borders: false
    }));

    // Custom-content drop zones shown below the header row (one per column)
    const customContentDropZones: PreviewProps[] = values.columns
        .filter(col => col.showContentAs === "customContent" && col.content)
        .map(col => ({
            type: "DropZone" as const,
            property: col.content,
            placeholder: `Custom content: ${col.header || "(no header)"}`
        } as PreviewProps));

    const headerRow: PreviewProps = {
        type: "RowLayout",
        children: headers.length > 0 ? headers : [{ type: "Text", content: "No columns configured" }],
        borders: true,
        borderWidth: 1,
        backgroundColor: "#264ae5"
    };

    // Toolbar: Export button placeholder + optional toolbar dropzone
    const toolbarChildren: PreviewProps[] = [];
    if (values.toolbarWidgets) {
        toolbarChildren.push({
            type: "DropZone" as const,
            property: values.toolbarWidgets,
            placeholder: "Toolbar widgets (e.g. Import button)"
        });
    }
    if (values.enableCsvExport) {
        toolbarChildren.push({
            type: "Container" as const,
            children: [{ type: "Text" as const, content: "⬇ Export CSV", fontColor: "#264ae5" }],
            borders: true,
            borderWidth: 1,
            borderRadius: 4,
            padding: 4
        });
    }

    const children: PreviewProps[] = [];
    if (toolbarChildren.length > 0) {
        children.push({
            type: "RowLayout",
            children: toolbarChildren,
            padding: 4
        } as PreviewProps);
    }

    children.push({
        type: "Datasource",
        property: values.datasource ?? null,
        child: {
            type: "Container",
            borders: true,
            borderWidth: 1,
            children: [
                headerRow,
                // Custom content drop zones (one per customContent column)
                ...customContentDropZones,
                // Master / Detail dropzone shown when enabled
                ...(values.enableMasterDetail && values.detailContent
                    ? [{
                        type: "DropZone" as const,
                        property: values.detailContent,
                        placeholder: "Detail content — drop widgets here (e.g. nested Data Grid via association)"
                    } as PreviewProps]
                    : [])
            ]
        }
    });

    return {
        type: "Container",
        children,
        borders: false
    };
}

export function getCustomCaption(values: ReactDataGridPreviewProps): string {
    const count = values.columns.length;
    return `React Data Grid (${count} column${count !== 1 ? "s" : ""})`;
}
