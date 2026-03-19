import Link from "next/link";
import { Database, Search, BarChart3, Users, ArrowRight, Zap, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
              <Database className="h-5 w-5 text-blue-600" />
              DataForge
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/sign-in">
                <Button size="sm">Sign in</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background dark:from-blue-950/20" />
        <div className="max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-6 text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
            Phase 2 — Automated Lead Discovery
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">
            Extract &amp; manage leads{" "}
            <span className="text-blue-600">at scale</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            DataForge discovers businesses via Google Maps, scrapes contact details automatically, and keeps your lead database clean with intelligent deduplication.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-in">
              <Button size="lg" className="gap-2">
                Sign in <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Everything you need to fill your CRM</h2>
            <p className="text-muted-foreground text-lg">Automated discovery, smart deduplication, and quality scoring — all in one place.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Search className="h-6 w-6 text-blue-600" />}
              title="Automated Discovery"
              description="Enter an industry and location — DataForge finds businesses via SerpAPI Google Maps and scrapes their contact details automatically."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-blue-600" />}
              title="Smart Deduplication"
              description="Phone, email, and website signals are normalized and cross-checked. A lead already in your database is never inserted twice, regardless of industry."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              title="Quality Scoring"
              description="Every lead gets a DataQualityScore based on field completeness and cross-industry signals. Scores only ever go up as more data is discovered."
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6 text-blue-600" />}
              title="Website Scraping"
              description="Axios + Cheerio scraper pulls emails, phones, and contact names from homepages, /contact, and /about pages — no browser required."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6 text-blue-600" />}
              title="Lead Management"
              description="Full CRUD interface with filters, pagination, status tracking, and inline editing. Export to CSV for GoHighLevel import."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6 text-blue-600" />}
              title="Serverless-Ready"
              description="Chunked processing keeps every scraping job within Vercel's 60-second timeout. Jobs continue automatically via Vercel Cron."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-muted-foreground text-lg">From keyword to contacts in three steps.</p>
          </div>
          <div className="space-y-8">
            <Step
              number="01"
              title="Create a scraping job"
              description='Enter an industry (e.g. "HVAC contractors") and a location (e.g. "Houston, TX") and set a lead target. DataForge queues the job instantly.'
            />
            <Step
              number="02"
              title="Automated discovery &amp; scraping"
              description="SerpAPI finds matching businesses on Google Maps. For each business, Cheerio scrapes the website to pull emails, phones, and contact names."
            />
            <Step
              number="03"
              title="Clean, scored leads in your database"
              description="Duplicates are merged, quality scores are updated, and all leads appear in your dashboard ready for export to GoHighLevel."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to start forging leads?</h2>
          <p className="text-blue-100 text-lg mb-8">Sign in and run your first scraping job in minutes.</p>
          <Link href="/sign-in">
            <Button size="lg" variant="secondary" className="gap-2">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Database className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-foreground">DataForge</span>
        </div>
        <p>Lead extraction &amp; management platform for GoHighLevel CRM.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-background rounded-xl border p-6 hover:shadow-md transition-shadow">
      <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-950/40">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center">
        {number}
      </div>
      <div className="pt-2">
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: description }} />
      </div>
    </div>
  );
}
