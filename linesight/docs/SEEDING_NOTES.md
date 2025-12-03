# Seeding Notes

## Canonical seed
- Use `scripts/seed.ts` as the only supported seed. `scripts/seed.mjs` remains for legacy/demo only and is not maintained.
- Deterministic randomness: control with `SEED_RANDOM_SEED` (default 142857). Repeatable runs produce identical data when the seed and unit count match.
- Unit count: control with `SEED_UNIT_COUNT` (or `SEED_UNITS` fallback). Default is 200.
- Database: `DATABASE_URL` should point to the SQLite file (default `file:./dev.db`).

## Commands
- Run seed (example):
  ```bash
  DATABASE_URL="file:./dev.db" SEED_UNIT_COUNT=200 SEED_RANDOM_SEED=142857 node --import tsx scripts/seed.ts
  ```
- Check health counts after seeding:
  ```bash
  DATABASE_URL="file:./dev.db" node --import tsx -e "import('./src/app/api/debug/health/route.ts').then(async ({GET})=>{const r=await GET(); console.log(await r.json());});"
  ```

## Expected health (approx)
- With defaults, expect non-zero counts across step definitions, CTQs, units, kits, executions, measurements, component lots, fixtures, and episodes. `/api/debug/health` should return `ok: true` with populated counts.

## Notes
- No live trickle-insert is implemented yet; seeds are static per run.
- Do not modify generated Prisma client; only adjust `scripts/seed.ts` if seed content changes.
