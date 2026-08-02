import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { RICE, SEAM } from '@/theme';

export type Mood = 'idle' | 'happy' | 'puzzled' | 'chewing';

interface Props {
  mood?: Mood;
  /** how much of the meal has been eaten, 0..1 — the dragon settles as it fills */
  fullness?: number;
  /** a counter of mouthfuls; every increment sets it gulping */
  chomp?: number;
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
 * for still works the same way: `mood` picks the face and a nearly finished
 * meal picks the full one.
 *
 * There used to be a flame here too, an SVG blob thrown over the top of a
 * rendered dragon while a new word was "seared". Flat vector fire on a shaded
 * drawing looks like a sticker on a photograph, and it went.
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

/**
 * Where the crumbs go.
 *
 * Out and mostly downward, because that is where crumbs go, and asymmetric
 * because six specks in a neat ring reads as a loading spinner.
 */
const CRUMBS = [
  { dx: -30, dy: 10, size: 7 },
  { dx: 26, dy: 16, size: 6 },
  { dx: -16, dy: 30, size: 5 },
  { dx: 14, dy: 34, size: 7 },
  { dx: -38, dy: -6, size: 5 },
  { dx: 34, dy: -2, size: 6 },
];

export function Dragon({ mood = 'idle', fullness = 0, chomp = 0, size = 260 }: Props) {
  /* A full dragon outranks a calm one, but never a chewing or a puzzled one:
     those two are answers to something he did a moment ago, so they must show. */
  const settled = mood === 'idle' || mood === 'happy';
  const face = fullness > 0.8 && settled ? FACES.full : FACES[mood];

  // a fed dragon sinks a little into its seat
  const settle = fullness * 5;

  /**
   * The gulp.
   *
   * Squash on the way down, and a spring back that overshoots into a stretch —
   * which is the whole of it. A dragon that swaps to a chewing face and does
   * not move has not eaten anything; it has changed its mind about its
   * expression.
   */
  const bite = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (!chomp) return;
    bite.value = withSequence(
      withTiming(1, { duration: 90 }),
      withSpring(0, { damping: 11, stiffness: 220 }),
    );
    burst.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 420 }));
  }, [chomp, bite, burst]);

  /* Squash and nothing else. The first version dropped the whole dragon twelve
     points and sprang it back, which does not read as a mouthful — it reads as
     a dragon jumping, at the exact moment the sushi vanishes, so it looks like
     the animal flinched away from its dinner. */
  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: settle },
      { scaleX: 1 + bite.value * 0.05 },
      { scaleY: 1 - bite.value * 0.06 },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, body]}>
      <Image
        source={face}
        style={styles.face}
        resizeMode="contain"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />

      {/* Roughly where the mouth is in the drawing. Nothing is measured: the
          five faces are the same drawing with a different expression. */}
      <View style={[styles.mouth, { top: size * 0.6 }]} pointerEvents="none">
        {CRUMBS.map((crumb, i) => (
          <Crumb key={i} crumb={crumb} burst={burst} />
        ))}
      </View>
    </Animated.View>
  );
}

/** One speck of rice, thrown out of the mouth and gone. */
function Crumb({
  crumb,
  burst,
}: {
  crumb: (typeof CRUMBS)[number];
  burst: { value: number };
}) {
  const style = useAnimatedStyle(() => {
    const t = burst.value;
    return {
      opacity: t === 0 || t === 1 ? 0 : 1 - t,
      transform: [
        { translateX: crumb.dx * t },
        // thrown out, then pulled down: the second half of the arc is gravity
        { translateY: crumb.dy * t + 34 * t * t },
        { scale: 1 - t * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.crumb,
        { width: crumb.size, height: crumb.size, borderRadius: crumb.size / 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  face: { width: '100%', height: '100%' },
  mouth: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crumb: { position: 'absolute', backgroundColor: RICE, borderWidth: 1, borderColor: SEAM },
});
