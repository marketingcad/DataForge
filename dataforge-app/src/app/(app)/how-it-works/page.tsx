import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "How It Works — DataForge" };

// ─── tiny helpers ────────────────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      {children}
    </section>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-border/60">
      <span className="text-2xl leading-none mt-0.5">{emoji}</span>
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card p-4 ${className}`}>
      {children}
    </div>
  );
}

function FeatureRow({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-lg shrink-0 leading-none mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black shrink-0">
      {n}
    </span>
  );
}

function RoleChip({ role, color }: { role: string; color: string }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
      {role}
    </span>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function HowItWorksPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin"].includes(role)) redirect("/unauthorized");

  const toc = [
    { id: "overview",    label: "Overview" },
    { id: "workflow",    label: "Core Workflow" },
    { id: "dashboard",   label: "Dashboard" },
    { id: "leads",       label: "Leads" },
    { id: "scraping",    label: "Scraping" },
    { id: "marketing",   label: "Marketing" },
    { id: "achievements",label: "Achievements" },
    { id: "reports",     label: "Reports" },
    { id: "workspace",   label: "Workspace" },
    { id: "admin",       label: "Admin Tools" },
    { id: "roles",       label: "Role Reference" },
  ];

  return (
    <div className="flex gap-8 max-w-6xl mx-auto">

      {/* ── Sticky ToC ──────────────────────────────────────────────────── */}
      <aside className="hidden xl:block w-44 shrink-0">
        <div className="sticky top-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Contents</p>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 hover:translate-x-0.5 transition-transform"
            >
              {t.label}
            </a>
          ))}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-10 pb-16">

        {/* Hero */}
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/60 rounded-full px-3 py-1 mb-4">
            Boss &amp; Admin Guide
          </div>
          <h1 className="text-2xl font-black tracking-tight">How DataForge Works</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            DataForge is an all-in-one sales operations platform — it automates lead discovery,
            organises your pipeline, tracks agent performance, and gamifies your team's activity
            all in one place. This guide explains every system from scraping to reporting.
          </p>
        </div>

        {/* ── OVERVIEW ── */}
        <Section id="overview">
          <SectionHeader emoji="🏗️" title="Platform Overview" subtitle="What DataForge is and what it replaces" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { emoji: "🔍", label: "Find", desc: "Automated scraping discovers businesses and contacts at scale using Google Maps and domain crawling." },
              { emoji: "📋", label: "Organise", desc: "Leads are de-duplicated, quality-scored, and filed into industry categories and custom folders." },
              { emoji: "📈", label: "Convert", desc: "Agents call leads, book appointments, and earn commissions — all tracked in real time." },
            ].map((p) => (
              <Card key={p.label} className="text-center space-y-2">
                <p className="text-2xl">{p.emoji}</p>
                <p className="font-bold text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            ))}
          </div>
          <Card>
            <p className="text-xs text-muted-foreground leading-relaxed">
              DataForge connects five systems: <strong className="text-foreground">Lead Scraping</strong> populates the database →{" "}
              <strong className="text-foreground">Leads</strong> organises and tracks data quality →{" "}
              <strong className="text-foreground">Marketing</strong> drives agent performance →{" "}
              <strong className="text-foreground">GHL Integration</strong> syncs appointments and call logs in real time →{" "}
              <strong className="text-foreground">Reports</strong> surfaces insights so you can coach and optimise.
            </p>
          </Card>
        </Section>

        {/* ── CORE WORKFLOW ── */}
        <Section id="workflow">
          <SectionHeader emoji="⚙️" title="Core Workflow" subtitle="The end-to-end journey of a lead through DataForge" />
          <div className="space-y-3">
            {[
              { n: 1, title: "Discover leads via Scraping", desc: "Use Scrape a Website, Search by Google, or Auto Keywords to pull business contacts into DataForge. Each job runs in the background and results appear automatically. Duplicates are caught and prevented before they reach the database." },
              { n: 2, title: "Leads land in the Leads database", desc: "Every scraped contact is quality-scored (0–100%) based on data completeness — name, phone, email, address, website all contribute. Leads are automatically categorised by industry and filed into the Industry Board." },
              { n: 3, title: "Agents work their leads", desc: "Sales reps and team leads access the Marketing section to view their assigned leads. They log calls through GHL, which sends a webhook to DataForge — call counts update in real time on the dashboard." },
              { n: 4, title: "Appointments are booked and synced", desc: "When a rep books an appointment in GHL, another webhook fires and DataForge records it under the agent's profile. Appointments appear on the Appointments Set by Agents chart immediately." },
              { n: 5, title: "Performance is measured and rewarded", desc: "The leaderboard ranks agents by calls, appointments, commissions, or badges. Challenges push team-wide goals. Commissions track pending and paid earnings. Balloon Pop rewards top performers with prizes." },
              { n: 6, title: "You review in Reports", desc: "The Reports page shows a per-agent heatmap of calls, appointments, connect rate, and average call duration. Use this to coach underperformers and recognise top agents." },
            ].map((s) => (
              <div key={s.n} className="flex gap-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <StepBadge n={s.n} />
                  {s.n < 6 && <div className="w-px flex-1 bg-border/60 my-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── DASHBOARD ── */}
        <Section id="dashboard">
          <SectionHeader emoji="📊" title="Dashboard" subtitle="Your organisation-wide snapshot at a glance" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Stats Strip</p>
              <div className="space-y-2">
                <FeatureRow icon="📦" title="Total Leads" description="All-time count of leads in the database across every industry and folder." />
                <FeatureRow icon="📅" title="Leads This Week" description="New leads added since the start of the current calendar week (Monday, PHT)." />
                <FeatureRow icon="🤖" title="Scraping Jobs Run" description="Number of scraping jobs ever executed — domain, Google, and auto-keyword combined." />
                <FeatureRow icon="✅" title="Duplicates Caught" description="Contacts blocked from entering the database because they already existed — keeps your data clean." />
              </div>
            </Card>
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bento Grid</p>
              <div className="space-y-2">
                <FeatureRow icon="🏆" title="Top Performers" description="All-time leader by leads secured, with their badge collection displayed." />
                <FeatureRow icon="📞" title="Calls (24h)" description="Rolling 24-hour call count across all agents — updates every 2 minutes." />
                <FeatureRow icon="🌀" title="Team Pulse" description="Composite score (0–10) combining average lead quality (60% weight) and call activity (40% weight)." />
                <FeatureRow icon="💜" title="Avg Quality" description="Mean data-completeness score across all leads — higher is better." />
              </div>
            </Card>
          </div>
          <Card className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Charts &amp; Bottom Row</p>
            <div className="space-y-2">
              <FeatureRow icon="📈" title="Appointments Set by Agents" description="Line chart showing daily appointments booked per agent over the last 30 days. Top 5 agents by leaderboard are shown." />
              <FeatureRow icon="👑" title="Top Agents" description="Quick-view of the top 3 agents this week with their call counts and a relative progress bar." />
              <FeatureRow icon="🏭" title="By Industry" description="Bar chart of your top 10 lead industries — useful for spotting which sectors have the most untapped contacts." />
              <FeatureRow icon="🍩" title="Quality Spread" description="Donut chart showing how leads are distributed across Good, Medium, and Low quality tiers." />
              <FeatureRow icon="⚡" title="Quick Actions" description="One-click shortcuts to create challenges, badges, manage commissions, users, scraping, and all leads." />
            </div>
          </Card>
        </Section>

        {/* ── LEADS ── */}
        <Section id="leads">
          <SectionHeader emoji="👥" title="Leads" subtitle="The central database of all business contacts" />
          <div className="space-y-3">
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Industry Board</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Leads are automatically grouped by industry category. Each industry expands into folders —
                custom folders you create, plus an "Unfiled" catch-all for leads not yet organised.
                Within folders you can search, filter, export to CSV, and open individual lead profiles.
              </p>
              <div className="space-y-2 pt-1">
                <FeatureRow icon="🏷️" title="Quality Score" description="Each lead has a 0–100% completeness score. Fields that contribute: name, phone, email, address, website, industry, and notes." />
                <FeatureRow icon="📁" title="Folders" description="Organise leads into named folders within an industry, or across industries using the unfiled section. Folders can be renamed or deleted." />
                <FeatureRow icon="📤" title="CSV Export" description="Any folder can be exported as a CSV for use in GHL, CRMs, or spreadsheets. Exports include all lead fields." />
                <FeatureRow icon="🔍" title="Filter by Rep" description="Admin and boss accounts can filter the entire leads view by which rep saved the lead — useful for auditing individual agent pipelines." />
              </div>
            </Card>
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lead Origins Globe</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The interactive 3-D globe (visible to boss and admin only) plots every lead's geographic location
                as a colour-coded bubble — colours represent industry categories. Bubble size reflects the number
                of leads from that location. Click to zoom in, drag to rotate, scroll to zoom. After 30 seconds
                of inactivity the globe re-centres automatically.
              </p>
              <p className="text-xs text-muted-foreground">
                Use the <strong className="text-foreground">Hide / Show</strong> toggle above the globe to collapse it —
                your preference is remembered across sessions via a browser cookie.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── SCRAPING ── */}
        <Section id="scraping">
          <SectionHeader emoji="🤖" title="Lead Scraping" subtitle="Three ways to automatically discover new leads" />
          <div className="space-y-3">
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🌐</span>
                <p className="text-sm font-bold">Scrape a Website</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter a domain (e.g. <code className="bg-muted px-1 rounded text-xs">example.com</code>) and DataForge crawls the site to extract
                contact details — phone numbers, emails, addresses, and business names. Useful when you already
                know which company you're targeting and want to harvest all contacts from their site quickly.
              </p>
              <p className="text-xs text-muted-foreground">Available to: Boss, Admin, Lead Specialist</p>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🔎</span>
                <p className="text-sm font-bold">Search by Google</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter a keyword (e.g. <em>"dental clinics"</em>) and a location. DataForge queries Google Maps
                to discover businesses matching your search, then extracts their contact info in bulk.
                This is the fastest way to build a leads list for a specific niche and geography.
                Set a max lead count to control job size.
              </p>
              <p className="text-xs text-muted-foreground">Available to: Boss, Admin, Lead Specialist</p>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🪄</span>
                <p className="text-sm font-bold">Auto Keywords</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure a library of keyword + location pairs and DataForge runs Google scraping jobs on a
                schedule — daily, every few hours, or at a custom interval. Jobs fire automatically in the
                background without any manual trigger. Use this to keep your leads pipeline constantly
                refreshed with fresh contacts without lifting a finger.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2 mt-1 space-y-1">
                <p className="text-[11px] font-semibold">Configuration options per keyword:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Keyword and target location</li>
                  <li>Maximum leads per run</li>
                  <li>Run interval in minutes (e.g. 1440 = once per day)</li>
                  <li>Enable / disable individual keywords without deleting them</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">Available to: Boss, Admin only</p>
            </Card>
            <Card className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">De-duplication &amp; Quality</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every incoming lead is checked against the existing database by phone number and business name.
                If a match is found the lead is discarded and the "Duplicates Caught" counter increments.
                Non-duplicate leads are quality-scored automatically and inserted into the appropriate industry category.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── MARKETING ── */}
        <Section id="marketing">
          <SectionHeader emoji="📣" title="Marketing Overview" subtitle="Team performance hub for calls, appointments, and commissions" />
          <div className="space-y-3">
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">KPI Cards</p>
              <div className="space-y-2">
                <FeatureRow icon="👤" title="Agents" description="Count of active sales rep and team lead accounts currently on the team." />
                <FeatureRow icon="📞" title="Calls (period)" description="Team-wide total calls for the selected period — yesterday, week, or month. Sourced from GHL webhook data." />
                <FeatureRow icon="📊" title="Avg Calls / Agent" description="Total calls divided by number of agents for the period — useful for spotting if workload is unevenly distributed." />
                <FeatureRow icon="📅" title="Appointments Set" description="Total appointments booked across the whole team, synced automatically when GHL fires the appointment webhook." />
                <FeatureRow icon="💰" title="Total Commissions" description="Sum of all earned commissions across all reps for the selected period." />
              </div>
            </Card>
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leaderboard</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A ranked table of all marketing agents. Switch the <strong className="text-foreground">Period</strong> tab
                (Yesterday / Week / Month / All-Time) and the <strong className="text-foreground">Metric</strong> tab
                (Calls / Leads / Appointments / Deals Won / Commissions / Avg Call Time / Badges) to rerank
                agents in real time. Clicking an agent's name opens their full profile.
              </p>
            </Card>
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Charts</p>
              <div className="space-y-2">
                <FeatureRow icon="📉" title="Call Volume Chart" description="Area chart of daily team call volume — available in Last 7 Days, Last 30 Days, and All-Time (monthly) views." />
                <FeatureRow icon="🕸️" title="Team 6-Month Breakdown" description="Radar chart comparing calls vs. appointments across the last 6 months — great for spotting seasonal trends." />
                <FeatureRow icon="📋" title="Monthly Activity Summary" description="Table view of calls and appointments per month alongside the radar chart for quick scanning." />
                <FeatureRow icon="👥" title="Rep Performance Charts" description="Dual line charts showing daily calls and daily appointments for the top 5 agents over the last 30 days." />
              </div>
            </Card>
            <Card className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes &amp; Scripts</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Notes</strong> is a shared knowledge base — boss and admin can publish notes visible to the whole team.
                Reps can reference them during calls. <strong className="text-foreground">Scripts</strong> stores approved call scripts
                that reps can pull up at any time. Both sections are searchable.
              </p>
            </Card>
            <Card className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GHL Integration</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                DataForge receives two webhooks from GoHighLevel:
              </p>
              <div className="space-y-2 pt-1">
                <FeatureRow icon="📡" title="Outbound / Inbound Call Webhook" description="Fires after every call. DataForge resolves the agent by GHL User ID or name, creates a CallLog entry, and updates all call-count metrics immediately." />
                <FeatureRow icon="📡" title="Appointment Webhook" description="Fires when an appointment is booked. DataForge matches the contact to an agent and records a BookedAppointment — this drives the Appointments Set chart and leaderboard." />
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Configure the webhook URL and bearer token secret in <strong className="text-foreground">Settings → GHL Integration</strong>.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── ACHIEVEMENTS ── */}
        <Section id="achievements">
          <SectionHeader emoji="🏆" title="Achievements &amp; Gamification" subtitle="Keep agents motivated with badges, challenges, commissions, and prizes" />
          <div className="space-y-3">
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <span>🥇</span>
                <p className="text-sm font-bold">Badges</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create custom achievement badges (name, icon, description) and award them manually to agents.
                Badges appear on an agent's leaderboard profile card and on the Top Performers dashboard widget.
                Use badges to recognise milestones — first 100 calls, monthly MVP, top closer, etc.
              </p>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <span>🎯</span>
                <p className="text-sm font-bold">Challenges</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set team-wide time-bounded challenges with a call target and point reward. Active challenges
                appear on the Marketing Overview dashboard for all agents to see. Progress is tracked per rep.
                Challenges expire on their end date and move off the active list automatically.
              </p>
            </Card>
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <span>💵</span>
                <p className="text-sm font-bold">Commissions</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Commission rules define how much an agent earns per qualifying event. The system tracks
                <strong className="text-foreground"> Pending</strong> (earned but not yet paid) and
                <strong className="text-foreground"> Paid</strong> commissions separately. The Lead Ledger
                logs every individual commission-generating event so you have a full audit trail.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2 space-y-1">
                <p className="text-[11px] font-semibold">Three tabs in Commissions:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li><strong className="text-foreground">Commission Rules</strong> — define trigger events and amounts</li>
                  <li><strong className="text-foreground">Rep Commissions</strong> — per-agent view of pending vs. earned</li>
                  <li><strong className="text-foreground">Lead Ledger</strong> — every commission event in chronological order</li>
                </ul>
              </div>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <span>🎈</span>
                <p className="text-sm font-bold">Balloon Pop</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A prize wheel-style game where agents spend points earned from booking appointments to pop
                balloons and win rewards. There are 16 balloons on the board, each containing a prize
                you set. Agents accumulate points automatically through their appointment activity.
              </p>
              <div className="space-y-1.5 pt-1">
                <FeatureRow icon="⚙️" title="Admin controls" description="Set prize contents for each balloon, reset the board, configure point costs, and view the full audit log of every pop and payout." />
                <FeatureRow icon="🚫" title="Suspension system" description="If an agent is suspended from Balloon Pop (due to misconduct), they cannot pop balloons until reinstated." />
              </div>
            </Card>
          </div>
        </Section>

        {/* ── REPORTS ── */}
        <Section id="reports">
          <SectionHeader emoji="📋" title="Reports" subtitle="Deep-dive agent performance analytics for coaching" />
          <div className="space-y-3">
            <Card className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Summary KPIs</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "👤", t: "Active Agents", d: "Agents currently on the team" },
                  { icon: "📞", t: "Calls (24h)", d: "Rolling 24-hour call count" },
                  { icon: "📅", t: "Calls This Week", d: "Since Monday PHT" },
                  { icon: "🗓️", t: "Calls This Month", d: "Since 1st of the month PHT" },
                  { icon: "🔗", t: "Avg Connect Rate", d: "Completed ÷ total calls × 100" },
                  { icon: "👥", t: "Total Agents", d: "All-time agent count" },
                ].map((k) => (
                  <div key={k.t} className="flex gap-2">
                    <span className="text-sm shrink-0">{k.icon}</span>
                    <div>
                      <p className="text-xs font-semibold">{k.t}</p>
                      <p className="text-[10px] text-muted-foreground">{k.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Agent Performance Heatmap</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A matrix table where each row is an agent and each column is a performance metric.
                Cell colour intensity indicates relative performance — darker cells mean higher performance
                relative to the team. Agents are sorted by their total assigned leads.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2 mt-1">
                <p className="text-[11px] font-semibold mb-1">Columns tracked per agent:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {["Total Calls", "Calls Today", "Calls This Week", "Avg Duration (sec)", "Connect Rate (%)", "Appointments Set", "Leads Assigned", "Quality Score"].map((c) => (
                    <p key={c} className="text-[10px] text-muted-foreground">· {c}</p>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ── WORKSPACE ── */}
        <Section id="workspace">
          <SectionHeader emoji="🗂️" title="Workspace" subtitle="Kanban, Calendar, and team collaboration tools" />
          <div className="space-y-3">
            <Card className="space-y-2">
              <div className="flex items-center gap-2"><span>📌</span><p className="text-sm font-bold">Kanban Board</p></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A task board for team project management. Tasks move through columns: To Do → In Progress → Review → Done.
                Admins and bosses create and assign tasks with due dates and priorities. Team members update
                their task status and submit for review. All roles can see the full team board.
              </p>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2"><span>📆</span><p className="text-sm font-bold">Calendar</p></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A shared team calendar for company events, meetings, and announcements. Boss and admin
                can create, edit, and delete events. All other users can view the calendar.
                Events are colour-coded and display with date, time, and description.
              </p>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2"><span>🐞</span><p className="text-sm font-bold">Bug Reports &amp; Feature Requests</p></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Any team member can submit a bug report or feature request with a title and description.
                Boss and admin can view all submissions, change their status (New → In Progress → Resolved → Closed),
                and track resolution. This keeps all internal feedback in one place instead of scattered across chat.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── ADMIN TOOLS ── */}
        <Section id="admin">
          <SectionHeader emoji="🔧" title="Admin Tools" subtitle="User management and global configuration" />
          <div className="space-y-3">
            <Card className="space-y-3">
              <div className="flex items-center gap-2"><span>👤</span><p className="text-sm font-bold">Users</p></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create and manage team member accounts. Assign roles, set GHL User IDs for call attribution,
                view per-agent call statistics, and import agents directly from GHL. The Users page shows
                total users, new this month, number of sales reps, and number of admins.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2 space-y-1">
                <p className="text-[11px] font-semibold">Roles you can assign:</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <RoleChip role="boss" color="bg-violet-500/15 text-violet-500" />
                  <RoleChip role="admin" color="bg-blue-500/15 text-blue-500" />
                  <RoleChip role="team_lead" color="bg-amber-500/15 text-amber-600" />
                  <RoleChip role="sales_rep" color="bg-emerald-500/15 text-emerald-600" />
                  <RoleChip role="lead_specialist" color="bg-rose-500/15 text-rose-500" />
                </div>
              </div>
            </Card>
            <Card className="space-y-3">
              <div className="flex items-center gap-2"><span>⚙️</span><p className="text-sm font-bold">Settings</p></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Global configuration for the entire organisation. All changes auto-save. Boss only.
              </p>
              <div className="space-y-2">
                <FeatureRow icon="🏢" title="Company Name" description="Your organisation's display name shown across the platform." />
                <FeatureRow icon="🤖" title="Scraping Defaults" description="Set the default max leads per job, scraping interval, and pause all automated scraping with one toggle." />
                <FeatureRow icon="⭐" title="Lead Quality Thresholds" description="Define what completeness % counts as Good (default 70%) and Medium (default 40%). Leads below Medium are flagged as Low quality." />
                <FeatureRow icon="💱" title="Commission Currency" description="Choose the display currency for all commission values (₱, $, €, £, ¥, ₩, ₹, A$, C$, R)." />
                <FeatureRow icon="🔗" title="GHL Integration" description="Enter your GHL API key, Location ID, and webhook bearer secret. The webhook URL shown here is what you paste into GHL automations." />
                <FeatureRow icon="🎨" title="UI Theme" description="Choose an accent colour scheme: Neutral, Blue, Violet, Emerald, Rose, Amber, or Teal. Preference is saved per browser." />
              </div>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2"><span>👤</span><p className="text-sm font-bold">My Profile</p></div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Update your own display name, profile photo, and password. Your profile image appears in the
                top navigation bar and on leaderboard cards.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── ROLE REFERENCE ── */}
        <Section id="roles">
          <SectionHeader emoji="🔑" title="Role Reference" subtitle="What each role can access and do in DataForge" />
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-40">Feature</th>
                  {[
                    { role: "Boss", color: "text-violet-500" },
                    { role: "Admin", color: "text-blue-500" },
                    { role: "Team Lead", color: "text-amber-600" },
                    { role: "Sales Rep", color: "text-emerald-600" },
                    { role: "Lead Spec.", color: "text-rose-500" },
                  ].map((r) => (
                    <th key={r.role} className={`text-center px-3 py-2.5 font-bold ${r.color}`}>{r.role}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  ["Dashboard",             "✓","✓","✓","✓","✓"],
                  ["Marketing Overview",    "✓","✓","✓","✓","✗"],
                  ["Leaderboard",           "✓","✓","✓","✓","✗"],
                  ["Badges / Challenges",   "✓","✓","✗","✗","✗"],
                  ["Commissions (manage)",  "✓","✓","✗","✗","✗"],
                  ["My Commissions",        "✗","✗","✓","✓","✗"],
                  ["Balloon Pop (play)",    "✗","✗","✓","✓","✗"],
                  ["Balloon Pop (admin)",   "✓","✓","✗","✗","✗"],
                  ["Notes & Scripts",       "✓","✓","✓","✓","✗"],
                  ["Leads",                 "✓","✓","✗","✗","✓"],
                  ["Scraping",              "✓","✓","✗","✗","✓"],
                  ["Auto Keywords",         "✓","✓","✗","✗","✗"],
                  ["Reports",               "✓","✓","✗","✗","✗"],
                  ["Kanban / Calendar",     "✓","✓","✓","✓","✓"],
                  ["Bug Reports",           "✓","✓","✓","✓","✓"],
                  ["Users (manage)",        "✓","✓","✗","✗","✗"],
                  ["Settings",              "✓","✗","✗","✗","✗"],
                  ["How It Works",          "✓","✓","✗","✗","✗"],
                ].map(([feat, ...vals]) => (
                  <tr key={feat} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-medium text-foreground/80">{feat}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`text-center px-3 py-2 font-bold ${v === "✓" ? "text-emerald-500" : "text-muted-foreground/30"}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Tip:</strong> When adding a new agent in GHL, always add them in DataForge Users first and set their GHL User ID.
              This is how call and appointment webhooks are matched to the right person. Without the GHL User ID set,
              DataForge falls back to name matching — which works but is less reliable if two agents share similar names.
            </p>
          </Card>
        </Section>

      </div>
    </div>
  );
}
