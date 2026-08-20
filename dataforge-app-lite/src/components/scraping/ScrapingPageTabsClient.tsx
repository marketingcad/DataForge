"use client";

import dynamic from "next/dynamic";

const ScrapingPageTabsDynamic = dynamic(
  () => import("./ScrapingPageTabs").then((m) => ({ default: m.ScrapingPageTabs })),
  { ssr: false }
);

interface Props {
  canUseKeywords: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keywords: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs: any[];
  canManageAll: boolean;
  currentUserId: string;
}

export function ScrapingPageTabsClient(props: Props) {
  return <ScrapingPageTabsDynamic {...props} />;
}
