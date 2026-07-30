import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { pan, tap } from '../../test/stubs/gesture-handler';
import { Carry } from './Carry';

/** The dragon's chin sits at 300; everything above that is its mouth. */
const CHIN = 300;

const carry = (props: Partial<React.ComponentProps<typeof Carry>> = {}) => {
  const onFeed = vi.fn();
  const onTap = vi.fn();
  const onOverChange = vi.fn();
  render(
    <Carry
      enabled
      onFeed={onFeed}
      onTap={onTap}
      dropAboveY={CHIN}
      onOverChange={onOverChange}
      {...props}
    >
      <Text>night</Text>
    </Carry>,
  );
  return { onFeed, onTap, onOverChange };
};

describe('carrying a piece to the dragon', () => {
  it('feeds it when the piece is let go up by its mouth', () => {
    const { onFeed } = carry();
    pan().dragTo(CHIN - 120);
    expect(onFeed).toHaveBeenCalledTimes(1);
  });

  it('does not feed it when the piece is let go back down on the counter', () => {
    const { onFeed } = carry();
    pan().dragTo(CHIN + 200);
    expect(onFeed).not.toHaveBeenCalled();
  });

  it('is a place, not a distance', () => {
    /* The first version fed the dragon after 80 points of upward finger travel,
       which is not the same question at all. A piece hauled a long way up and
       then brought back down to the counter was fed to nothing, and that is
       what "the interactions are off" felt like from the other side of it. */
    const { onFeed } = carry();
    pan().start();
    pan().update({ absoluteY: CHIN - 100, translationY: -300 });
    pan().end({ absoluteY: CHIN + 250, translationY: -300 });
    expect(onFeed).not.toHaveBeenCalled();
  });

  it('accepts a piece that barely had to move', () => {
    // the counterpart: a piece already sitting near the dragon is a short trip
    const { onFeed } = carry();
    pan().end({ absoluteY: CHIN - 10, translationY: -4 });
    expect(onFeed).toHaveBeenCalledTimes(1);
  });

  it('answers a tap, because that is what he tries first', () => {
    /* Five years old: he taps. If tapping does nothing the game is broken, no
       matter how well the dragging works. */
    const { onTap } = carry();
    tap().end();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('does not count a tap as feeding', () => {
    const { onFeed } = carry();
    tap().end();
    expect(onFeed).not.toHaveBeenCalled();
  });

  it('opens the dragon’s mouth as the piece comes over it, and closes it again', () => {
    const { onOverChange } = carry();
    pan().start();
    pan().update({ absoluteY: CHIN - 50 });
    expect(onOverChange).toHaveBeenLastCalledWith(true);
    pan().update({ absoluteY: CHIN + 50 });
    expect(onOverChange).toHaveBeenLastCalledWith(false);
  });

  it('is inert while the dragon is waiting to be told how he did', () => {
    // the grown-up is mid-verdict; another piece going in now scores the wrong round
    const { onFeed, onTap } = carry({ enabled: false });
    pan().dragTo(CHIN - 120);
    tap().end();
    expect(onFeed).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('still shows the word it is carrying', () => {
    carry();
    expect(screen.getByText('night')).toBeInTheDocument();
  });
});
