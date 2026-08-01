/**
 * A bundled sound, imported.
 *
 * Metro turns this into a module id — a number — which is what the audio queue
 * plays. TypeScript needs telling that the file is importable at all.
 */
declare module '*.m4a' {
  const asset: number;
  export default asset;
}
