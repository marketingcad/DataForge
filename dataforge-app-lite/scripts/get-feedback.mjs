import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_sv1KmzErbp7a@ep-orange-breeze-adpxdl35.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require');

const rows = await sql`
  SELECT
    fr.id,
    fr.type,
    fr.title,
    fr.description,
    fr.status,
    fr.priority,
    fr."createdAt",
    u.name as submitter_name,
    u.email as submitter_email,
    COUNT(fc.id)::int as comment_count
  FROM "FeedbackReport" fr
  LEFT JOIN "User" u ON u.id = fr."submittedBy"
  LEFT JOIN "FeedbackComment" fc ON fc."reportId" = fr.id
  GROUP BY fr.id, u.name, u.email
  ORDER BY fr."createdAt" DESC
`;

console.log(JSON.stringify(rows, null, 2));
