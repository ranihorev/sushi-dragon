import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HomeButton } from './HomeButton';

describe('the way out', () => {
  it('is a button a child can find without reading', () => {
    render(<HomeButton onPress={() => {}} />);
    expect(screen.getByRole('button', { name: /back to the front/i })).toBeInTheDocument();
  });

  it('puts the meal down where it stands', () => {
    /* It used to navigate to a title screen. The game is the front page now,
       so leaving is a state the screen enters, not a place to go — nothing
       gets pushed on the stack for a stray swipe to fall back into. */
    const put = vi.fn();
    render(<HomeButton onPress={put} />);
    fireEvent.click(screen.getByRole('button', { name: /back to the front/i }));
    expect(put).toHaveBeenCalled();
  });
});
