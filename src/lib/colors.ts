function rgb(hex: string): number[] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
}
function luminance(values: number[]): number {
  return values.reduce((sum, channel, i) => {
    const c = channel / 255;
    return (
      sum +
      (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][i]!
    );
  }, 0);
}
export function contrast(a: string, b: string): number {
  const x = luminance(rgb(a)),
    y = luminance(rgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function adjust(color: string, background: string, toward: number): string {
  const values = rgb(color);
  let result = color;
  for (let step = 0; step <= 20; step++) {
    result =
      "#" +
      values
        .map((value) =>
          Math.round(value + ((toward - value) * step) / 20)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    if (contrast(result, background) >= 5) break;
  }
  return result;
}
export function accentColors(color: string) {
  return {
    light: adjust(color, "#dfe4ef", 0),
    dark: adjust(color, "#343843", 255),
    fill: adjust(color, "#ffffff", 0),
  };
}
