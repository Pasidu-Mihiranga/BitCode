#!/usr/bin/env bash
# Seed N pre-verified load-test users straight into Postgres so the k6
# script doesn't get blocked by email verification or the auth rate limiter.
#
# Usage:
#   N=1000 ./load-test/seed-users.sh
#
# Password for all of them: LoadTest#12345  (argon2id hash below pre-computed
# with the same OWASP params; regenerate with bun apps/api/src/seed.ts if you
# change PASSWORDS_FILE).

set -euo pipefail
N="${N:-1000}"
DB_URL="${DATABASE_URL:-postgres://swiftdrop:swiftdrop@localhost:5432/swiftdrop}"

# argon2id($argon2id$v=19$m=19456,t=2,p=1$...) for LoadTest#12345
HASH="$(docker compose exec -T api1 bun -e "import('/app/src/shared/hash.ts').then(async ({ hashPassword }) => console.log(await hashPassword('LoadTest#12345')))" 2>/dev/null | tail -n 1)"
if [[ -z "$HASH" ]]; then
  echo "Could not compute argon2 hash via api1 container — is the stack running?"
  exit 1
fi

echo "Seeding $N load-test users…"
SQL=""
for i in $(seq 1 "$N"); do
  EMAIL="loadtest+${i}@swiftdrop.local"
  SQL+="INSERT INTO users (email, password_hash, display_name, role, status) VALUES ('${EMAIL}', '${HASH}', 'Load #${i}', 'customer', 'active') ON CONFLICT DO NOTHING;
"
done

docker compose exec -T postgres psql -U swiftdrop -d swiftdrop -v ON_ERROR_STOP=1 <<< "$SQL"
echo "Done."
