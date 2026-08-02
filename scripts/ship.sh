#!/bin/sh
#
# Everything EAS needs in order to talk to Apple, in exactly one place.
#
# It used to be four copies of the same three environment variables, one per
# `ship:` script, and the copies had drifted: none of them carried
# EXPO_APPLE_TEAM_ID. Without it eas-cli cannot use the App Store Connect key at
# all, so it never authenticates with Apple — and it does not say so. It says
#
#   All credentials are ready to build
#
# and hands the build whichever provisioning profile it saw last, however old
# and whatever it is missing. The build then fails in Xcode, complaining about
# entitlements that are plainly there, and nothing anywhere mentions the
# variable that was missing. That cost an afternoon.
#
# Usage: scripts/ship.sh build --platform ios --profile beta …
#        scripts/ship.sh device:create
#
set -eu

# Overridable, so this works on a machine that keeps the key somewhere else.
export EXPO_APPLE_TEAM_ID="${EXPO_APPLE_TEAM_ID:-Q6S85K68D5}"
export EXPO_ASC_KEY_ID="${EXPO_ASC_KEY_ID:-63597Q5V4W}"
export EXPO_ASC_ISSUER_ID="${EXPO_ASC_ISSUER_ID:-832c7a95-015d-4194-8b8f-06a971830915}"
export EXPO_ASC_API_KEY_PATH="${EXPO_ASC_API_KEY_PATH:-$HOME/Documents/Code/AuthKey_63597Q5V4W.p8}"

# Say which file is missing, rather than letting EAS discover it four minutes in.
if [ ! -f "$EXPO_ASC_API_KEY_PATH" ]; then
  echo "No App Store Connect key at $EXPO_ASC_API_KEY_PATH" >&2
  echo "Set EXPO_ASC_API_KEY_PATH to wherever the .p8 lives." >&2
  exit 1
fi

# The local eas-cli, not whatever is installed globally. See eas.json's
# cli.version, which refuses anything older than the version that works.
exec ./node_modules/.bin/eas "$@"
