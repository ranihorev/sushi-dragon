/**
 * Playing what `script.ts` decides to say.
 *
 * The one thing that did not carry over from the web version is its
 * synthesised interface noise — the chomps and chimes were built out of Web
 * Audio oscillators, which has no equivalent here. They are haptic taps now,
 * which land better on a tablet held in two hands and, unlike a sound, cannot
 * talk over the cat.
 */

import * as Haptics from 'expo-haptics';

import * as engine from '../game/audio';
import { CLIPS } from './clips';
import type { Clip } from './script';

const asset = (name: Clip): engine.Sound | null => {
  const bundled = CLIPS[name];
  return bundled === undefined ? null : engine.sound(bundled);
};

/** Play a script in order, cutting off whatever was already speaking. */
export const say = (script: Array<Clip | number>) =>
  engine.speak(
    script
      .map((item) => (typeof item === 'number' ? item : asset(item)))
      .filter((beat): beat is engine.Beat => beat !== null),
  );

export const stop = () => engine.stop();

export const tap = () => void Haptics.selectionAsync();
export const chomp = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
export const happy = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const puzzled = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
export const sparkle = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
