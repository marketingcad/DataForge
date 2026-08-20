-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('boss', 'admin', 'sales_rep', 'lead_specialist');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'lead_specialist';
