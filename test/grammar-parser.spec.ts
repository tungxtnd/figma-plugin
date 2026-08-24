import { processGrammar } from '../src/core/grammar-parser';
import { Component } from '../src/types';

const comparisonLists: Component[] = [
  { type: 'heading', text: 'So sánh', size_level: 'HeadingL' },
  { type: 'list', title: 'Không nên', style: 'checklist', items: ['Dùng màu không đủ tương phản'] },
  { type: 'list', title: 'Nên làm', style: 'checklist', items: ['Dùng màu có tương phản cao'] },
];

describe('grammar parser list normalization', () => {
  it('preserves two independent lists for a comparison grid', () => {
    const result = processGrammar(comparisonLists, 'grid');

    expect(result.lists).toHaveLength(2);
    expect(result.lists.map((list) => list.title)).toEqual(['Không nên', 'Nên làm']);
  });

  it('retains the single-list density limit for non-grid layouts', () => {
    const result = processGrammar(comparisonLists, 'split');

    expect(result.lists).toHaveLength(1);
    expect(result.lists[0].title).toBe('Không nên');
  });
});
