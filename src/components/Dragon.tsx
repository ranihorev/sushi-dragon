import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { BELLY, FIRE, FIRE_HOT, HORN, INK, SCALE, SCALE_DARK } from '@/theme';

export type Mood = 'idle' | 'happy' | 'puzzled' | 'chewing';

interface Props {
  mood?: Mood;
  /** how much of the meal has been eaten, 0..1 — the dragon settles as it fills */
  fullness?: number;
  /** breathing fire, for searing a word he has not met before */
  breathing?: boolean;
  size?: number;
}

/**
 * The dragon, drawn from the side behind its counter.
 *
 * Everything it does is driven by `mood` and `fullness` alone, so the rest of
 * the game never has to know how it is put together, and it can be redrawn
 * without touching anything else.
 */
export function Dragon({ mood = 'idle', fullness = 0, breathing = false, size = 260 }: Props) {
  const happy = mood === 'happy';
  const puzzled = mood === 'puzzled';
  const chewing = mood === 'chewing';

  // a fed dragon sinks a little and half-closes its eyes
  const settle = fullness * 6;
  const lidY = 40 + (happy ? 3 : 0) + fullness * 2;
  const jaw = chewing ? 6 : happy ? 3 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <G translateY={settle}>
        {breathing && (
          <G opacity={0.95}>
            {/* the aburi torch: a searing breath aimed along the counter */}
            <Path d="M148 96 C170 88, 196 96, 200 104 C196 118, 170 124, 148 112 Z" fill={FIRE} />
            <Path d="M150 102 C168 97, 186 102, 190 105 C186 112, 168 115, 150 108 Z" fill={FIRE_HOT} />
          </G>
        )}

        {/* tail curling out behind */}
        <Path
          d="M24 150 C4 146, 8 118, 30 118 C22 132, 30 140, 44 140 Z"
          fill={SCALE_DARK}
        />

        {/* body */}
        <Ellipse cx="82" cy="132" rx="56" ry="42" fill={SCALE} />
        <Ellipse cx="88" cy="142" rx="38" ry="27" fill={BELLY} opacity={0.85} />

        {/* wing, folded */}
        <Path
          d="M62 104 C50 78, 82 68, 96 88 C86 92, 74 98, 62 104 Z"
          fill={SCALE_DARK}
          opacity={0.9}
        />

        {/* neck and head */}
        <Path d="M104 118 C104 92, 112 74, 130 68 L150 92 C138 100, 128 112, 126 126 Z" fill={SCALE} />
        <Ellipse cx="140" cy="72" rx="34" ry="27" fill={SCALE} />

        {/* snout */}
        <Path
          d={`M158 68 C178 66, 186 74, 186 ${80 + jaw} C176 ${86 + jaw}, 162 ${84 + jaw}, 156 78 Z`}
          fill={SCALE}
        />
        <Circle cx="178" cy="72" r="2.6" fill={INK} opacity={0.7} />

        {/* horns */}
        <Path d="M126 48 C122 34, 130 26, 138 30 C134 38, 133 44, 134 50 Z" fill={HORN} />
        <Path d="M144 46 C144 34, 152 30, 157 34 C151 40, 149 44, 150 50 Z" fill={HORN} />

        {/* the ridge down its back */}
        <Path d="M70 96 L78 82 L86 96 Z" fill={HORN} opacity={0.9} />
        <Path d="M50 104 L58 90 L66 104 Z" fill={HORN} opacity={0.9} />

        {/* eye — the only part that carries the mood */}
        {happy || fullness > 0.85 ? (
          <Path
            d={`M${132} ${lidY} q7 -7 14 0`}
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <>
            <Ellipse cx="139" cy={lidY + 2} rx="7" ry={puzzled ? 8 : 7} fill="#fff" />
            <Circle cx={puzzled ? 141 : 140} cy={lidY + 3} r="3.6" fill={INK} />
          </>
        )}

        {/* a raised brow does all the work of looking puzzled */}
        {puzzled && (
          <Path
            d="M130 30 q9 -6 18 -1"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
            opacity={0.75}
          />
        )}
      </G>
    </Svg>
  );
}
