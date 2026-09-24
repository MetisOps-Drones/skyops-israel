import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    // overflow-x-auto here (not on the table itself): table-layout: fixed
    // below divides w-full evenly among columns, which is what a wide
    // desktop container wants — but a 6-8 column table (every dense table
    // in this app) squeezed into a ~350px phone width that same way gives
    // each column just a few px, truncating every header down to 2-3
    // characters. min-w-[640px] gives the fixed layout enough room to
    // actually honor each TableHead's own max-w-[120px] instead of
    // dividing something much smaller; on a container already wider than
    // that (any normal desktop panel) min-width never engages and nothing
    // changes there — the scrollbar only ever shows up where it's needed.
    <div className="relative w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn("w-full min-w-[640px] caption-bottom text-xs [table-layout:fixed]", className)}
        {...props}
      />
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
