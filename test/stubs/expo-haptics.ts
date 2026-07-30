import { vi } from 'vitest';

export const impactAsync = vi.fn(async () => {});
export const selectionAsync = vi.fn(async () => {});
export const notificationAsync = vi.fn(async () => {});

export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' } as const;
export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;
