import React from "react";
import { Box, Chip, IconButton, Paper, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type MangaIDECenterSortKey = "title" | "status" | "lastRead" | "source";

export interface MangaIDECenterRow {
  id: string;
  title: string;
  ratingText: string;
  status: string;
  lastReadText: string;
  source: string;
}

interface MangaIDECenterTableProps {
  title: string;
  itemCount: number;
  rows: MangaIDECenterRow[];
  selectedRowId?: string | null;
  page?: number;
  totalPages?: number;
  sortKey?: MangaIDECenterSortKey;
  sortDirection?: "asc" | "desc";
  onPageChange?: (page: number) => void;
  onSortChange?: (key: MangaIDECenterSortKey) => void;
  onRowClick?: (row: MangaIDECenterRow) => void;
  onRowDoubleClick?: (row: MangaIDECenterRow) => void;
}

export default function MangaIDECenterTable({
  title,
  itemCount,
  rows,
  selectedRowId,
  page = 1,
  totalPages = 1,
  sortKey,
  sortDirection,
  onPageChange,
  onSortChange,
  onRowClick,
  onRowDoubleClick,
}: MangaIDECenterTableProps) {
  const hasPagination = totalPages > 1 && !!onPageChange;

  return (
    <Paper
      sx={{
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>
          {title}{" "}
          <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
            ({itemCount} items)
          </Box>
        </Typography>

        {hasPagination && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontFamily: "monospace", fontSize: 12 }}>
            <IconButton
              size="small"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              sx={{ border: 1, borderColor: "divider", borderRadius: 0.75, p: 0.4 }}
            >
              <ChevronLeft size={14} />
            </IconButton>
            <Box sx={{ minWidth: 76, textAlign: "center", color: "text.secondary" }}>
              Page {page}/{totalPages}
            </Box>
            <IconButton
              size="small"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              sx={{ border: 1, borderColor: "divider", borderRadius: 0.75, p: 0.4 }}
            >
              <ChevronRight size={14} />
            </IconButton>
          </Box>
        )}
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(260px,2fr) 120px 120px 210px 140px",
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        >
          <CellHeader onClick={onSortChange ? () => onSortChange("title") : undefined} active={sortKey === "title"} direction={sortDirection}>
            Title
          </CellHeader>
          <CellHeader>Rating</CellHeader>
          <CellHeader onClick={onSortChange ? () => onSortChange("status") : undefined} active={sortKey === "status"} direction={sortDirection}>
            Status
          </CellHeader>
          <CellHeader onClick={onSortChange ? () => onSortChange("lastRead") : undefined} active={sortKey === "lastRead"} direction={sortDirection}>
            Last Read
          </CellHeader>
          <CellHeader onClick={onSortChange ? () => onSortChange("source") : undefined} active={sortKey === "source"} direction={sortDirection}>
            Source
          </CellHeader>
        </Box>

        {rows.map((row) => {
          const selected = selectedRowId === row.id;
          return (
            <Box
              key={row.id}
              onClick={() => onRowClick?.(row)}
              onDoubleClick={() => onRowDoubleClick?.(row)}
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(260px,2fr) 120px 120px 210px 140px",
                borderBottom: 1,
                borderColor: "divider",
                fontSize: 12,
                fontFamily: "monospace",
                cursor: onRowClick || onRowDoubleClick ? "pointer" : "default",
                bgcolor: selected ? "primary.main" : "transparent",
                color: selected ? "primary.contrastText" : "text.primary",
                "&:hover": {
                  bgcolor: selected ? "primary.main" : "action.hover",
                },
              }}
            >
              <Cell>{row.title}</Cell>
              <Cell>{row.ratingText}</Cell>
              <Cell>
                <Chip
                  label={row.status}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 10,
                    borderRadius: 1,
                    bgcolor: selected ? "rgba(255,255,255,0.18)" : "action.selected",
                    color: selected ? "#fff" : "text.primary",
                  }}
                />
              </Cell>
              <Cell>{row.lastReadText}</Cell>
              <Cell>{row.source}</Cell>
            </Box>
          );
        })}
      </Box>

      {hasPagination && (
        <Box
          sx={{
            px: 1.5,
            py: 0.6,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.default",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "monospace",
            fontSize: 12,
            color: "text.secondary",
          }}
        >
          <Box>
            Showing {rows.length} item{rows.length === 1 ? "" : "s"}
          </Box>
          <Box>
            Page {page} of {totalPages}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

function CellHeader({
  children,
  onClick,
  active,
  direction,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  direction?: "asc" | "desc";
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 0.75,
        borderRight: 1,
        borderColor: "divider",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <span>{children}</span>
        {active && <span>{direction === "asc" ? "^" : "v"}</span>}
      </Box>
    </Box>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.6,
        borderRight: 1,
        borderColor: "divider",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {children}
    </Box>
  );
}
