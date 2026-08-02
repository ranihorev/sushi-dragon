const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * The entitlements this module cannot work without.
 *
 * These used to come from `ios.usesIcloudStorage: true` in app.json, which
 * sounds like a property of the app and is really a feature of the
 * `expo-document-picker` config plugin. Deleting the manual backup deleted the
 * document picker, which silently emptied the entitlements file — the app still
 * built, still ran, and simply had no iCloud container to find. Nothing about
 * that failure says "you removed a package you were not using".
 *
 * So the module that needs the entitlements asks for them. It cannot now be
 * separated from them by anybody tidying up somewhere else.
 */
module.exports = function withSushiICloud(config) {
  return withEntitlementsPlist(config, (withPlist) => {
    const bundleId = withPlist.ios?.bundleIdentifier;
    if (!bundleId) throw new Error('sushi-icloud needs ios.bundleIdentifier to name its container');

    const container = `iCloud.${bundleId}`;
    withPlist.modResults['com.apple.developer.icloud-container-identifiers'] = [container];
    withPlist.modResults['com.apple.developer.ubiquity-container-identifiers'] = [container];
    /* Documents rather than key-value: the recordings are far past what the
       key-value store holds, and splitting the words across two mechanisms to
       save a few kilobytes would buy two ways for them to disagree. */
    withPlist.modResults['com.apple.developer.icloud-services'] = ['CloudDocuments'];

    return withPlist;
  });
};
