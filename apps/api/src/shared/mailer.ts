/**
 * Nodemailer transport pointing at MailHog locally (feat3). In a real
 * deployment swap SMTP_* env vars and you keep the same call sites.
 */

import nodemailer, { type Transporter } from "nodemailer";

const host = process.env.SMTP_HOST ?? "mailhog";
const port = Number(process.env.SMTP_PORT ?? 1025);
const user = process.env.SMTP_USER ?? "";
const pass = process.env.SMTP_PASS ?? "";
const secure = (process.env.SMTP_SECURE ?? "false") === "true";
const from = process.env.SMTP_FROM ?? "SwiftDrop <no-reply@swiftdrop.local>";

let cached: Transporter | null = null;

function transport(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user || pass ? { user, pass } : undefined,
  });
  return cached;
}

export async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  await transport().sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });
}

export function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:8080";
}
