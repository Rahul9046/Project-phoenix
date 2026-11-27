#!/usr/bin/env bash
#
# Package Eraya's Android signing credentials into one encrypted archive, then
# prove the archive can actually restore them.
#
# Losing this key means no existing install can ever be updated again, by
# anyone. There is no recovery and no authority to appeal to -- unlike the Play
# upload key, which Google can reset. So this script does not stop at "an
# archive was written": it decrypts the archive into a scratch directory, reads
# the keystore out of it with the password the archive itself carries, and
# refuses to report success unless the certificate fingerprint matches the
# approved production identity.
#
# That last step earned its place. An earlier backup of this key passed a
# checksum comparison perfectly while being unreadable, because a permissions
# change had stripped every ACE from the files. A backup nobody has restored
# from is not a backup.
#
# Usage, from the repository root:
#
#   bash scripts/backup-signing-key.sh                 # write + verify
#   bash scripts/backup-signing-key.sh --verify-only <archive>
#
# You are prompted for a passphrase. Choose one you already keep in your
# password manager, and NOT the keystore's own password -- one secret that
# unlocks both the archive and the key inside it is one secret.
#
# The passphrase is never passed on a command line, never written to disk, and
# never echoed. gpg reads it from the terminal directly.

set -euo pipefail

# The identity this script exists to protect. A restore that produces anything
# else is a failed restore, however healthy the archive looked.
EXPECTED_SHA256="DD:86:91:2D:48:40:71:32:5C:87:4A:AC:0C:4E:84:A0:B7:BA:06:C8:0D:15:9D:44:5B:84:BA:E0:81:AA:FD:3C"

SIGNING_DIR="${ERAYA_SIGNING_DIR:-$HOME/.eraya/signing}"
OUT_DIR="${ERAYA_BACKUP_OUT:-$HOME/eraya-signing-backups}"
JDK17="${ERAYA_JDK17:-$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2}"
KEYTOOL="$JDK17/bin/keytool"
[ -x "$KEYTOOL" ] || KEYTOOL="$JDK17/bin/keytool.exe"

say()  { printf '%s\n' "$*"; }
fail() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

command -v gpg >/dev/null 2>&1 || fail "gpg is not on PATH."
[ -x "$KEYTOOL" ] || fail "keytool not found at $JDK17/bin. Set ERAYA_JDK17."

# ---------------------------------------------------------------------------
# The restore test. Given an encrypted archive, unpack it somewhere disposable
# and ask keytool what identity came back out.
# ---------------------------------------------------------------------------
restore_test() {
  local archive="$1"
  local scratch
  scratch="$(mktemp -d)"

  # Whatever happens below -- success, mismatch, interrupt -- the decrypted
  # private key does not survive this function.
  # shellcheck disable=SC2064
  trap "secure_rm '$scratch'" RETURN

  say "  decrypting into a scratch directory..."
  gpg --quiet --decrypt "$archive" 2>/dev/null | tar -xJ -C "$scratch" \
    || fail "could not decrypt or unpack the archive (wrong passphrase, or it is damaged)"

  local store props
  store="$scratch/signing/eraya-release.p12"
  props="$scratch/signing/eraya-release.properties"
  [ -f "$store" ] || fail "the archive does not contain signing/eraya-release.p12"
  [ -f "$props" ] || fail "the archive does not contain signing/eraya-release.properties"

  # Read the store password out of the RESTORED properties file, not the live
  # one. That is the point: it proves the archive is self-sufficient.
  local pass
  pass="$(grep -E '^ERAYA_RELEASE_STORE_PASSWORD=' "$props" | cut -d= -f2-)"
  [ -n "$pass" ] || fail "the restored properties file carries no store password"
  local alias_name
  alias_name="$(grep -E '^ERAYA_RELEASE_KEY_ALIAS=' "$props" | cut -d= -f2-)"

  say "  reading the restored keystore with keytool..."
  local got
  got="$(ERAYA_P="$pass" "$KEYTOOL" -list -v \
          -keystore "$store" -alias "$alias_name" -storepass:env ERAYA_P 2>/dev/null \
        | grep -E '^\s+SHA256:' | head -1 | sed 's/.*SHA256: //' | tr -d '\r')"
  unset pass

  [ -n "$got" ] || fail "keytool could not read the restored keystore"

  if [ "$got" != "$EXPECTED_SHA256" ]; then
    say "  expected: $EXPECTED_SHA256"
    say "  restored: $got"
    fail "the restored certificate is NOT the approved Eraya production identity"
  fi

  say "  restored certificate SHA-256 matches the approved identity"
}

