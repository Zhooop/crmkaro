import { Pool } from "pg";

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;

if (!directDatabaseUrl || !applicationDatabaseUrl) {
  throw new Error("DIRECT_DATABASE_URL and DATABASE_URL are required.");
}

const organisationA = "10000000-0000-4000-8000-000000000001";
const organisationB = "10000000-0000-4000-8000-000000000002";
const ownerPool = new Pool({ connectionString: directDatabaseUrl });
const applicationPool = new Pool({ connectionString: applicationDatabaseUrl });

async function verifyTenantIsolation() {
  await ownerPool.query(
    `INSERT INTO organisations (id, name, slug, timezone, currency, status, created_at, updated_at)
     VALUES
       ($1, 'Tenant A', 'tenant-a-rls-test', 'Asia/Kolkata', 'INR', 'ACTIVE', now(), now()),
       ($2, 'Tenant B', 'tenant-b-rls-test', 'Asia/Kolkata', 'INR', 'ACTIVE', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [organisationA, organisationB],
  );
  await ownerPool.query(
    `INSERT INTO people (id, organisation_id, display_name, status, created_at, updated_at)
     VALUES
       ('20000000-0000-4000-8000-000000000001', $1, 'Tenant A Person', 'ACTIVE', now(), now()),
       ('20000000-0000-4000-8000-000000000002', $2, 'Tenant B Person', 'ACTIVE', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [organisationA, organisationB],
  );

  const connection = await applicationPool.connect();

  try {
    await connection.query("BEGIN");

    const noContext = await connection.query<{ id: string }>("SELECT id FROM organisations");
    if (noContext.rowCount !== 0) {
      throw new Error("RLS failed: rows were visible without tenant context.");
    }

    await connection.query("SELECT set_config('app.current_organisation_id', $1, true)", [organisationA]);
    const tenantRows = await connection.query<{ id: string }>("SELECT id FROM organisations ORDER BY id");

    if (tenantRows.rowCount !== 1 || tenantRows.rows[0]?.id !== organisationA) {
      throw new Error("RLS failed: tenant A did not receive exactly its own row.");
    }

    const crossTenantUpdate = await connection.query(
      "UPDATE organisations SET name = 'Blocked update' WHERE id = $1",
      [organisationB],
    );

    if (crossTenantUpdate.rowCount !== 0) {
      throw new Error("RLS failed: tenant A modified tenant B.");
    }

    const peopleRows = await connection.query<{ organisation_id: string }>("SELECT organisation_id FROM people");
    if (peopleRows.rowCount !== 1 || peopleRows.rows[0]?.organisation_id !== organisationA) {
      throw new Error("RLS failed: tenant A could read another tenant's People records.");
    }
    const crossTenantPersonUpdate = await connection.query(
      "UPDATE people SET display_name = 'Blocked person update' WHERE organisation_id = $1",
      [organisationB],
    );
    if (crossTenantPersonUpdate.rowCount !== 0) {
      throw new Error("RLS failed: tenant A modified tenant B People records.");
    }

    await connection.query("ROLLBACK");
    console.info("Tenant isolation verified: organisations and People enforce scoped reads and cross-tenant write protection.");
  } finally {
    connection.release();
    await Promise.all([ownerPool.end(), applicationPool.end()]);
  }
}

verifyTenantIsolation().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
