-- Add job_title to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;

-- Create staff_invitations table
CREATE TABLE IF NOT EXISTS "staff_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "job_title" TEXT,
  "role" TEXT NOT NULL DEFAULT 'MANAGER',
  "permissions" JSONB,
  "token" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invited_by_id" UUID,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_invitations_role_fkey" FOREIGN KEY ("role") REFERENCES "staff_roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_token_key" ON "staff_invitations"("token");
CREATE INDEX IF NOT EXISTS "staff_invitations_email_idx" ON "staff_invitations"("email");
CREATE INDEX IF NOT EXISTS "staff_invitations_status_idx" ON "staff_invitations"("status");