# Overwrite before unlinking. On an SSD with wear levelling this is not a
# guaranteed erase and is not claimed to be one -- it removes the obvious copy
# and defeats casual undelete, which is what is practical here.
secure_rm() {
  local target="$1"
  [ -d "$target" ] || return 0
  find "$target" -type f -exec sh -c 'dd if=/dev/urandom of="$1" bs=1k count=8 conv=notrunc 2>/dev/null || true' _ {} \;
  rm -rf "$target"
}

# ---------------------------------------------------------------------------
if [ "${1:-}" = "--verify-only" ]; then
  [ -n "${2:-}" ] || fail "--verify-only needs an archive path"
  [ -f "$2" ] || fail "no such archive: $2"
  say "Verifying $2"
  say "  sha256: $(sha256sum "$2" | cut -d' ' -f1)"
  restore_test "$2"
  say ""
  say "ARCHIVE VERIFIED. It restores the approved production signing identity."
  exit 0
fi

# ---------------------------------------------------------------------------
[ -d "$SIGNING_DIR" ] || fail "no signing directory at $SIGNING_DIR"
[ -f "$SIGNING_DIR/eraya-release.p12" ] || fail "no keystore in $SIGNING_DIR"

mkdir -p "$OUT_DIR"
STAMP="${ERAYA_BACKUP_STAMP:-$(date +%Y%m%d)}"
ARCHIVE="$OUT_DIR/eraya-signing-$STAMP.tar.xz.gpg"

[ -e "$ARCHIVE" ] && fail "$ARCHIVE already exists. Move it aside rather than overwriting a backup."

say "Backing up: $SIGNING_DIR"
say "Contents:"
(cd "$SIGNING_DIR/.." && find signing -type f | sed 's/^/  /')
say ""
say "You will be asked for a passphrase twice."
say "Use one from your password manager, NOT the keystore's own password."
say ""

TMP_TAR="$(mktemp -d)/eraya-signing.tar.xz"
trap 'secure_rm "$(dirname "$TMP_TAR")"' EXIT

tar -cJf "$TMP_TAR" -C "$SIGNING_DIR/.." signing \
  || fail "could not create the archive"

# --symmetric: a passphrase, not a keypair. Nothing to lose but the passphrase,
# and nothing on this machine that could decrypt it on its own.
gpg --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 \
    --output "$ARCHIVE" "$TMP_TAR" \
  || fail "gpg encryption failed"

secure_rm "$(dirname "$TMP_TAR")"
trap - EXIT

say ""
say "Written: $ARCHIVE"
say "  size:   $(stat -c %s "$ARCHIVE") bytes"
say "  sha256: $(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
say ""
say "Restore test (this is the part that matters):"
restore_test "$ARCHIVE"

say ""
say "BACKUP VERIFIED."
say ""
say "It is NOT yet an off-device backup. Copy it to a USB drive or another"
say "machine, then confirm the copy on that device restores too:"
say ""
say "  cp \"$ARCHIVE\" /e/            # or wherever the drive mounts"
say "  bash scripts/backup-signing-key.sh --verify-only /e/$(basename "$ARCHIVE")"
say ""
say "Store the passphrase in your password manager. Without it this file is"
say "scrap, and the signing identity is only as safe as the disk it sits on."
