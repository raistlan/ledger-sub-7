import { renderHook, act } from "@testing-library/react";
import { useEditEntryDialog } from "./useEditEntryDialog";
import type { Entry } from "~/types/api";

const mockSubmit = jest.fn();
const mockReset = jest.fn();

jest.mock("react-router", () => ({
  useFetcher: () => ({
    submit: mockSubmit,
    reset: mockReset,
  }),
}));

const mockEntry: Entry = {
  id: "entry-123",
  budget_id: "budget-456",
  amount: 10.0,
  type: "expense",
  memo: "lunch",
  date: "2026-04-10",
};

describe("useEditEntryDialog", () => {
  beforeEach(() => {
    mockSubmit.mockClear();
    mockReset.mockClear();
  });

  it("save() calls fetcher.submit and does NOT call fetcher.reset", () => {
    const { result } = renderHook(() => useEditEntryDialog());

    act(() => {
      result.current.open(mockEntry);
    });

    act(() => {
      result.current.save({ amount: 15.0, type: "expense", memo: "dinner" });
    });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("save() closes the dialog (sets editingEntry to null)", () => {
    const { result } = renderHook(() => useEditEntryDialog());

    act(() => {
      result.current.open(mockEntry);
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.save({ amount: 15.0, type: "expense", memo: "dinner" });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("cancel() calls fetcher.reset", () => {
    const { result } = renderHook(() => useEditEntryDialog());

    act(() => {
      result.current.open(mockEntry);
    });

    act(() => {
      result.current.cancel();
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("cancel() does NOT call fetcher.submit", () => {
    const { result } = renderHook(() => useEditEntryDialog());

    act(() => {
      result.current.open(mockEntry);
    });

    act(() => {
      result.current.cancel();
    });

    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
