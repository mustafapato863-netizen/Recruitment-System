import { useEffect, useMemo, useState } from 'react';
import type { MasterDataCategory, MasterDataValueRecord } from '@recruitflow/contracts';
import { getApi } from '../api/client';

export interface MasterDataOption {
  id: string;
  code: string | null;
  name: string;
  metadata: Record<string, unknown> | null;
  country?: string | null;
  city?: string | null;
}

const EMPTY_FALLBACK: readonly string[] = [];

type CatalogCategory = MasterDataCategory | 'branches' | 'job-titles';
type CatalogRecord = MasterDataValueRecord & { country?: string | null; city?: string | null };

function toOption(record: CatalogRecord): MasterDataOption | null {
  const name = record.name.trim();
  if (!name || record.status === 'Inactive' || record.status === 'Archived') return null;
  return {
    id: record.id,
    code: record.code,
    name,
    metadata: record.metadata ?? null,
    country: record.country,
    city: record.city,
  };
}

/**
 * Load one organization-owned Master Data catalog for selectors and suggestions.
 * A small fallback keeps forms usable while a local API is restarting; production
 * values are always read from the catalog and never embedded in page components.
 */
export function useMasterDataOptions(
  category: CatalogCategory,
  fallback: readonly string[] = EMPTY_FALLBACK,
) {
  const fallbackOptions = useMemo<MasterDataOption[]>(
    () => fallback.map((name, index) => ({ id: `fallback-${category}-${index}`, code: null, name, metadata: null })),
    [category, fallback],
  );
  const [options, setOptions] = useState<MasterDataOption[]>(fallbackOptions);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => getApi<CatalogRecord[]>(`/master-data/catalog/${category}`))
      .then((records) => {
        if (cancelled) return;
        const loaded = (Array.isArray(records) ? records : [])
          .map(toOption)
          .filter((option): option is MasterDataOption => option !== null);
        setOptions(loaded.length > 0 ? loaded : fallbackOptions);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason);
        setOptions(fallbackOptions);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, fallbackOptions]);

  return { options, isLoading, error };
}
