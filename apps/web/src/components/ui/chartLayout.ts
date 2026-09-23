/** Tailwind `sm` boundary. A chart container narrower than this uses fewer ticks. */
export const NARROW_CHART_MAX = 640;

export function isNarrowChart(containerWidth: number): boolean {
  return containerWidth > 0 && containerWidth < NARROW_CHART_MAX;
}

export function trendLineGridStops(containerWidth: number): number[] {
  return isNarrowChart(containerWidth) ? [0, 1] : [0, 0.33, 0.66, 1];
}

export function trendBarAxisTicks(containerWidth: number): number[] {
  return isNarrowChart(containerWidth) ? [10, 0] : [10, 8, 6, 4, 2, 0];
}

/** Keep the first, middle, and last category labels when the plot is narrow. */
export function showCategoryLabel(index: number, count: number, containerWidth: number): boolean {
  if (!isNarrowChart(containerWidth) || count <= 4) return true;
  if (index === 0 || index === count - 1) return true;
  return index === Math.floor((count - 1) / 2);
}
