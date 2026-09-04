export type Field = {
  name: string;
  selector?: string;
  type?: 'text' | 'html' | 'outerHtml' | 'attribute' | 'number' | 'href' | 'src';
  attribute?: string;
};

export type ReviewSummary = {
  found: boolean;
  state: 'has_content' | 'empty' | 'loading_or_unknown';
  terminal: boolean;
  title: string | null;
  rating: number | null;
  reviewCount: number | null;
  reviewLink: string | null;
  productId: string | null;
  productIdSource: 'path' | 'query' | 'review_link' | null;
};

function parseReviewNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/\u00a0/g, ' ')
    .replace(/,/g, '')
    .trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Extracts the summary of a product page's Reviews section.
 *
 * An explicit zero review count is a valid terminal result, not a loading or
 * page-invalid state. The function also accepts product IDs in the canonical
 * `/12345/product.html` path used by Bed Bath & Beyond.
 */
export function extractReviewSummaryFromDom(root: ParentNode, pageUrl = ''): ReviewSummary {
  const parseNumber = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const normalized = value
      .replace(/\u00a0/g, ' ')
      .replace(/,/g, '')
      .trim();
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const productIdFromUrl = (value: string): { id: string; source: 'path' | 'query' } | null => {
    try {
      const url = new URL(value, 'https://invalid.local');
      const queryId = url.searchParams.get('productId');
      if (queryId && /^\d+$/.test(queryId)) return { id: queryId, source: 'query' };
      const parts = url.pathname.split('/').filter(Boolean);
      const productIndex = parts.findIndex((part) => /^product\.html$/i.test(part));
      const pathId = productIndex > 0 ? parts[productIndex - 1] : null;
      return pathId && /^\d+$/.test(pathId) ? { id: pathId, source: 'path' } : null;
    } catch {
      return null;
    }
  };
  const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter((element) =>
    /^reviews?$/i.test((element.textContent || '').replace(/\s+/g, ' ').trim()),
  );
  const heading = headings[0];
  const section = heading?.parentElement || null;
  const sectionText = (section?.textContent || '').replace(/\s+/g, ' ').trim();
  const ratingElement = section?.querySelector(
    '.cl-rating-sr,[aria-label*="rating" i],[title*="Review Average" i]',
  );
  const rating = parseNumber(ratingElement?.textContent || ratingElement?.getAttribute('title'));
  const reviewLinkElement = section?.querySelector<HTMLAnchorElement>(
    'a[href*="review" i],a[data-tid*="review" i]',
  );
  const reviewLink = reviewLinkElement?.href || null;

  let reviewCount: number | null = null;
  if (section) {
    const numericSpans = Array.from(section.querySelectorAll('span')).filter((element) =>
      /^\s*\d[\d,\s]*(?:\.\d+)?\s*$/.test(element.textContent || ''),
    );
    reviewCount = parseNumber(numericSpans[0]?.textContent);
  }
  if (reviewCount === null) {
    const countMatch = sectionText.match(/(?:reviews?|ratings?)\s*[:(]?\s*(\d[\d,]*)/i);
    reviewCount = parseNumber(countMatch?.[1]);
  }

  let productIdInfo: {
    id: string;
    source: 'path' | 'query' | 'review_link';
  } | null = productIdFromUrl(pageUrl);
  if (!productIdInfo && reviewLink) {
    const linkId = productIdFromUrl(reviewLink);
    if (linkId) productIdInfo = { id: linkId.id, source: 'review_link' as const };
  }

  const hasExplicitEmptyState =
    reviewCount === 0 ||
    /\b(?:write the first review|be the first to review|no reviews yet|no reviews)\b/i.test(
      sectionText,
    );
  const hasContent =
    reviewCount !== null && reviewCount > 0
      ? true
      : Boolean(
          section?.querySelector('[data-review-id],[data-reviewid],[class*="review-card" i]'),
        );

  return {
    found: Boolean(heading),
    state: hasContent ? 'has_content' : hasExplicitEmptyState ? 'empty' : 'loading_or_unknown',
    terminal: !hasContent && hasExplicitEmptyState,
    title: heading ? (heading.textContent || '').replace(/\s+/g, ' ').trim() : null,
    rating,
    reviewCount,
    reviewLink,
    productId: productIdInfo?.id || null,
    productIdSource: productIdInfo?.source || null,
  };
}

export function extractRecordsFromDom(
  root: ParentNode,
  cardSelector: string,
  fields: Field[],
  excludeIfTextMatches: string[] = [],
  includeOuterHtml = false,
): { records: Record<string, unknown>[]; excludedCount: number } {
  let excludedCount = 0;
  const records = Array.from(root.querySelectorAll(cardSelector)).flatMap((card) => {
    const text = (card.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (excludeIfTextMatches.some((marker) => text.includes(marker.toLowerCase()))) {
      excludedCount += 1;
      return [];
    }
    const record: Record<string, unknown> = {};
    for (const field of fields) {
      const element = field.selector ? card.querySelector(field.selector) : card;
      if (!element) {
        record[field.name] = null;
        continue;
      }
      const type = field.type || 'text';
      if (type === 'html') record[field.name] = element.innerHTML;
      else if (type === 'outerHtml') record[field.name] = element.outerHTML;
      else if (type === 'attribute')
        record[field.name] = field.attribute ? element.getAttribute(field.attribute) : null;
      else if (type === 'number') {
        const value = Number.parseFloat((element.textContent || '').replace(/[^\d.-]/g, ''));
        record[field.name] = Number.isFinite(value) ? value : null;
      } else if (type === 'href')
        record[field.name] = (element as HTMLAnchorElement).href || element.getAttribute('href');
      else if (type === 'src')
        record[field.name] = (element as HTMLImageElement).src || element.getAttribute('src');
      else record[field.name] = (element.textContent || '').replace(/\s+/g, ' ').trim();
    }
    if (includeOuterHtml) record.outerHtml = card.outerHTML;
    return [record];
  });
  return { records, excludedCount };
}

export function detectEmptyStateFromDom(
  root: ParentNode,
  contentSelector: string,
  emptyTextMarkers: string[] = [],
  countSelector?: string,
) {
  const contentCount = root.querySelectorAll(contentSelector).length;
  const text = (root.textContent || '').toLowerCase();
  const matchedMarker = emptyTextMarkers.find((marker) => text.includes(marker.toLowerCase()));
  const countText = countSelector
    ? root.querySelector(countSelector)?.textContent?.trim() || null
    : null;
  const parsedCount = parseReviewNumber(countText);
  const explicitEmpty = Boolean(matchedMarker) || parsedCount === 0;
  return {
    state: contentCount > 0 ? 'has_content' : explicitEmpty ? 'empty' : 'loading_or_unknown',
    contentCount,
    matchedMarker: matchedMarker || null,
    countText,
    terminal: explicitEmpty,
  };
}

export function hashCards(root: ParentNode, cardSelector: string): string {
  let hash = 2166136261;
  for (const card of Array.from(root.querySelectorAll(cardSelector))) {
    for (const char of card.outerHTML) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function mergeRecords(
  sources: Array<{ name: string; priority: number; records: Record<string, unknown>[] }>,
  identityFields: string[],
  fieldPriority: Record<string, string[]> = {},
  allowSourceOnlyRecords = true,
  textNormalize = true,
  dateToleranceDays = 0,
) {
  const grouped = new Map<
    string,
    Array<{ source: string; priority: number; record: Record<string, unknown> }>
  >();
  const normalized = (value: unknown) =>
    textNormalize
      ? String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
      : String(value ?? '');
  const equivalentKey = (record: Record<string, unknown>) => {
    const identity = identityFields.map((field) => normalized(record[field]));
    for (const [key, records] of grouped) {
      const sample = records[0]?.record;
      const same = identityFields.every((field, index) => {
        const left = identity[index];
        const right = normalized(sample?.[field]);
        if (left === right) return true;
        const a = Date.parse(left);
        const b = Date.parse(right);
        return (
          Number.isFinite(a) &&
          Number.isFinite(b) &&
          Math.abs(a - b) <= dateToleranceDays * 86_400_000
        );
      });
      if (same) return key;
    }
    return identity.join('\\u0001');
  };
  for (const source of sources)
    for (const record of source.records) {
      const key = identityFields
        .map((field) =>
          String(record[field] ?? '')
            .trim()
            .toLowerCase(),
        )
        .join('\u0001');
      const groupKey = equivalentKey(record) || key;
      grouped.set(groupKey, [
        ...(grouped.get(groupKey) || []),
        { source: source.name, priority: source.priority, record },
      ]);
    }
  let droppedSourceOnlyCount = 0;
  const records = Array.from(grouped.values()).flatMap((group) => {
    if (!allowSourceOnlyRecords && group.length === 1) {
      droppedSourceOnlyCount += 1;
      return [];
    }
    const output: Record<string, unknown> = {};
    const fields = new Set(group.flatMap(({ record }) => Object.keys(record)));
    for (const field of fields) {
      const preferred = fieldPriority[field] || [];
      const selected = [...group]
        .sort((a, b) => {
          const aRank = preferred.indexOf(a.source);
          const bRank = preferred.indexOf(b.source);
          return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank) || a.priority - b.priority;
        })
        .find(
          ({ record }) =>
            record[field] !== null && record[field] !== undefined && record[field] !== '',
        );
      output[field] = selected?.record[field] ?? null;
    }
    return [output];
  });
  return { records, matchedCount: records.length, droppedSourceOnlyCount };
}
