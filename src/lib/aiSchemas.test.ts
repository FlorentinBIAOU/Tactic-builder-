import { describe, expect, it } from 'vitest';
import { agentReportSchema, generatedContentSchema, ideasSchema } from './aiSchemas';

describe('AI answer validation', () => {
  it('normalises generated content and clamps the correct index', () => {
    const r = generatedContentSchema.parse({
      blocks: [{ type: 'hook', text: 'Hi' }, { type: 'weird', text: 'x' }, { type: 'tip', text: '' }],
      quiz: { q: 'Q', opts: ['a', 'b', 'c'], correct: 7, expl: 'e' },
    });
    expect(r.blocks.map((b) => b.type)).toEqual(['hook', 'content']);
    expect(r.quiz.correct).toBe(0);
  });

  it('rejects content without blocks', () => {
    expect(generatedContentSchema.safeParse({ blocks: [], quiz: { q: 'Q', opts: ['a', 'b'] } }).success).toBe(false);
  });

  it('keeps only usable ideas', () => {
    const r = ideasSchema.parse({ ideas: [{ name: 'Idée', emoji: '💡', tag: 'Base', why: 'x' }, { name: '' }, 'junk'] });
    expect(r.ideas).toHaveLength(1);
  });

  it('rejects ideas that are not a list', () => {
    expect(ideasSchema.safeParse({ ideas: 'nope' }).success).toBe(false);
  });

  it('tolerates a malformed agent report', () => {
    const r = agentReportSchema.parse({ findings: 'oops', sections: 'bad' });
    expect(r.findings).toEqual([]);
    expect(r.sections).toBeUndefined();
  });
});
