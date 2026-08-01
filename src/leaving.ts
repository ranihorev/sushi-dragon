import { router } from 'expo-router';

/**
 * The way out of a grown-ups' screen.
 *
 * `router.back()` needs something behind it, and there is not always something
 * behind it. Open the word list from a link, reload the page while you are on
 * it, or come back to a screen the app was killed on, and the stack holds that
 * screen and nothing else — the back arrow then does nothing at all, and logs
 * "The action 'GO_BACK' was not handled by any navigator" where nobody but a
 * developer will read it. The person tapping it just finds themselves stuck on
 * a screen with no exit.
 *
 * So: go back if there is a back, and otherwise go to the game, which is what
 * the arrow means either way.
 */
export function leave() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}
