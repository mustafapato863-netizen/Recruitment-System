export type OfferCurrency = 'AED' | 'EGP';

export const DEFAULT_OFFER_CURRENCY: OfferCurrency = 'AED';

export function normalizeOfferCurrency(value?: string | null): OfferCurrency {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'EGP' || normalized === 'EGY' ? 'EGP' : DEFAULT_OFFER_CURRENCY;
}

export function getOfferCurrency(
  components?: ReadonlyArray<{ type?: string; currency?: string | null }> | null,
): OfferCurrency {
  const salaryCurrency = components?.find((component) => component.type === 'Salary')?.currency;
  return normalizeOfferCurrency(salaryCurrency ?? components?.[0]?.currency);
}

export function formatOfferAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return `${normalizeOfferCurrency(currency)} ${Number(amount).toLocaleString()}`;
}
