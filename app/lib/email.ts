import nodemailer from "nodemailer";
import { SHOP } from "./config";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export type OrderEmail = {
  to: string;
  name: string;
  ref: string;
  dateLabel: string;
  slot: string | null;
  details: string;
  giftNote: string | null;
  total: number;
  deposit: number;
  depositPercent: number;
};

function bankBlock(ref: string): string {
  const acct = process.env.BANK_ACCOUNT_NUMBER;
  if (!acct) {
    console.error("BANK_ACCOUNT_NUMBER is not set; the email tells the customer to expect banking details on WhatsApp.");
    return `<p>We will WhatsApp you our banking details shortly. Please use <strong>${esc(ref)}</strong> as your payment reference.</p>`;
  }
  const rows = [
    ["Bank", process.env.BANK_NAME || ""],
    ["Account name", process.env.BANK_ACCOUNT_NAME || SHOP.name],
    ["Account number", acct],
    ["Branch code", process.env.BANK_BRANCH_CODE || ""],
  ].filter(([, v]) => v);
  return `
    <table style="font-size:14px;border-collapse:collapse;margin:8px 0;">
      ${rows.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#555;">${esc(k)}</td><td style="font-family:monospace;">${esc(v)}</td></tr>`).join("")}
    </table>
    <p><strong>Important:</strong> use <strong>${esc(ref)}</strong> as your payment reference.</p>`;
}

export async function sendOrderEmail(o: OrderEmail) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  await transporter.sendMail({
    from: `"${SHOP.name}" <${process.env.GMAIL_USER}>`,
    to: o.to,
    cc: process.env.GMAIL_USER,
    subject: `Order received: ${o.ref} (action needed)`,
    html: `
      <div style="font-family: Georgia, serif; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center; letter-spacing: 4px;">PULP</h1>
        <p style="text-align: center;">${esc(SHOP.collection)}</p>
        <hr style="border: none; border-top: 1px solid #111; width: 50px; margin: 20px auto;" />
        <p>Hi ${esc(o.name)},</p>
        <p>Thank you for your order. Here is what we have:</p>
        <ul style="list-style: none; padding: 0; line-height: 1.7;">
          <li><strong>Order reference:</strong> ${esc(o.ref)}</li>
          <li><strong>Collection:</strong> ${esc(o.dateLabel)}${o.slot ? `, ${esc(o.slot)}` : ""}</li>
          <li><strong>Order:</strong> ${esc(o.details)}</li>
          ${o.giftNote ? `<li><strong>Gift note:</strong> ${esc(o.giftNote)}</li>` : ""}
          <li><strong>Total:</strong> R${o.total.toFixed(2)}</li>
        </ul>
        <div style="background-color: #FDF6E9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">To confirm your order, pay your ${o.depositPercent}% deposit (R${o.deposit.toFixed(2)}) within 24 hours</h3>
          ${bankBlock(o.ref)}
        </div>
        <p>Once we receive your deposit we will confirm your order. We will message you on WhatsApp to arrange collection.</p>
        <p>Warm regards,<br/>The Pulp Team</p>
      </div>`,
  });
}

export type MailerInput = { to: string; subject: string; body: string; unsubscribeUrl: string | null };

/** A marketing email. Plain text from the admin is escaped and turned into paragraphs; every mail carries an opt-out. */
export async function sendMailerEmail(m: MailerInput, transporter = mailTransport()) {
  const paragraphs = m.body.trim().split(/\n{2,}/).map((p) => `<p style="line-height:1.6;">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  const optOut = m.unsubscribeUrl
    ? `You are getting this because you agreed to hear from us when you ordered. <a href="${esc(m.unsubscribeUrl)}" style="color:#555;">Unsubscribe</a>.`
    : `You are getting this because you agreed to hear from us when you ordered. Reply STOP and we will remove you.`;
  await transporter.sendMail({
    from: `"${SHOP.name}" <${process.env.GMAIL_USER}>`,
    to: m.to,
    subject: m.subject,
    headers: m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>` } : undefined,
    text: `${m.body.trim()}\n\n--\n${m.unsubscribeUrl ? `Unsubscribe: ${m.unsubscribeUrl}` : "Reply STOP to opt out."}`,
    html: `
      <div style="font-family: Georgia, serif; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center; letter-spacing: 4px;">PULP</h1>
        <hr style="border: none; border-top: 1px solid #111; width: 50px; margin: 20px auto;" />
        ${paragraphs}
        <p style="margin-top:24px;">Warm regards,<br/>The Pulp Team</p>
        <p style="font-size:12px;color:#777;margin-top:32px;border-top:1px solid #eee;padding-top:12px;">${optOut}</p>
      </div>`,
  });
}

export function mailTransport() {
  return nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
}
