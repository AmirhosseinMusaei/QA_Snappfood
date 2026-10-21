import { z } from "zod";
import { parseJalaliOrGregorianDate } from "../utils/persian.ts";
export const roleSchema = z.enum([
  "agent",
  "team_lead",
  "manager",
  "qa_controller",
  "qa_supervisor",
  "admin",
]);
const text = z.string().max(10000);
export const assessmentInput = z
  .object({
    agent_id: z.string().min(1).optional(),
    form_type: z.enum(["support", "sales"]).optional(),
    form_id: text.optional(),
    form_version: z.number().int().positive().optional(),
    ticket_number: text.optional(),
    phone_number: text.optional(),
    project: text.optional(),
    vendor_id: text.optional(),
    vendor_title: text.optional(),
    voice_link: z.union([z.literal(""), z.url()]).optional(),
    registration_date: text.optional(),
    execution_date: text.optional(),
    check_date: z.string().optional(),
    sample_name: text.optional(),
    discount_or_coupon: text.optional(),
    description: text.optional(),
    fault_id: z.string().nullable().optional(),
    is_fraud: z.boolean().optional(),
    backend_general: z.boolean().optional(),
    fault_categories: z.array(z.string().max(100)).max(10).optional(),
    result: text.optional(),
    result_comment: text.optional(),
    mistake_count: z.number().int().min(0).max(100000).optional(),
    support_scores: z.record(z.string(), z.number().int().min(0)).optional(),
    sales_scores: z.record(z.string(), z.number().int().min(0)).optional(),
    total_score: z.number().int().min(0).max(100).optional(),
    revision: z.number().int().positive().optional(),
    confirm_duplicate: z.boolean().optional(),
    // Legacy clients may supply these, but server identity/IDs always win.
    controller_id: text.optional(),
    id: text.optional(),
    created_at: text.optional(),
    deleted_at: z.any().optional(),
  })
  .strict();
export function validDate(input: any) {
  const d = parseJalaliOrGregorianDate(input);
  if (!d) throw new Error("تاریخ نامعتبر است");
  return d;
}
export const problemInput = z
  .object({
    priority: z.enum(["High", "Medium", "Low", "Critical"]).optional(),
    issue_date: text.optional(),
    team: text.optional(),
    category: text.optional(),
    title: text.min(1).optional(),
    description: text.optional(),
    status: z.enum(["Pending", "Resolved"]).optional(),
    owner: text.optional(),
    resolved_at: text.nullable().optional(),
    solution_note: text.optional(),
  })
  .strict();
