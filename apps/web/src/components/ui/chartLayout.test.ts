import { describe, expect, it } from 'vitest';
import { showCategoryLabel, trendBarAxisTicks, trendLineGridStops } from './chartLayout';

describe('chart layout', () => {
  it('keeps the full tick set at desktop widths and before measurement', () => {
    expect(trendLineGridStops(0)).toEqual([0, 0.33, 0.66, 1]);
    expect(trendLineGridStops(1280)).toEqual([0, 0.33, 0.66, 1]);
    expect(trendBarAxisTicks(1280)).toEqual([10, 8, 6, 4, 2, 0]);
    expect(showCategoryLabel(1, 8, 1280)).toBe(true);
  });

  it('drops to the sm-boundary tick set when the chart container is narrow', () => {
    expect(trendLineGridStops(360)).toEqual([0, 1]);
    expect(trendBarAxisTicks(390)).toEqual([10, 0]);
    expect(showCategoryLabel(0, 8, 390)).toBe(true);
    expect(showCategoryLabel(1, 8, 390)).toBe(false);
    expect(showCategoryLabel(3, 8, 390)).toBe(true);
    expect(showCategoryLabel(7, 8, 390)).toBe(true);
    expect(showCategoryLabel(1, 4, 390)).toBe(true);
  });
});
