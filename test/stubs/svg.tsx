/**
 * The drawings, reduced to nothing.
 *
 * What the dragon looks like is not something a test can judge, so the shapes
 * render as nothing at all and only the surrounding structure survives. This
 * keeps a test failure meaning "the game did the wrong thing" rather than
 * "the artwork changed".
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

const Shape = () => null;

export default function Svg({ children }: { children?: ReactNode }) {
  return <View>{children}</View>;
}

export const G = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
export const Defs = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
export const Path = Shape;
export const Circle = Shape;
export const Ellipse = Shape;
export const Rect = Shape;
export const Line = Shape;
export const Polygon = Shape;
export const Polyline = Shape;
export const Stop = Shape;
export const LinearGradient = Shape;
export const RadialGradient = Shape;
export const ClipPath = Shape;
export const Mask = Shape;
export const Text = Shape;
export const TSpan = Shape;
