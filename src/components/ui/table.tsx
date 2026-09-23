import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full">
      {/* table-layout: fixed — table-layout: auto (the default) sizes the
          table to fit every column's natural content width and lets the
          TOTAL exceed its container if the sum doesn't fit, which is
          exactly what forced a horizontal scrollbar on every dense table
          in the app regardless of how much individual cells/headers were
          told to truncate. Fixed layout caps the table at its own width
          (100% of the container, from w-full) and divides that among
          columns instead, so a cell's truncate + max-w actually gets
          enforced rather than being a width the browser was free to
          ignore. */}
      <table ref={ref} className={cn("w-full caption-bottom text-xs [table-layout:fixed]", className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium", className)} {...props} />
  )
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        // truncate: a table's default column sizing (table-layout: auto)
        // fits each column to its WIDEST cell across the whole column,
        // header included — a body cell truncating its own text doesn't
        // help if the header label itself is long enough to force the
        // column wide anyway. Same fix as TableCell below.
        "h-7 max-w-[120px] truncate px-1.5 text-start align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pe-0",
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    // overflow-hidden (not full truncate — a cell can hold a button/badge,
    // not just text): with table-layout: fixed every column is a hard
    // allocation, and content that doesn't fit (e.g. an action button
    // wider than its column) would otherwise render past the cell's own
    // box and visually overlap the next column instead of just clipping.
    <td ref={ref} className={cn("overflow-hidden p-1.5 align-middle [&:has([role=checkbox])]:pe-0", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  )
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
