#!/usr/bin/env sh
#
# Renders the auth email template as a viewable page, with the Go template
# placeholders filled in, so the design can be checked without sending anything.
#
# Writes into public/, which is git-ignored for __* files. Delete it when done:
#   rm apps/web/public/__email-preview.html
#
#   sh scripts/preview-email.sh   then open http://localhost:3000/__email-preview.html
set -e

SITE="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"
OUT="apps/web/public/__email-preview.html"

sed -e "s|{{ .SiteURL }}|$SITE|g" \
    -e "s|{{ .TokenHash }}|EXAMPLE_TOKEN_HASH|g" \
    supabase/templates/magic-link.html > "$OUT"

echo "wrote $OUT"
echo "open $SITE/__email-preview.html"
