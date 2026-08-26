import { AppShell, Icon, SectionCard, StatCard, type NavItem } from "@crmkaro/ui";

const nav: NavItem[] = [
  { label: "Platform overview", icon: "home" }, { label: "Organisations", icon: "building", badge: "248" },
  { label: "Services & plans", icon: "services" }, { label: "Subscriptions", icon: "finance" },
  { label: "Platform activity", icon: "activity" }, { label: "Security & audit", icon: "shield" }, { label: "Configuration", icon: "settings" },
];

export default function AdminHomePage() {
  return <AppShell product="CRMKaro Admin" organisation="Platform operations" nav={nav} dark>
    <div className="page-heading"><div><p className="eyebrow"><Icon name="shield" size={14}/>Restricted platform access</p><h1>Platform overview</h1><p className="subheading">Organisation health, subscriptions and operational signals.</p></div><span className="date-chip">Live · Updated 2 min ago</span></div>
    <div className="stats-grid">
      <StatCard label="Organisations" value="248" change="↑ 14 this month" icon="building" /><StatCard label="Active services" value="892" change="96.8% healthy" icon="services" tone="teal" /><StatCard label="Monthly revenue" value="₹8.42L" change="↑ 11.4% vs July" icon="finance" tone="amber" /><StatCard label="Security events" value="3" change="No critical events" icon="shield" tone="rose" />
    </div>
    <div className="content-grid">
      <SectionCard title="Organisation activity" subtitle="Latest tenant-level platform events" action="View audit log"><ul className="activity-list"><li><span className="activity-dot"><Icon name="building"/></span><span className="activity-copy"><strong>BrightPath Academy joined</strong><span>Education · CRM, People and Finance enabled</span></span><time>12 min</time></li><li><span className="activity-dot"><Icon name="services"/></span><span className="activity-copy"><strong>Inventory service enabled</strong><span>UrbanKraft Retail · Owner initiated</span></span><time>34 min</time></li><li><span className="activity-dot"><Icon name="shield"/></span><span className="activity-copy"><strong>Admin session reviewed</strong><span>Routine elevated-access verification completed</span></span><time>1 hr</time></li><li><span className="activity-dot"><Icon name="finance"/></span><span className="activity-copy"><strong>Subscription renewed</strong><span>Pulse Gym · Annual Business plan</span></span><time>2 hrs</time></li></ul></SectionCard>
      <SectionCard title="Service adoption" subtitle="Enabled services across tenants" action="Manage services"><div className="pipeline"><div className="pipeline-bars">{[["People",92],["CRM",81],["Finance",68],["Payroll",46],["Inventory",57]].map(([label,height]) => <div className="pipeline-bar" key={label}><i style={{height:`${height}%`}}/><span>{label}</span></div>)}</div><div className="pipeline-legend"><span>Total entitlements</span><strong>892</strong></div></div></SectionCard>
      <SectionCard title="Platform controls" subtitle="Common administrative workflows"><div className="quick-grid"><button className="quick-tile"><Icon name="building"/>Find organisation</button><button className="quick-tile"><Icon name="services"/>Manage plans</button><button className="quick-tile"><Icon name="shield"/>Review access</button><button className="quick-tile"><Icon name="activity"/>System health</button></div></SectionCard>
      <SectionCard title="Operational attention" subtitle="Items requiring platform review" action="Open queue"><ul className="activity-list"><li><span className="activity-dot"><Icon name="bell"/></span><span className="activity-copy"><strong>2 payment retries</strong><span>Automated retry scheduled today</span></span><time>Billing</time></li><li><span className="activity-dot"><Icon name="activity"/></span><span className="activity-copy"><strong>1 delayed background job</strong><span>PDF generation queue · non-critical</span></span><time>Worker</time></li></ul></SectionCard>
    </div>
  </AppShell>;
}
