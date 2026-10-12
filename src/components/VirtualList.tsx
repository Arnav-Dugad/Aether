import { useEffect, useRef, useState, type ReactNode } from "react";
export function visibleRange(
  count: number,
  height: number,
  rowHeight: number,
  top: number,
  overscan = 5,
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
  return {
    start,
    end: Math.min(count, Math.ceil((top + height) / rowHeight) + overscan),
  };
}
export function VirtualList<T>({
  items,
  rowHeight,
  render,
  label,
  focusable,
  itemKey,
}: {
  items: T[];
  rowHeight: number;
  render: (item: T, index: number) => ReactNode;
  label: string;
  focusable?: (item: T) => boolean;
  itemKey?: (item: T) => string | number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(560);
  const [focused, setFocused] = useState<number | null>(null);
  const pendingFocus = useRef<number | null>(null);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const range = visibleRange(items.length, height, rowHeight, top);
  const indices = Array.from(
    { length: range.end - range.start },
    (_, i) => range.start + i,
  );
  if (focused !== null && focused < items.length && !indices.includes(focused))
    indices.push(focused);
  useEffect(() => {
    if (pendingFocus.current !== null) {
      viewport.current
        ?.querySelector<HTMLElement>(
          `[data-virtual-index="${pendingFocus.current}"] [data-tab-link]`,
        )
        ?.focus();
      pendingFocus.current = null;
    }
  }, [top, focused]);
  useEffect(() => {
    if (
      viewport.current &&
      viewport.current.scrollTop >
        Math.max(0, items.length * rowHeight - height)
    ) {
      viewport.current.scrollTop = 0;
      setTop(0);
    }
  }, [items.length, height, rowHeight]);
  return (
    <div
      className="virtual-list"
      ref={viewport}
      role="list"
      aria-label={label}
      onScroll={(e) => setTop(e.currentTarget.scrollTop)}
      onFocusCapture={(e) => {
        const index = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-virtual-index]",
        )?.dataset.virtualIndex;
        if (index !== undefined) setFocused(Number(index));
      }}
      onKeyDown={(e) => {
        if (
          !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) ||
          !(e.target as HTMLElement).hasAttribute("data-tab-link")
        )
          return;
        const current = Number(
          (e.target as HTMLElement).closest<HTMLElement>("[data-virtual-index]")
            ?.dataset.virtualIndex ?? 0,
        );
        let index =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : Math.max(
                  0,
                  Math.min(
                    items.length - 1,
                    current + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                );
        const direction = e.key === "ArrowUp" || e.key === "End" ? -1 : 1;
        while (
          index >= 0 &&
          index < items.length &&
          focusable &&
          !focusable(items[index]!)
        )
          index += direction;
        if (index < 0 || index >= items.length) return;
        e.preventDefault();
        const el = viewport.current!;
        const position = index * rowHeight;
        if (position < el.scrollTop) el.scrollTop = position;
        else if (position + rowHeight > el.scrollTop + el.clientHeight)
          el.scrollTop = position + rowHeight - el.clientHeight;
        pendingFocus.current = index;
        setFocused(index);
        setTop(el.scrollTop);
      }}
    >
      <div
        className="virtual-content"
        style={{ height: items.length * rowHeight }}
      >
        {indices
          .sort((a, b) => a - b)
          .map((index) => (
            <div
              className="virtual-row"
              key={itemKey ? itemKey(items[index]!) : index}
              data-virtual-index={index}
              role="listitem"
              aria-posinset={index + 1}
              aria-setsize={items.length}
              style={{
                transform: `translateY(${index * rowHeight}px)`,
                height: rowHeight,
              }}
            >
              {render(items[index]!, index)}
            </div>
          ))}
      </div>
    </div>
  );
}
