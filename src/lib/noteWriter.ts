export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/** Coalesces edits, serializes transactions, and drains before deletion. */
export class NoteWriter<T> {
  private pending: T | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active: Promise<void> | undefined;
  private deleted = false;
  constructor(
    private write: (value: T) => Promise<unknown>,
    private onStatus: (status: SaveStatus, error?: unknown) => void,
    private delay = 450,
  ) {}
  queue(value: T) {
    if (this.deleted) return;
    this.pending = value;
    this.onStatus("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => {});
    }, this.delay);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.active) return this.active;
    if (this.deleted || this.pending === undefined) return Promise.resolve();
    this.active = this.drain().finally(() => {
      this.active = undefined;
    });
    return this.active;
  }
  private async drain() {
    while (!this.deleted && this.pending !== undefined) {
      const value = this.pending;
      this.pending = undefined;
      this.onStatus("saving");
      try {
        await this.write(value);
      } catch (error) {
        if (!this.deleted && this.pending === undefined) this.pending = value;
        this.onStatus("error", error);
        throw error;
      }
    }
    if (!this.deleted) this.onStatus("saved");
  }
  async remove(remove: () => Promise<unknown>) {
    this.deleted = true;
    clearTimeout(this.timer);
    this.pending = undefined;
    await this.active?.catch(() => {});
    try {
      await remove();
    } catch (error) {
      this.deleted = false;
      this.onStatus("error", error);
      throw error;
    }
  }
}
