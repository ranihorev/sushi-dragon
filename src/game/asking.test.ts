import { describe, expect, it } from 'vitest';
import { ALL_CARRIERS, carrierFor, wholeQuestion } from './asking';

describe('the way the dragon asks', () => {
  it('does not use the same words two rounds running', () => {
    /* The whole complaint: "A new word" every time. A sentence he can predict
       is a sentence he stops listening to, and the word is on the end of it. */
    const said = [0, 1, 2, 3].map((turn) => carrierFor('pick', turn));
    expect(new Set(said).size).toBe(4);
  });

  it('asks the same way for the same round of the same meal', () => {
    // nothing here is random: a replayed question must not change wording
    expect(carrierFor('meet', 2)).toBe(carrierFor('meet', 2));
  });

  it('carries on rotating from one meal into the next', () => {
    // `turn` counts meals as well as rounds, so meal two does not repeat meal one
    expect(carrierFor('pick', 0)).not.toBe(carrierFor('pick', 1));
  });

  it('says nothing at all in a reading round', () => {
    // the point of that round is getting the word off the page unaided
    expect(carrierFor('read', 0)).toBeNull();
  });

  it('stops where the word starts, so it can be spoken or played', () => {
    /* Each line is glued to the word — by the iPad reading the pair as one
       sentence, or by two clips played back to back. A line that ended in
       punctuation would work as neither. */
    for (const line of ALL_CARRIERS) {
      expect(line, line).not.toMatch(/[.,?!]$/);
      expect(wholeQuestion(line, 'sushi'), line).toMatch(/ sushi$/);
    }
  });

  it('never trails off mid-question with nothing to say', () => {
    for (const kind of ['meet', 'pick', 'order'] as const) {
      expect(carrierFor(kind, 0), kind).toBeTruthy();
    }
  });
});
