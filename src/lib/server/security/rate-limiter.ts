/**
 * Security utilities:
 * - Trusted client IP extraction (prevents trivial X-Forwarded-For spoofing)
 * - Atomic PostgreSQL-backed rate limiting (safe across serverless instances & concurrent requests)
 */

import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/db";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Extracts client IP from trusted proxy headers.
 * Prefers platform-verified single-client headers (`x-nf-client-connection-ip`, `cf-connecting-ip`)
 * and falls back to the rightmost proxy-appended IP in `x-forwarded-for`, never trusting a caller-forged leftmost value.
 */
export function extractTrustedClientIp(headers: Headers): string {
  const netlifyIp = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp) return netlifyIp;

  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export type AtomicRateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Atomically increments a sliding/fixed PostgreSQL rate-limit bucket using row-level locking
 * (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`), eliminating race conditions under parallel requests.
 */
export async function consumeRateLimitBucket(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<AtomicRateLimitResult> {
  const now = new Date();
  const nextExpiry = new Date(now.getTime() + params.windowSeconds * 1000);

  const rows = await prisma.$queryRaw<Array<{ count: number; expires_at: Date }>>`
    INSERT INTO rate_limit_buckets (key, count, window_start, expires_at)
    VALUES (${params.key}, 1, ${now}, ${nextExpiry})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets.expires_at <= ${now} THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_buckets.expires_at <= ${now} THEN ${now}
        ELSE rate_limit_buckets.window_start
      END,
      expires_at = CASE
        WHEN rate_limit_buckets.expires_at <= ${now} THEN ${nextExpiry}
        ELSE rate_limit_buckets.expires_at
      END
    RETURNING count, expires_at
  `;

  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const expiresAt = row?.expires_at ? new Date(row.expires_at) : nextExpiry;
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

  return {
    allowed: count <= params.limit,
    count,
    remaining: Math.max(0, params.limit - count),
    retryAfterSeconds,
  };
}

/**
 * Clears rate limit buckets matching prefix (intended strictly for test suites).
 */
export async function clearRateLimitBuckets(prefix?: string): Promise<void> {
  if (prefix) {
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { startsWith: prefix } },
    });
  } else {
    await prisma.rateLimitBucket.deleteMany({});
  }
}
