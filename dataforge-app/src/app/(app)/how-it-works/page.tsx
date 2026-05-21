import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, ScanSearch, Megaphone, Trophy,
  BarChart2, LayoutGrid, Settings, BookOpen, Layers,
  TrendingUp, CheckCircle2, Phone, Zap, Star, Globe,
  FolderOpen, Download, Filter, ArrowRight, Shield,
  Medal, Target, DollarSign, Sparkles, XCircle,
  BarChart, Radar, LineChart, ScrollText, NotebookPen,
  Webhook, CalendarDays, Bug, UserCog, Building2,
  Bot, SlidersHorizontal, BadgeDollarSign, Link2,
  Palette, UserCircle, Key, Info, GitBranch,
  Search, Wand2, ClipboardList, Flame,
} from "lucide-react";

export const metadata = { title: "How It Works — DataForge" };

// ─── helpers ─────────────────────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-4 space-y-3">{children}</section>;
}

function GoLink({ href, children = "Open" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline shrink-0"
    >
      {children}
      <ArrowRight className="h-2.5 w-2.5" />
    </Link>
  );
}

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  href,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-border/60">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold">{title}</h2>
          {href && <GoLink href={href} />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
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

function FeatureRow({
  icon: Icon,
  iconColor = "text-muted-foreground",
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <div className="flex gap-2.5">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{title}</p>
          {href && <GoLink href={href} />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function RoleChip({ role, color }: { role: string; color: string }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
      {role}
    </span>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function HowItWorksPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin"].includes(role)) redirect("/unauthorized");

  const toc = [
    { id: "overview",     label: "Overview",       icon: Layers },
    { id: "workflow",     label: "Core Workflow",   icon: GitBranch },
    { id: "dashboard",    label: "Dashboard",       icon: LayoutDashboard },
    { id: "leads",        label: "Leads",           icon: Users },
    { id: "scraping",     label: "Scraping",        icon: ScanSearch },
    { id: "marketing",    label: "Marketing",       icon: Megaphone },
    { id: "achievements", label: "Achievements",    icon: Trophy },
    { id: "reports",      label: "Reports",         icon: BarChart2 },
    { id: "workspace",    label: "Workspace",       icon: LayoutGrid },
    { id: "admin",        label: "Admin Tools",     icon: Settings },
    { id: "roles",        label: "Role Reference",  icon: Key },
  ];

  return (
    <div className="flex gap-8">

      {/* ── Sticky ToC ───────────────────────────────────────────────────── */}
      <aside className="hidden xl:block w-40 shrink-0">
        <div className="sticky top-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Contents</p>
          <nav className="space-y-0.5">
            {toc.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50 group"
              >
                <Icon className="h-3 w-3 shrink-0 group-hover:text-primary transition-colors" />
                {label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-8 pb-16">

        {/* Page header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Boss &amp; Admin Guide</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">How DataForge Works</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            DataForge is an all-in-one sales operations platform — automating lead discovery, pipeline organisation, agent performance tracking, and team gamification.
          </p>
        </div>

        {/* ── OVERVIEW ── */}
        <Section id="overview">
          <SectionHeader icon={Layers} iconColor="bg-violet-500/15 text-violet-500" title="Platform Overview" subtitle="What DataForge is and how its five systems connect" />
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Search,      color: "text-blue-500",    label: "Find",     desc: "Automated scraping discovers businesses using Google Maps and domain crawling at scale." },
              { icon: FolderOpen,  color: "text-amber-500",   label: "Organise", desc: "Leads are de-duplicated, quality-scored, and filed into industry categories and custom folders." },
              { icon: TrendingUp,  color: "text-emerald-500", label: "Convert",  desc: "Agents call leads, book appointments, and earn commissions — all tracked in real time." },
            ].map((p) => (
              <Card key={p.label} className="text-center space-y-2">
                <div className="flex justify-center">
                  <p.icon className={`h-6 w-6 ${p.color}`} />
                </div>
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            ))}
          </div>
          <Card className="bg-muted/30">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {[
                { label: "Lead Scraping", color: "text-blue-500" },
                { label: "Leads DB",      color: "text-amber-500" },
                { label: "Marketing",     color: "text-violet-500" },
                { label: "GHL Webhooks",  color: "text-rose-500" },
                { label: "Reports",       color: "text-emerald-500" },
              ].map((s, i) => (
                <span key={s.label} className="flex items-center gap-2">
                  <span className={`font-semibold ${s.color}`}>{s.label}</span>
                  {i < 4 && <ArrowRight className="h-3 w-3 shrink-0" />}
                </span>
              ))}
            </div>
          </Card>
        </Section>

        {/* ── CORE WORKFLOW ── */}
        <Section id="workflow">
          <SectionHeader icon={GitBranch} iconColor="bg-blue-500/15 text-blue-500" title="Core Workflow" subtitle="The end-to-end journey of a lead through DataForge" />
          <Card className="space-y-0 divide-y divide-border/40">
            {[
              { icon: ScanSearch,    color: "text-blue-500",    n: 1, title: "Discover leads via Scraping", desc: "Use Scrape a Website, Search by Google, or Auto Keywords to pull business contacts into DataForge. Jobs run in the background. Duplicates are blocked before they enter the database." },
              { icon: Layers,        color: "text-amber-500",   n: 2, title: "Leads land in the database",  desc: "Every contact is quality-scored 0–100% based on completeness — name, phone, email, address, website. Leads are auto-categorised by industry and placed in the Industry Board." },
              { icon: Phone,         color: "text-violet-500",  n: 3, title: "Agents work their leads",     desc: "Sales reps log calls through GHL. GHL fires a webhook to DataForge after every call — call counts update in real time on the dashboard and leaderboard." },
              { icon: CalendarDays,  color: "text-rose-500",    n: 4, title: "Appointments are booked",     desc: "When a rep books an appointment in GHL, a second webhook fires. DataForge records it under the agent's profile and updates the Appointments Set chart immediately." },
              { icon: Trophy,        color: "text-emerald-500", n: 5, title: "Performance is rewarded",     desc: "The leaderboard ranks agents by calls, appointments, commissions, or badges. Challenges drive team goals. Balloon Pop rewards top performers with prizes." },
              { icon: BarChart2,     color: "text-sky-500",     n: 6, title: "You review in Reports",       desc: "The Reports heatmap shows per-agent calls, appointments, connect rate, and avg call duration. Use it to coach underperformers and recognise top agents." },
            ].map((s) => (
              <div key={s.n} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-black shrink-0 mt-0.5">
                  {s.n}
                </div>
                <div className="flex gap-2.5 flex-1">
                  <s.icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.color}`} />
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </Section>

        {/* ── DASHBOARD ── */}
        <Section id="dashboard">
          <SectionHeader icon={LayoutDashboard} iconColor="bg-indigo-500/15 text-indigo-500" title="Dashboard" subtitle="Organisation-wide snapshot — metrics, charts, and quick actions" href="/dashboard" />
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-3">
              <SubLabel>Top Stats Strip</SubLabel>
              <div className="space-y-2.5">
                <FeatureRow icon={Layers}      iconColor="text-violet-500" title="Total Leads"      description="All-time count of leads across every industry and folder." />
                <FeatureRow icon={TrendingUp}  iconColor="text-blue-500"   title="Leads This Week"  description="New leads since the start of the current calendar week (Monday, PHT)." />
                <FeatureRow icon={ScanSearch}  iconColor="text-amber-500"  title="Scraping Jobs Run" description="All-time count of scraping jobs — domain, Google, and auto-keyword combined." />
                <FeatureRow icon={CheckCircle2} iconColor="text-emerald-500" title="Duplicates Caught" description="Contacts blocked from entering because they already existed in the database." />
              </div>
            </Card>
            <Card className="space-y-3">
              <SubLabel>Bento Grid</SubLabel>
              <div className="space-y-2.5">
                <FeatureRow icon={Trophy}      iconColor="text-amber-500"  title="Top Performers"  description="All-time leader by leads secured, with their badge collection shown." />
                <FeatureRow icon={Phone}       iconColor="text-blue-500"   title="Calls (24h)"     description="Rolling 24-hour call count across all agents — refreshes every 2 minutes." />
                <FeatureRow icon={Flame}       iconColor="text-rose-500"   title="Team Pulse"      description="Composite 0–10 score: lead quality (60%) + call activity (40%)." />
                <FeatureRow icon={Star}        iconColor="text-violet-500" title="Avg Quality"     description="Mean data-completeness score across all leads in the database." />
              </div>
            </Card>
          </div>
          <Card className="space-y-3">
            <SubLabel>Charts &amp; Bottom Row</SubLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <FeatureRow icon={LineChart}    iconColor="text-violet-500" title="Appointments Set by Agents" description="Daily appointments per agent over 30 days — top 5 agents shown." />
              <FeatureRow icon={Medal}        iconColor="text-amber-500"  title="Top Agents"                 description="Top 3 agents this week with call counts and a progress bar." />
              <FeatureRow icon={BarChart}     iconColor="text-blue-500"   title="By Industry"                description="Top 10 lead industries — spot which sectors have the most contacts." />
              <FeatureRow icon={ClipboardList} iconColor="text-emerald-500" title="Quality Spread"           description="Donut chart: leads split across Good, Medium, and Low quality tiers." />
              <FeatureRow icon={Zap}          iconColor="text-rose-500"   title="Quick Actions"              description="One-click shortcuts to challenges, badges, commissions, users, scraping, and leads." />
            </div>
          </Card>
        </Section>

        {/* ── LEADS ── */}
        <Section id="leads">
          <SectionHeader icon={Users} iconColor="bg-emerald-500/15 text-emerald-500" title="Leads" subtitle="The central database of all business contacts" href="/leads" />
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-3">
              <SubLabel>Industry Board</SubLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Leads are automatically grouped by industry. Each industry expands into folders — custom ones you create, plus an "Unfiled" catch-all. Within folders you can search, filter, export to CSV, and open individual lead profiles.
              </p>
              <div className="space-y-2.5 pt-1 border-t border-border/40">
                <FeatureRow icon={Star}       iconColor="text-amber-500"  title="Quality Score"   description="0–100% completeness: name, phone, email, address, website, industry, notes." />
                <FeatureRow icon={FolderOpen} iconColor="text-blue-500"   title="Folders"         description="Organise leads into named folders within an industry. Rename or delete anytime." />
                <FeatureRow icon={Download}   iconColor="text-violet-500" title="CSV Export"      description="Export any folder as CSV for GHL, CRMs, or spreadsheets. All fields included." />
                <FeatureRow icon={Filter}     iconColor="text-rose-500"   title="Filter by Rep"   description="Boss/admin can filter all leads by which rep saved them — useful for audits." />
              </div>
            </Card>
            <Card className="space-y-3">
              <SubLabel>Lead Origins Globe</SubLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The interactive 3-D globe (boss and admin only) plots every lead's geographic location as a colour-coded bubble — colours represent industry categories, bubble size reflects lead count from that location.
              </p>
              <div className="space-y-2.5 pt-1 border-t border-border/40">
                <FeatureRow icon={Globe}      iconColor="text-blue-500"   title="Interact"        description="Click to zoom, drag to rotate, scroll to zoom. Resets after 30 seconds of inactivity." />
                <FeatureRow icon={SlidersHorizontal} iconColor="text-muted-foreground" title="Hide / Show Toggle" description="Collapse the globe with one click. Preference is saved via cookie across sessions." />
              </div>
            </Card>
          </div>
        </Section>

        {/* ── SCRAPING ── */}
        <Section id="scraping">
          <SectionHeader icon={ScanSearch} iconColor="bg-amber-500/15 text-amber-500" title="Lead Scraping" subtitle="Three ways to automatically discover new leads" href="/scraping?tab=domain" />
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Globe, color: "text-blue-500", bg: "bg-blue-500/10",
                title: "Scrape a Website", access: "Boss · Admin · Lead Spec.", href: "/scraping?tab=domain",
                desc: "Enter a domain and DataForge crawls the site to extract phone numbers, emails, addresses, and business names — useful when you already know which company to target.",
              },
              {
                icon: Search, color: "text-violet-500", bg: "bg-violet-500/10",
                title: "Search by Google", access: "Boss · Admin · Lead Spec.", href: "/scraping?tab=google",
                desc: "Enter a keyword and location. DataForge queries Google Maps to discover matching businesses and extracts their contact info in bulk. Fastest way to fill a niche pipeline.",
              },
              {
                icon: Wand2, color: "text-amber-500", bg: "bg-amber-500/10",
                title: "Auto Keywords", access: "Boss · Admin only", href: "/scraping?tab=keywords",
                desc: "Configure keyword + location pairs with an interval. DataForge runs Google scraping jobs on schedule — daily, hourly, or custom — with no manual trigger needed.",
              },
            ].map((s) => (
              <Card key={s.title} className="space-y-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <GoLink href={s.href} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                <p className="text-[10px] font-medium text-muted-foreground border-t border-border/40 pt-2">{s.access}</p>
              </Card>
            ))}
          </div>
          <Card className="flex gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">De-duplication &amp; Auto Quality Scoring</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Every incoming lead is checked by phone number and business name against the existing database. Matches are discarded and the Duplicates Caught counter increments. Non-duplicates are quality-scored automatically and inserted into the correct industry category.
              </p>
            </div>
          </Card>
        </Section>

        {/* ── MARKETING ── */}
        <Section id="marketing">
          <SectionHeader icon={Megaphone} iconColor="bg-rose-500/15 text-rose-500" title="Marketing Overview" subtitle="Team performance hub — calls, appointments, leaderboard, and commissions" href="/marketing" />
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-3">
              <SubLabel>KPI Cards</SubLabel>
              <div className="space-y-2.5">
                <FeatureRow icon={Users}          iconColor="text-violet-500" title="Agents"           description="Count of active sales reps and team leads on the team." />
                <FeatureRow icon={Phone}          iconColor="text-blue-500"   title="Calls (period)"   description="Team-wide total calls for yesterday, week, or month — from GHL webhooks." />
                <FeatureRow icon={BarChart}       iconColor="text-amber-500"  title="Avg Calls / Agent" description="Total calls ÷ number of agents — spots uneven workload distribution." />
                <FeatureRow icon={CalendarDays}   iconColor="text-rose-500"   title="Appointments Set" description="Total appointments booked across the team, synced via GHL webhook." />
                <FeatureRow icon={DollarSign}     iconColor="text-emerald-500" title="Total Commissions" description="Sum of all earned commissions across all reps for the selected period." />
              </div>
            </Card>
            <Card className="space-y-3">
              <SubLabel>Charts</SubLabel>
              <div className="space-y-2.5">
                <FeatureRow icon={BarChart}       iconColor="text-blue-500"   title="Call Volume Chart"        description="Area chart of daily team calls — 7 days, 30 days, or all-time (monthly)." />
                <FeatureRow icon={Radar}          iconColor="text-violet-500" title="Team 6-Month Breakdown"   description="Radar chart comparing calls vs. appointments over the last 6 months." />
                <FeatureRow icon={ScrollText}     iconColor="text-amber-500"  title="Monthly Activity Table"   description="Calls and appointments per month in a scannable table view." />
                <FeatureRow icon={LineChart}      iconColor="text-rose-500"   title="Rep Performance Charts"   description="Daily calls and appointments for the top 5 agents over 30 days." />
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-2">
              <SubLabel>Leaderboard</SubLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ranked table of all marketing agents. Switch the <strong className="text-foreground">Period</strong> (Yesterday / Week / Month / All-Time) and <strong className="text-foreground">Metric</strong> (Calls / Leads / Appointments / Deals Won / Commissions / Avg Call Time / Badges) tabs to rerank in real time.
              </p>
            </Card>
            <Card className="space-y-2">
              <SubLabel>Notes &amp; Scripts</SubLabel>
              <div className="space-y-2.5">
                <FeatureRow icon={NotebookPen} iconColor="text-blue-500"   title="Notes"   description="Shared knowledge base. Boss/admin publish; all team can read during calls."   href="/marketing/notes" />
                <FeatureRow icon={ScrollText}  iconColor="text-violet-500" title="Scripts" description="Approved call scripts the whole team can reference. Both sections are searchable." href="/marketing/scripts" />
              </div>
            </Card>
          </div>
          <Card className="space-y-3">
            <SubLabel>GHL Integration — Webhooks</SubLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <FeatureRow icon={Webhook} iconColor="text-rose-500"   title="Call Webhook"        description="Fires after every call. DataForge resolves the agent by GHL User ID or name, creates a CallLog, and updates all call metrics immediately." />
              <FeatureRow icon={Webhook} iconColor="text-violet-500" title="Appointment Webhook" description="Fires when an appointment is booked. DataForge records a BookedAppointment — drives the Appointments chart and leaderboard." />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 border-t border-border/40 pt-2">
              <Settings className="h-3 w-3 shrink-0" />
              Configure webhook URL and bearer secret in{" "}
              <Link href="/settings" className="font-semibold text-foreground hover:underline">Settings → GHL Integration</Link>.
            </p>
          </Card>
        </Section>

        {/* ── ACHIEVEMENTS ── */}
        <Section id="achievements">
          <SectionHeader icon={Trophy} iconColor="bg-amber-500/15 text-amber-500" title="Achievements &amp; Gamification" subtitle="Keep agents motivated with badges, challenges, commissions, and prizes" />
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Medal className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-semibold">Badges</p>
                <GoLink href="/marketing/manage/badges" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create custom achievement badges and award them manually to agents. Badges appear on leaderboard profile cards and the Top Performers dashboard widget. Use them to recognise milestones — first 100 calls, monthly MVP, top closer, etc.
              </p>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-rose-500" />
                <p className="text-sm font-semibold">Challenges</p>
                <GoLink href="/marketing/manage/tasks" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set team-wide time-bounded challenges with a call target and point reward. Active challenges appear on the Marketing dashboard for all agents. Progress is tracked per rep and challenges expire automatically on their end date.
              </p>
            </Card>
            <Card className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <BadgeDollarSign className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-semibold">Commissions</p>
                <GoLink href="/marketing/manage/commissions" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Commission rules define how much an agent earns per qualifying event. Tracks <strong className="text-foreground">Pending</strong> (earned, not yet paid) and <strong className="text-foreground">Paid</strong> separately.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs font-semibold mb-1">Three tabs:</p>
                <p className="text-xs text-muted-foreground">· <strong className="text-foreground">Commission Rules</strong> — define trigger events and amounts</p>
                <p className="text-xs text-muted-foreground">· <strong className="text-foreground">Rep Commissions</strong> — per-agent pending vs. earned view</p>
                <p className="text-xs text-muted-foreground">· <strong className="text-foreground">Lead Ledger</strong> — full chronological audit trail</p>
              </div>
            </Card>
            <Card className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <p className="text-sm font-semibold">Balloon Pop</p>
                <GoLink href="/balloons" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Agents earn points by booking appointments and spend them to pop balloons — each balloon contains a prize you set. 16 balloons on the board at a time.
              </p>
              <div className="space-y-2 pt-1 border-t border-border/40">
                <FeatureRow icon={Settings}  iconColor="text-muted-foreground" title="Admin controls"   description="Set prizes, reset the board, configure point costs, view the full pop audit log." />
                <FeatureRow icon={XCircle}   iconColor="text-rose-500"         title="Suspension"       description="Suspend an agent from Balloon Pop for misconduct — they can't pop until reinstated." />
              </div>
            </Card>
          </div>
        </Section>

        {/* ── REPORTS ── */}
        <Section id="reports">
          <SectionHeader icon={BarChart2} iconColor="bg-sky-500/15 text-sky-500" title="Reports" subtitle="Deep-dive agent performance analytics for coaching" href="/reports" />
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-3">
              <SubLabel>Summary KPIs</SubLabel>
              <div className="space-y-2.5">
                <FeatureRow icon={Users}        iconColor="text-violet-500"  title="Active Agents"     description="Count of agents currently on the team." />
                <FeatureRow icon={Phone}        iconColor="text-blue-500"    title="Calls (24h)"       description="Rolling 24-hour call count across all agents." />
                <FeatureRow icon={CalendarDays} iconColor="text-amber-500"   title="Calls This Week"   description="Since Monday PHT." />
                <FeatureRow icon={CalendarDays} iconColor="text-rose-500"    title="Calls This Month"  description="Since 1st of the month PHT." />
                <FeatureRow icon={Link2}        iconColor="text-emerald-500" title="Avg Connect Rate"  description="Completed ÷ total calls × 100 — team average." />
              </div>
            </Card>
            <Card className="space-y-3">
              <SubLabel>Agent Performance Heatmap</SubLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Matrix table: each row is an agent, each column is a metric. Darker cells = stronger relative performance. Agents sorted by total assigned leads.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold mb-1.5">Columns per agent:</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {["Total Calls", "Calls (24h)", "Calls / Week", "Avg Duration", "Connect Rate", "Appointments", "Leads Assigned", "Quality Score"].map((c) => (
                    <p key={c} className="text-xs text-muted-foreground">· {c}</p>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ── WORKSPACE ── */}
        <Section id="workspace">
          <SectionHeader icon={LayoutGrid} iconColor="bg-teal-500/15 text-teal-500" title="Workspace" subtitle="Kanban, Calendar, and team collaboration tools" />
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: LayoutGrid,  color: "text-teal-500", href: "/kanban",   title: "Kanban Board",  desc: "Tasks move through To Do → In Progress → Review → Done. Admins create and assign tasks with due dates. All roles can view the full board." },
              { icon: CalendarDays, color: "text-blue-500", href: "/calendar", title: "Calendar",      desc: "Shared team calendar for events and meetings. Boss/admin create and manage events. All other users view only." },
              { icon: Bug,         color: "text-rose-500",  href: "/feedback", title: "Bug Reports",   desc: "Any team member can submit a bug or feature request. Boss/admin change status (New → In Progress → Resolved → Closed) and track resolution." },
            ].map((s) => (
              <Card key={s.title} className="space-y-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <GoLink href={s.href} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ── ADMIN TOOLS ── */}
        <Section id="admin">
          <SectionHeader icon={Settings} iconColor="bg-slate-500/15 text-slate-500" title="Admin Tools" subtitle="User management and global configuration" href="/admin/users" />
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-semibold">Users</p>
                <GoLink href="/admin/users" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create and manage team accounts. Assign roles, set GHL User IDs for call attribution, view per-agent stats, and import agents from GHL.
              </p>
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold mb-1.5">Assignable roles:</p>
                <div className="flex flex-wrap gap-1.5">
                  <RoleChip role="boss"           color="bg-violet-500/15 text-violet-500" />
                  <RoleChip role="admin"          color="bg-blue-500/15 text-blue-500" />
                  <RoleChip role="team_lead"      color="bg-amber-500/15 text-amber-600" />
                  <RoleChip role="sales_rep"      color="bg-emerald-500/15 text-emerald-600" />
                  <RoleChip role="lead_specialist" color="bg-rose-500/15 text-rose-500" />
                </div>
              </div>
            </Card>
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold">Settings <span className="text-[10px] font-normal text-muted-foreground ml-1">Boss only</span></p>
                <GoLink href="/settings" />
              </div>
              <div className="space-y-2.5">
                <FeatureRow icon={Building2}     iconColor="text-muted-foreground" title="Company Name"          description="Your organisation's display name across the platform." />
                <FeatureRow icon={Bot}           iconColor="text-amber-500"        title="Scraping Defaults"     description="Max leads per job, scraping interval, global pause toggle." />
                <FeatureRow icon={Star}          iconColor="text-emerald-500"      title="Quality Thresholds"    description="Good (default 70%) and Medium (default 40%) cutoffs for lead quality." />
                <FeatureRow icon={BadgeDollarSign} iconColor="text-rose-500"       title="Commission Currency"   description="₱ $ € £ ¥ ₩ ₹ A$ C$ R — applies across all commission values." />
                <FeatureRow icon={Webhook}       iconColor="text-blue-500"         title="GHL Integration"       description="API key, Location ID, webhook bearer secret, and webhook URL." />
                <FeatureRow icon={Palette}       iconColor="text-violet-500"       title="UI Theme"              description="7 accent schemes: Neutral, Blue, Violet, Emerald, Rose, Amber, Teal." />
              </div>
            </Card>
          </div>
          <Card className="flex gap-2.5">
            <UserCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">My Profile</p>
                <GoLink href="/profile" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Update your display name, profile photo, and password. Your photo appears in the top nav and on leaderboard cards.</p>
            </div>
          </Card>
        </Section>

        {/* ── ROLE REFERENCE ── */}
        <Section id="roles">
          <SectionHeader icon={Key} iconColor="bg-rose-500/15 text-rose-500" title="Role Reference" subtitle="What each role can access and do in DataForge" />
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-44">Feature</th>
                  {[
                    { label: "Boss",          color: "text-violet-500" },
                    { label: "Admin",         color: "text-blue-500"   },
                    { label: "Team Lead",     color: "text-amber-600"  },
                    { label: "Sales Rep",     color: "text-emerald-600"},
                    { label: "Lead Spec.",    color: "text-rose-500"   },
                  ].map((r) => (
                    <th key={r.label} className={`text-center px-3 py-3 font-bold ${r.color}`}>{r.label}</th>
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
                  ["Settings",             "✓","✗","✗","✗","✗"],
                  ["How It Works",          "✓","✓","✗","✗","✗"],
                ].map(([feat, ...vals]) => (
                  <tr key={feat} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-medium text-foreground/80">{feat}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="text-center px-3 py-2.5">
                        {v === "✓"
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                          : <XCircle     className="h-3.5 w-3.5 text-muted-foreground/25 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="flex gap-2.5 bg-muted/30">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Important:</strong> When adding a new agent, always create them in DataForge Users first and set their <strong className="text-foreground">GHL User ID</strong>. This is how call and appointment webhooks are matched to the right person. Without it, DataForge falls back to name matching — which works but is less reliable if two agents share similar names.
            </p>
          </Card>
        </Section>

      </div>
    </div>
  );
}
