CREATE TABLE IF NOT EXISTS "FeedbackComment" (
  "id"        TEXT         NOT NULL,
  "reportId"  TEXT         NOT NULL,
  "authorId"  TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FeedbackComment_reportId_idx" ON "FeedbackComment"("reportId");
CREATE INDEX IF NOT EXISTS "FeedbackComment_authorId_idx" ON "FeedbackComment"("authorId");

ALTER TABLE "FeedbackComment"
  ADD CONSTRAINT "FeedbackComment_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "FeedbackReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackComment"
  ADD CONSTRAINT "FeedbackComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
