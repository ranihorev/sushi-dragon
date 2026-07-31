import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dragon } from './Dragon';

/**
 * Which face, and when.
 *
 * The drawing is five rendered images now, so the only thing left in this
 * component is the choice between them — and that choice is the whole of the
 * dragon's behaviour as far as the child is concerned.
 */
const face = (view: { container: HTMLElement }) =>
  view.container.querySelector('img')?.getAttribute('src') ?? '';

describe('the dragon', () => {
  it('is calm when nothing has happened', () => {
    const view = render(<Dragon />);
    expect(face(view)).toMatch(/idle/);
  });

  it('wears the mood it is given', () => {
    const view = render(<Dragon mood="puzzled" />);
    expect(face(view)).toMatch(/puzzled/);
  });

  it('looks full once the meal is nearly finished', () => {
    // the end of a meal should look like the end of a meal, not like the start
    const view = render(<Dragon mood="idle" fullness={0.9} />);
    expect(face(view)).toMatch(/full/);
  });

  it('still answers what he just did, however full it is', () => {
    /* Chewing and puzzled are replies to the piece he fed a moment ago. A full
       belly must not swallow the only feedback the game gives him. */
    const view = render(<Dragon mood="chewing" fullness={1} />);
    expect(face(view)).toMatch(/chewing/);
  });

  it('is not full halfway through', () => {
    const view = render(<Dragon mood="idle" fullness={0.5} />);
    expect(face(view)).toMatch(/idle/);
  });
});
