import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Sushi } from './Sushi';
import { SALMON } from '@/theme';

/* On the iPad these are drawn by the native canvas; in a browser-shaped test
   they draw nothing at all, so the shapes are swapped for plain SVG tags. What
   is being checked either way is what the component asked to be drawn. */
vi.mock('react-native-svg', () => {
  const tag = (name: string) => {
    const El = name as 'svg';
    const Shape = ({ children, ...props }: { children?: ReactNode }) => (
      <El {...props}>{children}</El>
    );
    Shape.displayName = name;
    return Shape;
  };
  return { default: tag('svg'), Path: tag('path'), Rect: tag('rect') };
});

/** Every element of the drawing, the outside included. */
const drawn = () => {
  const piece = screen.getByTestId('sushi');
  return [piece, ...piece.querySelectorAll('*')];
};

/** Anything painted salmon — one per piece of sushi on the plate. */
const fish = () => drawn().filter((el) => el.getAttribute('fill') === SALMON);

describe('a word, as sushi', () => {
  /* Nigiri: a bed of rice with a slab of salmon draped over it. It used to be a
     rice-coloured box with a pink bar floating above it, which is a jar. */
  it('gets a slice of fish on top of it', () => {
    render(<Sushi chunks={['have']} />);
    expect(fish()).toHaveLength(1);
  });

  /* One word is one piece of food, however many parts it comes apart into.
     `chocolate` used to be served as three of them, which is a plate where
     there is one word. */
  it('is one piece however many parts the word comes in', () => {
    render(<Sushi chunks={['choc', 'o', 'late']} />);
    expect(fish()).toHaveLength(1);
  });

  it('marks each seam with a dot', () => {
    render(<Sushi chunks={['choc', 'o', 'late']} />);
    expect(screen.getAllByTestId('seam')).toHaveLength(2);
  });

  it('leaves a word that comes apart nowhere undotted', () => {
    render(<Sushi chunks={['have']} />);
    expect(screen.queryAllByTestId('seam')).toHaveLength(0);
  });

  it('shows every piece of the word', () => {
    render(<Sushi chunks={['drag', 'on']} />);
    expect(screen.getByTestId('sushi')).toHaveTextContent('drag·on');
  });
});

describe('the dab of wasabi', () => {
  it('sits on exactly the letters that misbehave', () => {
    // `said` — the `ai` lies, the `s` and the `d` do not
    render(<Sushi chunks={['said']} tricky={{ start: 1, end: 3 }} />);
    expect(screen.getAllByTestId('lying-letter').map((el) => el.textContent)).toEqual([
      'a',
      'i',
    ]);
  });

  /* The span is measured in the whole word, so it has to survive the word being
     cut into pieces: the `o` of `dragon` is letter five, not letter one. */
  it('finds them in a word that arrives in pieces', () => {
    render(<Sushi chunks={['drag', 'on']} tricky={{ start: 4, end: 5 }} />);
    expect(screen.getAllByTestId('lying-letter').map((el) => el.textContent)).toEqual(['o']);
  });

  it('is drawn nowhere at all when nothing was passed', () => {
    render(<Sushi chunks={['said']} />);
    expect(screen.queryAllByTestId('lying-letter')).toHaveLength(0);
  });
});
