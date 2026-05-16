import { and, asc, count, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import { auditLog } from "../../db/schema";

type Exec = DbTx | typeof db;

export interface ListFilter {
  actor?: string;
  action?: string;
  page: number;
  size: number;
}

export async function listEntries(filter: ListFilter, exec: Exec = db) {
  const where = and(
    filter.actor ? eq(auditLog.actorUserId, filter.actor) : undefined,
    filter.action ? ilike(auditLog.action, `%${filter.action}%`) : undefined,
  );
  const offset = (filter.page - 1) * filter.size;
  const [rows, totalRow] = await Promise.all([
    exec
      .select()
      .from(auditLog)
      .where(where as any)
      .orderBy(desc(auditLog.id))
      .limit(filter.size)
      .offset(offset),
    exec
      .select({ c: count() })
      .from(auditLog)
      .where(where as any),
  ]);
  return { rows, total: Number(totalRow[0]?.c ?? 0) };
}
