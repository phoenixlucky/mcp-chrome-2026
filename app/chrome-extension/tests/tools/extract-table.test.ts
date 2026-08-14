import { describe, expect, it } from 'vitest';
import { buildExtractionScript } from '@/entrypoints/background/tools/browser/extract';

describe('chrome_extract table mode', () => {
  it('expands colspan and rowspan into header and data rows', () => {
    document.body.innerHTML = `
      <table class="report">
        <thead><tr><th rowspan="2">Name</th><th colspan="2">Score</th></tr><tr><th>Math</th><th>English</th></tr></thead>
        <tbody><tr><td rowspan="2">Ada</td><td>90</td><td>95</td></tr><tr><td>88</td><td>92</td></tr></tbody>
      </table>`;

    const raw = window.eval(
      buildExtractionScript({
        selector: '.report',
        fields: [{ name: 'data', type: 'table' }],
      }),
    );
    const result = JSON.parse(raw);

    expect(result.items[0].data).toEqual({
      headers: ['Name', 'Math', 'English'],
      rows: [
        ['Ada', '90', '95'],
        ['Ada', '88', '92'],
      ],
    });
  });

  it('reads controlled form values for text and value-attribute extraction', () => {
    document.body.innerHTML = '<textarea class="draft"></textarea>';
    const textarea = document.querySelector('.draft') as HTMLTextAreaElement;
    textarea.value = 'React draft';

    const raw = window.eval(
      buildExtractionScript({
        selector: '.draft',
        fields: [
          { name: 'text', type: 'text' },
          { name: 'valueAttribute', type: 'attribute', attribute: 'value' },
          { name: 'attrAlias', type: 'attr', attr: 'value' },
        ],
      }),
    );
    const result = JSON.parse(raw);

    expect(result.items[0]).toEqual({
      text: 'React draft',
      valueAttribute: 'React draft',
      attrAlias: 'React draft',
    });
  });
});
