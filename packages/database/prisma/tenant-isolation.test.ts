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
  await ownerPool.query(
    `INSERT INTO pipelines (id, organisation_id, name, is_default, is_active, created_at, updated_at) VALUES
       ('30000000-0000-4000-8000-000000000001', $1, 'Tenant A Test Pipeline', true, true, now(), now()),
       ('30000000-0000-4000-8000-000000000002', $2, 'Tenant B Test Pipeline', true, true, now(), now()) ON CONFLICT (id) DO NOTHING`,
    [organisationA, organisationB],
  );
  await ownerPool.query(
    `INSERT INTO pipeline_stages (id, organisation_id, pipeline_id, name, position, is_active, created_at, updated_at) VALUES
       ('40000000-0000-4000-8000-000000000001', $1, '30000000-0000-4000-8000-000000000001', 'New', 10, true, now(), now()),
       ('40000000-0000-4000-8000-000000000002', $2, '30000000-0000-4000-8000-000000000002', 'New', 10, true, now(), now()) ON CONFLICT (id) DO NOTHING`,
    [organisationA, organisationB],
  );
  await ownerPool.query(
    `INSERT INTO leads (id, organisation_id, pipeline_id, stage_id, name, status, created_at, updated_at) VALUES
       ('50000000-0000-4000-8000-000000000001', $1, '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Tenant A Lead', 'OPEN', now(), now()),
       ('50000000-0000-4000-8000-000000000002', $2, '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Tenant B Lead', 'OPEN', now(), now()) ON CONFLICT (id) DO NOTHING`,
    [organisationA, organisationB],
  );
  await ownerPool.query(
    `INSERT INTO invoices (id, organisation_id, person_id, invoice_number, issue_date, due_date, subtotal_minor, grand_total_minor, balance_due_minor, created_at, updated_at) VALUES
       ('60000000-0000-4000-8000-000000000001', $1, '20000000-0000-4000-8000-000000000001', 'RLS-A-001', CURRENT_DATE, CURRENT_DATE, 10000, 10000, 10000, now(), now()),
       ('60000000-0000-4000-8000-000000000002', $2, '20000000-0000-4000-8000-000000000002', 'RLS-B-001', CURRENT_DATE, CURRENT_DATE, 10000, 10000, 10000, now(), now()) ON CONFLICT (id) DO NOTHING`,
    [organisationA, organisationB],
  );

  const connection = await applicationPool.connect();

  try {
    await connection.query("BEGIN");

    const noContext = await connection.query<{ id: string }>(
      "SELECT id FROM organisations",
    );
    if (noContext.rowCount !== 0) {
      throw new Error("RLS failed: rows were visible without tenant context.");
    }

    await connection.query(
      "SELECT set_config('app.current_organisation_id', $1, true)",
      [organisationA],
    );
    const tenantRows = await connection.query<{ id: string }>(
      "SELECT id FROM organisations ORDER BY id",
    );

    if (tenantRows.rowCount !== 1 || tenantRows.rows[0]?.id !== organisationA) {
      throw new Error(
        "RLS failed: tenant A did not receive exactly its own row.",
      );
    }

    const crossTenantUpdate = await connection.query(
      "UPDATE organisations SET name = 'Blocked update' WHERE id = $1",
      [organisationB],
    );

    if (crossTenantUpdate.rowCount !== 0) {
      throw new Error("RLS failed: tenant A modified tenant B.");
    }

    const peopleRows = await connection.query<{ organisation_id: string }>(
      "SELECT organisation_id FROM people",
    );
    if (
      peopleRows.rowCount !== 1 ||
      peopleRows.rows[0]?.organisation_id !== organisationA
    ) {
      throw new Error(
        "RLS failed: tenant A could read another tenant's People records.",
      );
    }
    const crossTenantPersonUpdate = await connection.query(
      "UPDATE people SET display_name = 'Blocked person update' WHERE organisation_id = $1",
      [organisationB],
    );
    if (crossTenantPersonUpdate.rowCount !== 0) {
      throw new Error("RLS failed: tenant A modified tenant B People records.");
    }
    const leadRows = await connection.query<{ organisation_id: string }>(
      "SELECT organisation_id FROM leads WHERE id IN ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002')",
    );
    if (
      leadRows.rowCount !== 1 ||
      leadRows.rows[0]?.organisation_id !== organisationA
    )
      throw new Error(
        "RLS failed: tenant A could read another tenant's leads.",
      );
    const crossTenantLeadUpdate = await connection.query(
      "UPDATE leads SET name = 'Blocked lead update' WHERE id = '50000000-0000-4000-8000-000000000002'",
    );
    if (crossTenantLeadUpdate.rowCount !== 0)
      throw new Error("RLS failed: tenant A modified tenant B leads.");

    const invoiceRows = await connection.query<{ organisation_id: string }>(
      "SELECT organisation_id FROM invoices WHERE id IN ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002')",
    );
    if (
      invoiceRows.rowCount !== 1 ||
      invoiceRows.rows[0]?.organisation_id !== organisationA
    ) {
      throw new Error(
        "RLS failed: tenant A could read another tenant's invoices.",
      );
    }
    const crossTenantInvoiceUpdate = await connection.query(
      "UPDATE invoices SET notes = 'Blocked invoice update' WHERE id = '60000000-0000-4000-8000-000000000002'",
    );
    if (crossTenantInvoiceUpdate.rowCount !== 0) {
      throw new Error("RLS failed: tenant A modified tenant B invoices.");
    }

    await connection.query("ROLLBACK");
    console.info(
      "Tenant isolation verified: organisations, People, CRM and Finance enforce scoped reads and cross-tenant write protection.",
    );
  } finally {
    connection.release();
    await Promise.all([ownerPool.end(), applicationPool.end()]);
  }
}

verifyTenantIsolation().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
