/**
 * A bundled sound, as far as a test is concerned.
 *
 * The app asks for these with `require`, which in the app is Metro handing back
 * a module id and here is node trying to parse an audio file as JavaScript. The
 * tests care that something was played, never what it sounded like.
 */
export default 'bundled-sound';
