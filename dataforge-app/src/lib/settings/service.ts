import { prisma } from "@/lib/prisma";

export async function getSettings() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return settings;
}

export async function updateSettings(data: {
  companyName?: string;
  scrapingDefaultMaxLeads?: number;
  scrapingDefaultInterval?: number;
  scrapingGlobalPause?: boolean;
  leadQualityGoodThreshold?: number;
  leadQualityMediumThreshold?: number;
}) {
  return prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
}
