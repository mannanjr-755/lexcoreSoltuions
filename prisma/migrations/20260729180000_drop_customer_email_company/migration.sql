-- Remove customer email/company permanently (CRM no longer stores these fields).
DROP INDEX IF EXISTS "customers_email_idx";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "email";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "company";
