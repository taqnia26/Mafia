import bcrypt from "bcrypt";
import { Pool } from "pg";

async function main() {
  const password = process.argv[2] ?? process.env.SUPER_ADMIN_PASSWORD;
  const username = (process.argv[3] ?? "superadmin").trim().toLowerCase();

  if (!password) {
    console.error("Usage: tsx scripts/reset-super-admin.ts <password> [username]");
    console.error("   or: SUPER_ADMIN_PASSWORD=... tsx scripts/reset-super-admin.ts");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  `);

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO admin_credentials (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash],
  );

  const { rows } = await pool.query<{ id: number; username: string }>(
    "SELECT id, username FROM admin_credentials WHERE username = $1",
    [username],
  );
  console.log(`OK — super admin upserted: id=${rows[0].id} username=${rows[0].username}`);
  await pool.end();
}

main().catch((e) => {
  console.error("Reset failed:", e);
  process.exit(1);
});
