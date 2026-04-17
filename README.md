# React Data Grid — Mendix Pluggable Widget

![ConventSystems](https://github.com/LuchKlooster/MendixConventReactDataGrid/blob/main/docs/images/CS64x64.png)............![React Data Grid](https://github.com/LuchKlooster/MendixConventReactDataGrid/blob/main/docs/images/ReactDataGrid.png)


A high-performance data grid widget for Mendix, built on [react-data-grid](https://github.com/adazzle/react-data-grid). Supports large datasets, multi-column sorting, client-side filtering, row grouping, export to CSV / Excel / PDF, master/detail panels, and per-user personalization.

**Author:** Luch Klooster — Convent Systems  
**Version:** 1.0.0  
**Platform:** Mendix Web (pluggable widget, offline-capable)  
**Category:** Data containers

---

## Features at a glance

| Feature | Description |
|---|---|
| Columns | Attribute, dynamic text, or custom content (widgets) per column |
| Sorting | Multi-column server-side sorting (click/ctrl-click column header)|
| Filtering | Per-column client-side header filters with operator support |
| Row selection | Multi-select with checkboxes and row-level actions |
| Export | CSV, Excel (.xlsx) and PDF download |
| Summary row | Sum, count, or average aggregates per numeric column |
| Group by | Collapse rows into expandable groups on one or more columns |
| Column chooser | Show/hide individual columns at runtime |
| Column reordering | Drag-and-drop column reordering |
| Master / detail | Expandable detail panel per row (e.g. nested grid) |
| Personalization | Persist sort, filter, column order and visibility per user |
| Cell highlighting | Built-in CSS classes for colour-coded cells |
| Progress bar | Render numeric 0–100 values as a horizontal bar |
| Toolbar | Drop zone for custom widgets (e.g. import button) |

---

## Installation

1. Copy `conventsystems.ReactDataGrid.mpk` into the `widgets/` folder of your Mendix project.
2. In Studio Pro: **App** → **Synchronize App Directory** (F4).
3. Drag the **React Data Grid** widget from the toolbox onto a page.

---

## Configuration

### General — Data source

| Property | Required | Description |
|---|---|---|
| Data source | Yes | The list datasource that provides the rows |

### General — Columns

Add one entry per column. Each column has two property groups:

#### Column

| Property | Default | Description |
|---|---|---|
| Show | Attribute | How to display cell content: **Attribute**, **Dynamic text**, or **Custom content** |
| Attribute | — | The entity attribute to display (String, Integer, Long, Decimal, Boolean, DateTime, Enum, AutoNumber) |
| Header | — | Column header text |
| Width (px) | 150 | Initial column width |
| Dynamic text | — | Text template evaluated per row (active when Show = Dynamic text) |
| Custom content | — | Widget(s) rendered per row, e.g. a button or image (active when Show = Custom content) |
| Sortable | false | Enable multi-column server-side sorting on this column |
| Resizable | true | Let users drag the column edge to resize |
| Freeze column | false | Pin this column to the left so it stays visible while scrolling horizontally |
| Group by | false | Use this column as a grouping level (see [Group by](#group-by)) |

#### Formatting (attribute columns only)

| Property | Default | Description |
|---|---|---|
| Cell class | — | Expression returning a CSS class name per row (see [Cell highlighting](#cell-highlighting)) |
| Display style | Value | **Value** = plain text. **Progress bar** = horizontal bar for numeric 0–100 values |
| Alignment | Auto | Auto = right for numbers, center for boolean, left otherwise |
| Decimal places | -1 | Fixed decimal places for numeric values; -1 uses the Mendix default format |
| Currency symbol | — | Prefix symbol (e.g. `€`, `$`, `£`). Only applied when Decimal places ≥ 0 |
| Date format | — | Mendix date pattern, e.g. `dd-MM-yyyy`, `dd-MM-yyyy HH:mm`, `EEEE d MMMM yyyy`. Empty = Mendix default |
| Aggregate | None | Summary row aggregate: **Sum**, **Count**, or **Average** (see [Summary row](#summary-row)) |

---

### Row Selection

| Property | Default | Description |
|---|---|---|
| Enable row selection | false | Show checkboxes for multi-row selection |
| On row selected | — | Action executed in the context of a row when it is added to the selection |
| On row deselected | — | Action executed in the context of a row when it is removed from the selection |

---

### Export

| Property | Default | Description |
|---|---|---|
| Enable CSV export | false | Show an **Export CSV** button in the toolbar |
| Enable Excel export | false | Show an **Export Excel** button in the toolbar (downloads `.xlsx`) |
| Enable PDF export | false | Show an **Export PDF** button in the toolbar (downloads `.pdf`) |
| Export filename | `export` | Filename without extension used for all export formats |

Export respects the current filter state — only rows visible in the grid are exported. Column headers are included in all formats.

---

### Toolbar

| Property | Description |
|---|---|
| Toolbar widgets | Additional widgets rendered next to the export buttons (e.g. an import button or a search field) |

---

### Behavior

| Property | Default | Description |
|---|---|---|
| On row click | — | Action executed when the user clicks a data row (not triggered by the checkbox column) |
| Empty placeholder | `No data` | Text shown when the data source returns zero rows |

---

### Master / Detail

| Property | Default | Description |
|---|---|---|
| Enable master / detail | false | Show an expand toggle (▶) on each row |
| Detail content | — | Widget(s) rendered in the collapsible panel below the row (e.g. a nested Data Grid scoped via an association) |
| Detail panel height (px) | 200 | Height of the expanded panel |

Configure the detail content by selecting it in the Studio Pro structure panel below the widget. Each detail panel is rendered in the context of its parent row's object, so associations and derived datasources work naturally.

---

### Personalization

| Property | Description |
|---|---|
| Configuration attribute | Unlimited String attribute to persist the user's filter values, sort order, column order, and visible columns. Wrap the widget in a Data view to supply the attribute. |
| On configuration change | Action executed after the attribute is updated (typically a Commit action) |

When a configuration attribute is linked, user preferences survive page refreshes and browser restarts. Settings are stored as JSON; the attribute should be **Unlimited** length.

---

### Filtering

| Property | Default | Description |
|---|---|---|
| Enable header filters | false | Show a filter input row inside each column header |

Filtering is client-side and instantaneous. Supported syntax per column type:

| Attribute type | Examples |
|---|---|
| String / Enum / DateTime | Substring match (case-insensitive): `smith`, `2024` |
| Integer / Long / Decimal / AutoNumber | Exact: `42` — Operators: `>100`, `<=50`, `>=0`, `<10`, `=5` |
| Boolean | `true` or `false` |

---

### Summary row

| Property | Default | Description |
|---|---|---|
| Summary position | None | **Top** or **Bottom** — adds a sticky summary row to the grid |

Configure the aggregate function per column in **Columns → Formatting → Aggregate**:

- **Sum (∑)** — numeric attribute columns only
- **Count (#)** — any column type; counts visible rows
- **Average (⌀)** — numeric attribute columns only

Summary values update automatically when header filters are active.

---

### Appearance

| Property | Default | Description |
|---|---|---|
| Enable group by | false | Show a **Group by** toolbar button and group-by bar |
| Enable column chooser | false | Show a **Columns** toolbar button for show/hide per column |
| Enable column reordering | false | Allow drag-and-drop reordering of column headers |
| Row height (px) | 35 | Height of each data row |
| Grid height (px) | 400 | Total height of the grid container |

---

## Group by

1. Set **Enable group by** to `true` in the Appearance section.
2. On each column that should be available as a grouping level, set **Group by** to `true`.
3. At runtime, click the **Group by** button in the toolbar to open the group-by bar.
4. Toggle columns on or off in the bar to add/remove grouping levels.
5. Multiple active levels create nested groups; the nesting order follows the column order in the widget configuration.
6. Click a group header row to expand or collapse it.

---

## Cell highlighting

The **Cell class** expression on a column can return any CSS class. The following classes are built in:

| Class | Style |
|---|---|
| `rdg-cell--danger` | Red background, red bold text |
| `rdg-cell--warning` | Amber background, dark amber text |
| `rdg-cell--success` | Green background, green text |
| `rdg-cell--info` | Cyan background, dark cyan text |
| `rdg-cell--muted` | Grey text |

Example expression:

```
if $currentObject/Status = 'Overdue' then 'rdg-cell--danger'
else if $currentObject/Status = 'AtRisk' then 'rdg-cell--warning'
else ''
```

---

## CSS customisation

The widget root element has the class `widget-react-data-grid`. All internal classes use the `rdg-` prefix and can be overridden in your theme CSS. Key classes:

| Class | Element |
|---|---|
| `widget-react-data-grid` | Outer container |
| `.rdg-toolbar` | Toolbar bar |
| `.rdg-toolbar__btn` | Toolbar buttons |
| `.rdg-groupby-bar` | Group-by bar |
| `.rdg-header-filter-input` | Filter text inputs |
| `.rdg-header-filter-select` | Filter dropdowns (boolean / enum) |
| `.rdg-summary-row` | Summary row |
| `.rdg-cell-progress` | Progress bar container |
| `.rdg-empty-placeholder` | Empty state message |

The header row background colour defaults to `var(--brand-default, #264ae5)`. Override it with the Mendix theme variable `--brand-default` or a targeted CSS rule.

---

## Development

### Prerequisites

- Node.js ≥ 16
- A Mendix project with the widget source placed under `{app}/myPluggableWidgets/ReactDataGrid/`

### Commands

```bash
# One-time dependency install
npm install

# Development server (hot reload)
npm run dev

# Production build → dist/1.0.0/conventsystems.ReactDataGrid.mpk
npm run build

# Lint
npm run lint
npm run lint:fix
```

The build output is automatically placed in `dist/1.0.0/`. Copy the `.mpk` file to your project's `widgets/` folder and run **F4** in Studio Pro to pick up changes.

### Dependencies

| Package | Version | Purpose |
|---|---|---|
| react-data-grid | 7.0.0-beta.44 | Core grid engine |
| xlsx | ^0.18.5 | CSV and Excel export |
| jsPDF + jspdf-autotable | (bundled) | PDF export |

---

## Limitations

- Filtering is **client-side only**. For server-side filtering, configure constraints on the datasource using Mendix page variables or microflow-driven datasources.
- The **Export** buttons export the rows currently loaded in the grid. If the datasource uses server-side paging, only the loaded page is exported. Disable paging or load all rows before exporting.
- Inline cell editing is not supported. Mendix's pluggable widget API marks list-context attributes as read-only at the framework level; use a row-click action to open a pop-up form for editing instead.
