import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { router } from '../../test/stubs/expo-router';
import { HomeButton } from './HomeButton';

describe('the way out', () => {
  it('is a button a child can find without reading', () => {
    render(<HomeButton />);
    expect(screen.getByRole('button', { name: /back to the front/i })).toBeInTheDocument();
  });

  it('goes to the front, not back through the meal', () => {
    /* `replace` rather than `push`: leaving mid-meal must not leave the
       half-played game on the stack for a stray swipe to fall back into. */
    render(<HomeButton />);
    fireEvent.click(screen.getByRole('button', { name: /back to the front/i }));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.push).not.toHaveBeenCalled();
  });
});
