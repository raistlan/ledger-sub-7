import { renderHook, waitFor, act } from "@testing-library/react";
import { useWakeBackend } from "./useWakeBackend";

const mockRevalidate = jest.fn();
jest.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate: mockRevalidate, state: "idle" }),
}));

beforeEach(() => {
  mockRevalidate.mockClear();
});

describe("useWakeBackend", () => {
  it("revalidates once the backend probe succeeds", async () => {
    const probe = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useWakeBackend({ probe, pollGapMs: 0, reloadFallbackMs: 100_000 }),
    );

    await waitFor(() => expect(result.current.status).toBe("recovered"));
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
  });

  it("keeps probing until the backend wakes, then recovers", async () => {
    const probe = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("CORS/connection"))
      .mockResolvedValueOnce(true);
    const { result } = renderHook(() =>
      useWakeBackend({ probe, pollGapMs: 0, reloadFallbackMs: 100_000 }),
    );

    await waitFor(() => expect(result.current.status).toBe("recovered"));
    expect(probe).toHaveBeenCalledTimes(3);
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
  });

  it("gives up with status 'timeout' past the overall deadline", async () => {
    const probe = jest.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useWakeBackend({ probe, pollGapMs: 0, overallDeadlineMs: 10 }),
    );

    await waitFor(() => expect(result.current.status).toBe("timeout"));
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("retry() restarts probing after a timeout", async () => {
    let awake = false;
    const probe = jest.fn(async () => awake);
    const { result } = renderHook(() =>
      useWakeBackend({ probe, pollGapMs: 0, overallDeadlineMs: 20, reloadFallbackMs: 100_000 }),
    );

    await waitFor(() => expect(result.current.status).toBe("timeout"));

    act(() => {
      awake = true;
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe("recovered"));
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
  });
});
