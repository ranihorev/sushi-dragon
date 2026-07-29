import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cat } from '@/components/Cat';
import { Dragon } from '@/components/Dragon';
import { CREAM, LANTERN, NIGHT, WOOD, WOOD_DARK } from '@/theme';

/**
 * Two doors.
 *
 * The letter game and the word game are different enough that he should be
 * choosing between them rather than finding one buried inside the other — and
 * at this age choosing is most of the motivation. No reading is required to
 * use this screen: the animal is the label.
 */
export default function TitleScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.doors}>
        <Link href="/cat/play" asChild>
          <Pressable style={styles.door} accessibilityRole="button" accessibilityLabel="the cat">
            <Cat fullness={0} mood="happy" size={210} />
            <View style={styles.counter} />
            <Text style={styles.name}>letters</Text>
          </Pressable>
        </Link>

        <Link href="/dragon/play" asChild>
          <Pressable style={styles.door} accessibilityRole="button" accessibilityLabel="the dragon">
            <Dragon fullness={0} mood="happy" size={210} />
            <View style={styles.counter} />
            <Text style={styles.name}>words</Text>
          </Pressable>
        </Link>
      </View>

      <Link href="/dragon/parent" asChild>
        <Pressable
          style={styles.parent}
          accessibilityRole="button"
          accessibilityLabel="grown-ups"
          hitSlop={12}
        >
          <Text style={styles.parentText}>grown-ups</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT, alignItems: 'center', justifyContent: 'center' },
  doors: { flexDirection: 'row', gap: 40, alignItems: 'flex-end' },
  door: { alignItems: 'center' },
  counter: {
    width: 250,
    height: 14,
    marginTop: -22,
    borderRadius: 5,
    backgroundColor: WOOD,
    borderBottomWidth: 5,
    borderBottomColor: WOOD_DARK,
  },
  name: {
    color: CREAM,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 16,
  },
  parent: { position: 'absolute', right: 22, bottom: 16, padding: 8 },
  parentText: { color: LANTERN, opacity: 0.55, fontSize: 13 },
});
