import { describe, expect, it } from 'vitest';
import {
  detectEmptyStateFromDom,
  extractReviewSummaryFromDom,
  extractRecordsFromDom,
  hashCards,
  mergeRecords,
} from '@/entrypoints/background/tools/browser/review-utils';

describe('review tool DOM helpers', () => {
  it('extracts records and excludes Question/Answer cards', () => {
    document.body.innerHTML = `<article class="card"><h2>Great</h2><p>Works well.</p></article><article class="card">Question: does it fit?</article>`;
    expect(
      extractRecordsFromDom(
        document,
        '.card',
        [{ name: 'title', selector: 'h2' }],
        ['question', 'answer'],
        true,
      ),
    ).toEqual({
      records: [
        {
          title: 'Great',
          outerHtml: '<article class="card"><h2>Great</h2><p>Works well.</p></article>',
        },
      ],
      excludedCount: 1,
    });
  });

  it('detects empty and content states from configured HTML', () => {
    document.body.innerHTML = '<p>Be the first to review</p><span class="count">0</span>';
    expect(
      detectEmptyStateFromDom(document, '.review', ['Be the first to review'], '.count'),
    ).toMatchObject({
      state: 'empty',
      terminal: true,
    });
    document.body.innerHTML = '<article class="review">One</article>';
    expect(detectEmptyStateFromDom(document, '.review').state).toBe('has_content');
  });

  it('extracts a canonical product id and treats zero BBB reviews as a terminal result', () => {
    document.body.innerHTML = `
      <div class="review-summary">
        <h3>Reviews</h3>
        <div class="rating"><div class="cl-rating-sr">Average Rating: 0.0 Stars</div></div>
        <span class="review-count">0</span>
        <a href="https://www.bedbathandbeyond.com/write-review/create?productId=43420824">Write the first review</a>
      </div>`;

    expect(
      extractReviewSummaryFromDom(
        document,
        'https://www.bedbathandbeyond.com/Home-Garden/raised-bed/43420824/product.html?option=91210608',
      ),
    ).toEqual({
      found: true,
      state: 'empty',
      terminal: true,
      title: 'Reviews',
      rating: 0,
      reviewCount: 0,
      reviewLink: 'https://www.bedbathandbeyond.com/write-review/create?productId=43420824',
      productId: '43420824',
      productIdSource: 'path',
    });
  });

  it('changes the card hash when pagination content changes', () => {
    document.body.innerHTML = '<article class="review">Page one</article>';
    const first = hashCards(document, '.review');
    document.body.innerHTML = '<article class="review">Page two</article>';
    expect(hashCards(document, '.review')).not.toBe(first);
  });

  it('uses configured HTML date precedence across a one-day API difference', () => {
    const result = mergeRecords(
      [
        {
          name: 'api',
          priority: 1,
          records: [{ productId: '1', author: 'A', text: 'Good', reviewDate: '2026-06-17' }],
        },
        {
          name: 'comment_html',
          priority: 2,
          records: [{ productId: '1', author: 'A', text: 'Good', reviewDate: '2026-06-18' }],
        },
      ],
      ['productId', 'author', 'text', 'reviewDate'],
      { reviewDate: ['comment_html', 'api'] },
      false,
      true,
      1,
    );
    expect(result.records).toEqual([
      { productId: '1', author: 'A', text: 'Good', reviewDate: '2026-06-18' },
    ]);
  });
});
