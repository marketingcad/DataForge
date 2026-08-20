"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";

const TRIVIA = [
  // Real facts
  "Did you know? About 45% of all internet traffic comes from bots and scrapers.",
  "The first web crawler, 'World Wide Web Wanderer', was built in 1993 to measure the size of the web.",
  "Google uses over 15,000 scraper bots daily to index the internet.",
  "A well-structured scraper can collect up to 10,000 leads per hour from public directories.",
  "LinkedIn blocks scrapers so aggressively it once sued a company for $1M over it.",
  "Robots.txt is just a suggestion — it has no legal enforcement power.",
  "Most business websites hide their email behind contact forms specifically to avoid scrapers.",
  "Phone numbers on YellowPages are 3x more accurate than ones scraped from random websites.",
  "73% of scraped emails from generic websites are catch-all addresses or never checked.",
  "Web scraping is legal in the US as long as you only collect publicly available data.",
  "Cloudflare blocks roughly 70% of scraping attempts across the websites it protects.",
  "The average business listing site updates its data every 30–90 days.",
  "Cheerio parses HTML 8x faster than a headless browser like Puppeteer.",
  "SerpAPI processes over 1 billion search queries per month for developers.",

  // Funny / impossible ones
  "Theoretically, you could scrape someone's fax number. Nobody will answer it though.",
  "We tried scraping the dark web for leads once. HR said no.",
  "Fun fact: scraping a website that only exists in someone's dream is technically impossible.",
  "You cannot scrape a business card from someone's pocket. Yet.",
  "In 2031, they say scrapers will be able to read minds. We're working on the API.",
  "Scraping a website that has no website is still unsolved by modern science.",
  "NASA once considered scraping Mars for B2B leads. Budget was cut.",
  "You can scrape a PDF, but at what cost? At what cost.",
  "There is no known scraper that can extract a business name from a handshake. Yet.",
  "Scraping a website written entirely in Comic Sans adds 200ms of psychological processing time.",
  "We cannot confirm or deny that we once attempted to scrape a pigeon's leg band for contact info.",

  // Tips
  "Pro tip: Scraping early morning (EST) gives better success rates — less traffic blocking you.",
  "Pro tip: Always check the /contact page first — it has the highest email hit rate.",
  "Pro tip: Businesses with websites are 4x more likely to respond to outreach than those without.",
  "Pro tip: A verified phone number is worth 10 unverified emails in outreach campaigns.",
  "Pro tip: State-specific searches yield higher quality leads than nationwide broad searches.",
];

interface ScrapingTriviaProps {
  visible: boolean;
  interval?: number;
}

export function ScrapingTrivia({ visible, interval = 5000 }: ScrapingTriviaProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TRIVIA.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % TRIVIA.length);
        setFade(true);
      }, 400);
    }, interval);
    return () => clearInterval(timer);
  }, [visible, interval]);

  if (!visible) return null;

  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground transition-opacity duration-400"
      style={{ opacity: fade ? 1 : 0 }}
    >
      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
      <span className="leading-relaxed">{TRIVIA[index]}</span>
    </div>
  );
}
