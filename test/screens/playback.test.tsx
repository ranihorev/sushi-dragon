import { describe, expect, it, vi } from 'vitest';

import { players, resetAudio } from '../stubs/expo-audio';
import { hearOnce } from '@/game/playback';

/**
 * The "hear it" button, minus the button.
 *
 * Holding to record cannot be driven from a test — the touch responder needs a
 * real finger — so the part with the state in it lives in a module and is
 * checked here instead.
 */
describe('hearing a take back', () => {
  const start = () => {
    resetAudio();
    const playing = vi.fn();
    const cancel = hearOnce('file:///take.m4a', playing);
    return { playing, cancel, player: players[0] };
  };

  it('reports that it is playing, and plays', () => {
    const { playing, player } = start();
    expect(playing).toHaveBeenLastCalledWith(true);
    expect(player.played).toBe(true);
  });

  it('reports the end when the sound finishes, and lets the player go', () => {
    const { playing, player } = start();
    player.finish();
    expect(playing).toHaveBeenLastCalledWith(false);
    expect(player.removed).toBe(true);
  });

  it('ends once, however many times the sound says it finished', () => {
    const { playing, player } = start();
    player.finish();
    player.finish();
    expect(playing.mock.calls.filter(([on]) => on === false)).toHaveLength(1);
  });

  it('does not leave the button stuck on a take that never reports finishing', () => {
    vi.useFakeTimers();
    const { playing, player } = start();
    vi.advanceTimersByTime(6000);
    expect(playing).toHaveBeenLastCalledWith(false);
    expect(player.removed).toBe(true);
    vi.useRealTimers();
  });

  it('stops when the caller cancels', () => {
    const { playing, cancel, player } = start();
    cancel();
    expect(playing).toHaveBeenLastCalledWith(false);
    expect(player.removed).toBe(true);
  });
});
