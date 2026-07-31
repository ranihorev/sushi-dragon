import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dragon } from '@/components/Dragon';
import { CREAM, LANTERN, NIGHT, WOOD, WOOD_DARK } from '@/theme';

/**
 * The door.
 *
 * There were two for a while — the letter game and the word game side by side,
 * because at this age choosing is most of the motivation. The letter game has
 * gone back to the web app it came from, so for now there is one.
 *
 * It is still a door rather than a straight drop into a meal: the grown-up
 * needs somewhere to reach the word list from, and that should not be a corner
 * of the play screen that only one of us knows about.
 *
 * No reading is required to use this screen. The dragon is the label.
 */
export default function TitleScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/dragon/play" asChild>
        <Pressable style={styles.door} accessibilityRole="button" accessibilityLabel="the dragon">
          <Dragon fullness={0} mood="happy" size={260} />
          <View style={styles.counter} />
          <Text style={styles.name}>words</Text>
        </Pressable>
      </Link>

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
  door: { alignItems: 'center' },
  counter: {
    width: 300,
    height: 14,
    marginTop: -26,
    borderRadius: 5,
    backgroundColor: WOOD,
    borderBottomWidth: 5,
    borderBottomColor: WOOD_DARK,
  },
  name: {
    color: CREAM,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 18,
  },
  parent: { position: 'absolute', right: 22, bottom: 16, padding: 8 },
  parentText: { color: LANTERN, opacity: 0.55, fontSize: 13 },
});
