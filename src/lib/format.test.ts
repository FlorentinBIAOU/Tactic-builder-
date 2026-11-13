import { describe, expect, it } from 'vitest';
import { bloomLevel, formatDuration, readability, readabilityBand, syllableCount, words } from './format';

const easy =
  "Le budget, c'est simple. Tu notes ce qui entre. Tu notes ce qui sort. " +
  'Tu gardes une part pour plus tard. Tu fais ça chaque mois. Tu vois vite où va ton argent. ' +
  'Puis tu choisis quoi garder.';

const hard =
  "L'allocation stratégique d'actifs patrimoniaux diversifiés nécessite l'évaluation méthodique " +
  'des corrélations intertemporelles, des volatilités conditionnelles et des contraintes réglementaires ' +
  "applicables aux investisseurs institutionnels européens, particulièrement lorsque l'environnement " +
  'macroéconomique international demeure caractérisé par une incertitude considérable et persistante.';

describe('syllableCount (French)', () => {
  it('counts vowel groups and drops a silent final e', () => {
    expect(syllableCount('marché')).toBe(2);
    expect(syllableCount('bourse')).toBe(1);
    expect(syllableCount('tableau')).toBe(2);
    expect(syllableCount('actions')).toBe(2);
    expect(syllableCount('le')).toBe(1);
  });
});

describe('readability (Kandel & Moles)', () => {
  it('returns null when the text is too short to judge', () => {
    expect(readability('')).toBeNull();
    expect(readability('Trois mots seulement.')).toBeNull();
  });

  it('scores short plain French as easy and long technical French as hard', () => {
    const e = readability(easy)!;
    const h = readability(hard)!;
    expect(e).toBeGreaterThan(h);
    expect(readabilityBand(e)).toBe('easy');
    expect(readabilityBand(h)).toBe('hard');
  });

  it('uses the French coefficients (207 − 1.015 × W/S − 73.6 × syl/W)', () => {
    // 30 one-syllable words in one sentence: 207 − 30.45 − 73.6 = 102.95 → clamped to 100
    const text = Array.from({ length: 30 }, () => 'bon').join(' ') + '.';
    expect(readability(text)).toBe(100);
    // 30 two-syllable words, 1 sentence: 207 − 30.45 − 147.2 = 29.35 → 29
    const text2 = Array.from({ length: 30 }, () => 'marché').join(' ') + '.';
    expect(readability(text2)).toBe(29);
  });

  it('bands', () => {
    expect(readabilityBand(null)).toBe('na');
    expect(readabilityBand(60)).toBe('easy');
    expect(readabilityBand(45)).toBe('medium');
    expect(readabilityBand(10)).toBe('hard');
  });
});

describe('bloomLevel (whole words)', () => {
  it('does not match a keyword inside another word', () => {
    // « use » inside « because », « crée » inside « créer » used to give Apply / Create.
    expect(bloomLevel('It works because prices move.')).toBe('Remember');
    expect(bloomLevel('Il faut créer un budget.')).toBe('Remember');
  });

  it('matches whole words, French and English', () => {
    expect(bloomLevel('Explique pourquoi le prix baisse.')).toBe('Understand');
    expect(bloomLevel('Calcule le rendement de ton ETF.')).toBe('Apply');
    expect(bloomLevel('Use the 1 % rule.')).toBe('Apply');
    expect(bloomLevel('Compare ces deux ETF.')).toBe('Analyze');
    expect(bloomLevel('Conçois ton propre plan.')).toBe('Create');
  });

  it('ignores markup and case', () => {
    expect(bloomLevel('**CALCULE** le total')).toBe('Apply');
  });

  it('matches multi-word phrases on word boundaries', () => {
    expect(bloomLevel('Break down the chart.')).toBe('Analyze');
    expect(bloomLevel('Breakdown of costs.')).toBe('Remember');
  });
});

describe('words / formatDuration', () => {
  it('keeps elisions and accents together', () => {
    expect(words("L'épargne, c'est 20 %.")).toEqual(["l'épargne", "c'est"]);
  });
  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min 05 s');
  });
});
