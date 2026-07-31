import { Image, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { FIRE, FIRE_HOT } from '@/theme';

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
 * The dragon: a sushi chef, facing you across his counter.
 *
 * It was drawn here in code twice. First in profile, where it read as a green
 * hippo — a big featureless flank with one eye stranded near the top of it.
 * Then facing forward, which fixed the reading but was still plainly a shape
 * made of circles, and a five-year-old can tell a character from an icon.
 *
 * So it is five rendered images now, one per face. Everything the game asks
 * for still works the same way: `mood` picks the face, a nearly finished meal
 * picks the full one, and the fire is drawn over the top in code, because it
 * has to arrive and leave on cue.
 *
 * The images carry the night-blue of the room baked into their background.
 * That is deliberate: a cut-out with a soft edge shows a grey halo against
 * this background, and there is nowhere in the game where the dragon sits on
 * anything else.
 */
const FACES = {
  idle: require('../../assets/images/dragon/idle.png'),
  happy: require('../../assets/images/dragon/happy.png'),
  chewing: require('../../assets/images/dragon/chewing.png'),
  puzzled: require('../../assets/images/dragon/puzzled.png'),
  /** eyes half closed, belly round — the end of a meal */
  full: require('../../assets/images/dragon/full.png'),
};

export function Dragon({ mood = 'idle', fullness = 0, breathing = false, size = 260 }: Props) {
  /* A full dragon outranks a calm one, but never a chewing or a puzzled one:
     those two are answers to something he did a moment ago, so they must show. */
  const settled = mood === 'idle' || mood === 'happy';
  const face = fullness > 0.8 && settled ? FACES.full : FACES[mood];

  // a fed dragon sinks a little into its seat
  const settle = fullness * 5;

  return (
    <View style={{ width: size, height: size, transform: [{ translateY: settle }] }}>
      <Image
        source={face}
        style={styles.face}
        resizeMode="contain"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />

      {/* The aburi torch: a searing breath, aimed off the counter. Over the
          image, because fire is in front of what it is searing. */}
      {breathing && (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <G opacity={0.95}>
            <Path
              d="M104 112 C128 108, 156 88, 176 56 C174 80, 164 96, 150 106 C136 114, 120 118, 103 120 Z"
              fill={FIRE}
            />
            <Path
              d="M108 114 C130 110, 152 92, 166 68 C164 86, 155 98, 144 105 C132 111, 119 114, 107 116 Z"
              fill={FIRE_HOT}
            />
            {/* two licks past the tip, which is what stops it reading as a leaf */}
            <Path d="M182 44 C188 50, 184 58, 178 56 C180 52, 180 48, 182 44 Z" fill={FIRE_HOT} />
            <Path d="M168 40 C174 45, 171 52, 166 50 C168 47, 167 43, 168 40 Z" fill={FIRE} />
          </G>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { width: '100%', height: '100%' },
});
