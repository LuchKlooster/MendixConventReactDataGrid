import { ReactElement } from "react";
import { ReactDataGridPreviewProps } from "../typings/ReactDataGridProps";

export function preview(props: ReactDataGridPreviewProps): ReactElement {
    const columns = props.columns ?? [];

    return (
        <div style={{ border: "1px solid #d7d7d7", overflow: "hidden", borderRadius: 3, fontSize: 13 }}>
            {/* Header row */}
            <div style={{ display: "flex", backgroundColor: "#264ae5" }}>
                {columns.length > 0 ? (
                    columns.map((col, idx) => (
                        <div
                            key={idx}
                            style={{
                                flex: `0 0 ${col.width ?? 150}px`,
                                padding: "6px 8px",
                                fontWeight: 600,
                                color: "#fff",
                                borderRight: "1px solid rgba(255,255,255,0.2)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {col.header || "(no header)"}
                        </div>
                    ))
                ) : (
                    <div style={{ padding: "6px 8px", color: "#fff" }}>No columns configured</div>
                )}
            </div>

            {/* Placeholder rows */}
            {[1, 2, 3].map(rowIdx => (
                <div
                    key={rowIdx}
                    style={{
                        display: "flex",
                        backgroundColor: rowIdx % 2 === 0 ? "#f8f8f8" : "#ffffff",
                        borderTop: "1px solid #e8e8e8"
                    }}
                >
                    {columns.map((col, idx) => (
                        <div
                            key={idx}
                            style={{
                                flex: `0 0 ${col.width ?? 150}px`,
                                padding: "5px 8px",
                                borderRight: "1px solid #e8e8e8",
                                color: "#999",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {col.attribute ?? "—"}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export function getPreviewCss(): string {
    return require("./ui/ReactDataGrid.css");
}
