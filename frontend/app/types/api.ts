export type UUID = string;
export type ISODate = string; // "YYYY-MM-DD"
export type EntryType = "expense" | "credit";
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // literal union, not plain number

export interface User {
  id: UUID;
  email: string;
  name: string;
  week_start_day: WeekStartDay;
}

export interface Budget {
  id: UUID;
  name: string;
  weekly_amount: number;
}

export interface Entry {
  id: UUID;
  budget_id: UUID;
  amount: number;
  type: EntryType;
  memo: string | null;
  date: ISODate;
}

export interface Pagination {
  limit: number;
  offset: number;
  total_count: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface SingleResponse<T> {
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
  details: Array<{ field: string; reason: string }>;
}

export interface ErrorResponse {
  error: ApiError;
}

export interface ReportEntry {
  id: UUID;
  amount: number;
  type: EntryType;
  memo: string | null;
  date: ISODate;
}

export interface WeekSummary {
  week_start: ISODate;
  week_end: ISODate;
  entries: ReportEntry[];
  total_spent: number;
  total_credits: number;
  net_spent: number;
}

export interface ReportSummary {
  total_spent: number;
  total_credits: number;
  net: number;
  start: ISODate;
  end: ISODate;
  entries?: ReportEntry[];
  weeks?: WeekSummary[];
}
