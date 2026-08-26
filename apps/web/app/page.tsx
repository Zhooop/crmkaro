import { AppShell, Icon, SectionCard, StatCard, type NavItem } from "@crmkaro/ui";

const nav: NavItem[] = [
  { label: "Overview", icon: "home" }, { label: "People", icon: "people" },
  { label: "Leads & CRM", icon: "crm", badge: "12" }, { label: "Finance", icon: "finance" },
  { label: "Payroll", icon: "payroll" }, { label: "Inventory", icon: "inventory", badge: "3" },
  { label: "Reports", icon: "reports" }, { label: "Settings", icon: "settings" },
];

const activities = [
  ["people", "New customer added", "Ananya Sharma was added to People", "8 min ago"],
  ["finance", "Payment received", "Invoice #INV-1042 · ₹18,500", "24 min ago"],
  ["crm", "Lead moved to Qualified", "Orion Fitness · Website enquiry", "1 hr ago"],
  ["inventory", "Stock running low", "Premium Yoga Mat · 4 units left", "2 hrs ago"],
] as const;

export default function HomePage() {
  return <AppShell product="CRMKaro" organisation="Acme Wellness" nav={nav}>
    <div className="page-heading"><div><p className="eyebrow"><Icon name="activity" size={14}/>Tuesday overview</p><h1>Good morning, Pushpaindu</h1><p className="subheading">Here&apos;s what&apos;s happening across your business today.</p></div><span className="date-chip">26 August 2026 · 09:30 AM</span></div>
    <div className="stats-grid">
      <StatCard label="Active people" value="1,248" change="↑ 8.2% this month" icon="people" />
      <StatCard label="Open leads" value="84" change="12 need follow-up" icon="crm" tone="teal" />
      <StatCard label="Payments due" value="₹2.48L" change="18 invoices pending" icon="finance" tone="amber" />
      <StatCard label="Low stock items" value="7" change="3 need attention" icon="inventory" tone="rose" />
    </div>
    <div className="content-grid">
      <SectionCard title="Recent activity" subtitle="Updates from across your workspace" action="View all"><ul className="activity-list">{activities.map(([icon,title,detail,time]) => <li key={title}><span className="activity-dot"><Icon name={icon}/></span><span className="activity-copy"><strong>{title}</strong><span>{detail}</span></span><time>{time}</time></li>)}</ul></SectionCard>
      <SectionCard title="Lead pipeline" subtitle="Current pipeline distribution" action="Open CRM"><div className="pipeline"><div className="pipeline-bars">{[["New",72],["Contacted",54],["Qualified",82],["Proposal",40],["Won",62]].map(([label,height]) => <div className="pipeline-bar" key={label}><i style={{height:`${height}%`}}/><span>{label}</span></div>)}</div><div className="pipeline-legend"><span>Total pipeline value</span><strong>₹14.8L</strong></div></div></SectionCard>
      <SectionCard title="Quick actions" subtitle="Common tasks, one click away"><div className="quick-grid"><button className="quick-tile"><Icon name="people"/>Add person</button><button className="quick-tile"><Icon name="crm"/>Create lead</button><button className="quick-tile"><Icon name="finance"/>New invoice</button><button className="quick-tile"><Icon name="inventory"/>Adjust stock</button></div></SectionCard>
      <SectionCard title="Today’s focus" subtitle="Prioritised for your role" action="See tasks"><ul className="activity-list"><li><span className="activity-dot"><Icon name="bell"/></span><span className="activity-copy"><strong>7 follow-ups due</strong><span>Oldest follow-up is 2 days overdue</span></span><time>CRM</time></li><li><span className="activity-dot"><Icon name="payroll"/></span><span className="activity-copy"><strong>August payroll draft</strong><span>Ready for owner approval</span></span><time>Payroll</time></li></ul></SectionCard>
    </div>
  </AppShell>;
}
