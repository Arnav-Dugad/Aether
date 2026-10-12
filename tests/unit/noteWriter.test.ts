import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteWriter } from "../../src/lib/noteWriter";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => vi.useRealTimers());
describe("note autosave transactions", () => {
  it("coalesces a typing burst and flushes without waiting for the debounce", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue(undefined);
    const status = vi.fn();
    const writer = new NoteWriter(write, status);
    writer.queue("first");
    writer.queue("latest");
    expect(write).not.toHaveBeenCalled();
    await writer.flush();
    expect(write.mock.calls).toEqual([["latest"]]);
    expect(status).toHaveBeenLastCalledWith("saved");
    await vi.runAllTimersAsync();
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("serializes transactions and flush awaits edits queued while a transaction runs", async () => {
    const gate = deferred();
    const write = vi
      .fn()
      .mockImplementationOnce(() => gate.promise)
      .mockResolvedValue(undefined);
    const writer = new NoteWriter(write, vi.fn());
    writer.queue("first");
    const flushing = writer.flush();
    writer.queue("second");
    writer.queue("third");
    expect(write).toHaveBeenCalledTimes(1);
    gate.resolve();
    await flushing;
    expect(write.mock.calls).toEqual([["first"], ["third"]]);
  });
  it("retains failed edits so retry persists the newest revision", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage full"))
      .mockResolvedValue(undefined);
    const status = vi.fn();
    const writer = new NoteWriter(write, status);
    writer.queue("draft");
    await expect(writer.flush()).rejects.toThrow("Storage full");
    expect(status).toHaveBeenLastCalledWith("error", expect.any(Error));
    await writer.flush();
    expect(write.mock.calls).toEqual([["draft"], ["draft"]]);
    expect(status).toHaveBeenLastCalledWith("saved");
  });
  it("drains an in-flight write before delete, cancels queued saves, and cannot resurrect a note", async () => {
    vi.useFakeTimers();
    const gate = deferred();
    const events: string[] = [];
    const write = vi.fn(async () => {
      events.push("write");
      await gate.promise;
      events.push("committed");
    });
    const writer = new NoteWriter(write, vi.fn());
    writer.queue("first");
    const flushing = writer.flush();
    writer.queue("second");
    const deleting = writer.remove(async () => {
      events.push("deleted");
    });
    writer.queue("late");
    expect(events).toEqual(["write"]);
    gate.resolve();
    await Promise.all([flushing, deleting]);
    await writer.flush();
    await vi.runAllTimersAsync();
    expect(events).toEqual(["write", "committed", "deleted"]);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("waits for the database commit before announcing saved", async () => {
    const gate = deferred();
    const status = vi.fn();
    const writer = new NoteWriter(() => gate.promise, status);
    writer.queue("draft");
    const flushing = writer.flush();
    expect(status).toHaveBeenLastCalledWith("saving");
    gate.resolve();
    await flushing;
    expect(status).toHaveBeenLastCalledWith("saved");
  });
});
