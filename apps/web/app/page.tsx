const modules = ["People", "Leads", "Payments", "Payroll", "Inventory"];

export default function HomePage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 960, padding: "80px 24px" }}>
      <p style={{ color: "#2563eb", fontWeight: 700 }}>CRMKaro</p>
      <h1 style={{ fontSize: 48, letterSpacing: "-0.04em", marginBottom: 16 }}>
        Your business, clearly organised.
      </h1>
      <p style={{ color: "#475569", fontSize: 18, maxWidth: 640 }}>
        A secure modular workspace for CRM, people, finance, payroll and inventory.
      </p>
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 48 }}>
        {modules.map((module) => (
          <article key={module} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
            {module}
          </article>
        ))}
      </section>
    </main>
  );
}

