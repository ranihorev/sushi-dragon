import { memo, useEffect, useState } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

export type Mood = 'idle' | 'anticipate' | 'eating' | 'confused' | 'happy' | 'asleep';

interface Props {
  /** 0..1 — the cat rounds out as the meal goes on */
  fullness: number;
  mood: Mood;
  /** -1..1 — which way the eyes drift */
  look?: number;
  size?: number;
}

const FUR = '#FFF7EA';
const FUR_SHADE = '#F2E4CE';
const NORI = '#20302A';
const INK = '#20302A';
const BLUSH = '#FFB3A0';

/* One drawing, driven entirely by { fullness, mood }. Nothing about the game
   reaches in here — the same arrangement that let this be redrawn on the web
   without touching anything else is what let it move platforms.

   The small idle behaviours — blinking, ear twitches — are what stop it reading
   as a static picture. They run on their own timers so the game never has to
   think about them. */
function CatArt({ fullness, mood, look = 0, size = 300 }: Props) {
  const [blinking, setBlinking] = useState(false);
  const [fidget, setFidget] = useState<'none' | 'ear' | 'tail'>('none');
  const [chewing, setChewing] = useState(false);

  const restful = mood === 'idle' || mood === 'anticipate';

  // blink on a human-ish irregular rhythm, sometimes twice
  useEffect(() => {
    if (!restful && mood !== 'confused') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(
        () => {
          if (stopped) return;
          setBlinking(true);
          setTimeout(() => {
            setBlinking(false);
            if (Math.random() < 0.3) {
              setTimeout(() => {
                setBlinking(true);
                setTimeout(() => setBlinking(false), 110);
              }, 150);
            }
            schedule();
          }, 120);
        },
        2200 + Math.random() * 3800,
      );
    };
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [restful, mood]);

  // an ear twitch or a tail flick now and then
  useEffect(() => {
    if (!restful) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          if (stopped) return;
          setFidget(Math.random() < 0.55 ? 'ear' : 'tail');
          setTimeout(() => setFidget('none'), 700);
          schedule();
        },
        3500 + Math.random() * 4500,
      );
    };
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [restful]);

  // eating is a sequence, not a pose: mouth opens, then chews
  useEffect(() => {
    if (mood !== 'eating') {
      setChewing(false);
      return;
    }
    const t = setTimeout(() => setChewing(true), 340);
    return () => clearTimeout(t);
  }, [mood]);

  const eating = mood === 'eating';
  const anticipating = mood === 'anticipate';
  const asleep = mood === 'asleep';
  const confused = mood === 'confused';
  const happy = mood === 'happy';

  const grow = 1 + fullness * 0.16;
  const px = look * 3.2;
  const eyesClosed = asleep || happy || (eating && chewing) || blinking;

  const eye = (cx: number, key: string) => {
    if (eyesClosed) {
      // closed and curving up when pleased, flat when merely blinking
      const dir = happy || eating || asleep ? -1 : 0.15;
      return (
        <Path
          key={key}
          d={`M ${cx - 9} 101 q 9 ${8 * dir} 18 0`}
          stroke={INK}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      );
    }
    // pupils widen when a piece is on the way in
    const r = anticipating ? 1.18 : 1;
    return (
      <G key={key}>
        <Ellipse cx={cx + px} cy={100} rx={8.5 * r} ry={10 * r} fill={INK} />
        <Circle cx={cx + px + 3} cy={96} r={3 * r} fill="#fff" />
        <Circle cx={cx + px - 2.5} cy={103.5} r={1.5} fill="#fff" opacity={0.75} />
      </G>
    );
  };

  const mouth = eating ? (
    <G>
      <Ellipse cx={120} cy={127} rx={chewing ? 11 : 17} ry={chewing ? 9 : 15} fill="#7A2E33" />
      <Ellipse cx={120} cy={chewing ? 131 : 134} rx={chewing ? 7 : 10} ry={5} fill="#F4837E" />
    </G>
  ) : anticipating ? (
    <Ellipse cx={120} cy={126} rx={11} ry={10} fill="#7A2E33" />
  ) : confused ? (
    <Path
      d="M 110 126 q 5 -5 10 0 q 5 5 10 0"
      stroke={INK}
      strokeWidth={3}
      fill="none"
      strokeLinecap="round"
    />
  ) : happy ? (
    <G>
      <Path
        d="M 106 122 q 14 16 28 0"
        stroke={INK}
        strokeWidth={3.4}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M 111 128 q 9 8 18 0" fill="#F4837E" />
    </G>
  ) : asleep ? (
    <Path
      d="M 114 124 q 6 5 12 0"
      stroke={INK}
      strokeWidth={3}
      fill="none"
      strokeLinecap="round"
    />
  ) : (
    <G stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round">
      <Path d="M 108 123 q 6 7 12 0" />
      <Path d="M 120 123 q 6 7 12 0" />
    </G>
  );

  return (
    <Svg width={size} height={size * (210 / 240)} viewBox="0 0 240 210">
      <Defs>
        <RadialGradient id="fur" cx="42%" cy="30%" r="78%">
          <Stop offset="0%" stopColor="#FFFDF7" />
          <Stop offset="100%" stopColor={FUR} />
        </RadialGradient>
        <RadialGradient id="chin" cx="50%" cy="50%" r="50%">
          <Stop offset="52%" stopColor="#000" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="band" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#2B4038" />
          <Stop offset="50%" stopColor={NORI} />
          <Stop offset="100%" stopColor="#2B4038" />
        </LinearGradient>
      </Defs>

      {/* ground shadow — grows with the cat */}
      <Ellipse cx={120} cy={196} rx={64 * grow} ry={9} fill="rgba(0,0,0,0.28)" />

      <G scale={grow} originX={120} originY={196}>
        {/* tail — tapered rather than a uniform stroke, so it reads as part of
            the animal instead of a rope stuck to its side */}
        <Path
          d="M 166 186 C 202 192, 222 170, 212 136 C 209 125, 202 117, 198 122 C 205 134, 204 154, 187 164 C 179 169, 172 171, 166 172 Z"
          fill={FUR}
          rotation={fidget === 'tail' ? -8 : 0}
          originX={168}
          originY={180}
        />

        {/* body — a sitting silhouette, wide at the base, narrowing to the
            shoulders. An ellipse read as a ball with a head stuck on it. */}
        <Path
          d="M 62 196 C 55 189, 52 178, 52 164 C 52 136, 82 118, 120 118 C 158 118, 188 136, 188 164 C 188 178, 185 189, 178 196 Z"
          fill="url(#fur)"
        />
        <Ellipse cx={120} cy={170} rx={40} ry={27} fill={FUR_SHADE} opacity={0.38} />

        {/* front paws */}
        <Ellipse cx={93} cy={190} rx={18} ry={10} fill="url(#fur)" />
        <Ellipse cx={147} cy={190} rx={18} ry={10} fill="url(#fur)" />
        <G stroke={FUR_SHADE} strokeWidth={1.6} strokeLinecap="round">
          <Line x1={89} y1={185} x2={89} y2={193} />
          <Line x1={97} y1={184} x2={97} y2={193} />
          <Line x1={143} y1={185} x2={143} y2={193} />
          <Line x1={151} y1={184} x2={151} y2={193} />
        </G>

        {/* the head casts onto the chest — without this the two shapes merge
            into one blob and the cat has no chin */}
        <Ellipse cx={120} cy={118} rx={58} ry={48} fill="url(#chin)" />

        <G rotation={confused ? -7 : 0} originX={120} originY={140}>
          {/* ears, behind the head so their bases disappear into it */}
          <G rotation={fidget === 'ear' ? -9 : 0} originX={80} originY={76}>
            <Path d="M 78 80 L 63 26 L 112 58 Z" fill="url(#fur)" />
            <Path d="M 85 73 L 75 40 L 104 60 Z" fill={BLUSH} />
          </G>
          <Path d="M 162 80 L 177 26 L 128 58 Z" fill="url(#fur)" />
          <Path d="M 155 73 L 165 40 L 136 60 Z" fill={BLUSH} />

          <Ellipse cx={120} cy={98} rx={55} ry={49} fill="url(#fur)" />

          {/* hachimaki — follows the curve of the forehead */}
          <Path d="M 67 82 Q 120 61 173 82 L 173 94 Q 120 73 67 94 Z" fill="url(#band)" />
          <Circle cx={120} cy={74} r={6.5} fill="#FF8A65" />

          {eye(100, 'left')}
          {eye(140, 'right')}

          {/* blush — deepens when pleased or full */}
          <Ellipse
            cx={91}
            cy={131}
            rx={10.5}
            ry={6.5}
            fill={BLUSH}
            opacity={happy || eating ? 0.78 : 0.42 + fullness * 0.25}
          />
          <Ellipse
            cx={149}
            cy={131}
            rx={10.5}
            ry={6.5}
            fill={BLUSH}
            opacity={happy || eating ? 0.78 : 0.42 + fullness * 0.25}
          />

          <Path d="M 114 114 L 126 114 L 120 121 Z" fill="#FF8A65" />
          <Line x1={120} y1={121} x2={120} y2={124} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />

          {mouth}

          {/* whiskers — rooted at the muzzle and curved. Anchored out at the
              edge of the head they read as scratches floating in air. */}
          <G stroke="#A2988A" strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.75}>
            <Path d="M 108 113 Q 86 109 54 103" />
            <Path d="M 108 120 Q 86 122 52 127" />
            <Path d="M 132 113 Q 154 109 186 103" />
            <Path d="M 132 120 Q 154 122 188 127" />
          </G>
        </G>

        {asleep && (
          <G fill="#BFE3D0">
            <SvgText x={182} y={58} fontSize={22} fontWeight="800" fill="#BFE3D0">
              z
            </SvgText>
            <SvgText x={203} y={40} fontSize={16} fontWeight="800" fill="#BFE3D0">
              z
            </SvgText>
          </G>
        )}
        {confused && (
          <SvgText x={188} y={56} fontSize={40} fontWeight="900" fill="#F7C744">
            ?
          </SvgText>
        )}
        {happy && (
          <G fill="#F7C744">
            <Path d="M 186 52 l 4 10 l 10 4 l -10 4 l -4 10 l -4 -10 l -10 -4 l 10 -4 Z" />
            <Path d="M 46 66 l 3 7 l 7 3 l -7 3 l -3 7 l -3 -7 l -7 -3 l 7 -3 Z" />
            <Path
              d="M 152 44 c -4 -6 -14 -3 -14 5 c 0 7 9 12 14 17 c 5 -5 14 -10 14 -17 c 0 -8 -10 -11 -14 -5 Z"
              fill="#FF8A65"
            />
          </G>
        )}
      </G>
    </Svg>
  );
}

export const Cat = memo(CatArt);
