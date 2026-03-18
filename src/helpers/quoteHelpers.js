// Pure quote/job helper functions — no DOM, no state

import { planIntervalDays } from './pricing.js';

export function parseQuoteDate(str) {
  if (!str) return null;
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  // "Mar 07, 26" or "Mar. 07, 26"
  let m = str.match(/([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (m) {
    const month = months[m[1].slice(0,3)];
    const day   = parseInt(m[2]);
    let year    = parseInt(m[3]);
    if (year < 100) year += 2000;
    if (month === undefined) return null;
    return new Date(year, month, day);
  }
  // "07-Mar-25"
  m = str.match(/(\d{1,2})-([A-Za-z]+)-(\d{2,4})/);
  if (m) {
    const month = months[m[2].slice(0,3)];
    const day   = parseInt(m[1]);
    let year    = parseInt(m[3]);
    if (year < 100) year += 2000;
    if (month === undefined) return null;
    return new Date(year, month, day);
  }
  // ISO fallback "2025-03-07"
  const iso = new Date(str);
  return isNaN(iso) ? null : iso;
}

export function getQuoteAgeDays(q) {
  if (!q.date) return 0;
  const parsed = parseQuoteDate(q.date);
  if (!parsed) return 0;
  const now = new Date();
  return Math.floor((now - parsed) / (1000 * 60 * 60 * 24));
}

export function getJobStage(q) {
  if (q.receipted) return 'complete';
  if (q.invoiced) return 'invoiced';
  if (q.won === true) return 'won';
  if (q.won === false) return 'lost';
  return 'quoted';
}

export function getAgingBadge(q) {
  if (getJobStage(q) !== 'quoted') return '';
  const days = getQuoteAgeDays(q);
  if (days >= 10) return `<span style="background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;white-space:nowrap;">🔴 ${days}d — Urgent</span>`;
  if (days >= 7)  return `<span style="background:#fff7ed;color:#c2410c;border:1.5px solid #fdba74;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;white-space:nowrap;">🟠 ${days}d — Nudge Again</span>`;
  if (days >= 1)  return `<span style="background:#fefce8;color:#a16207;border:1.5px solid #fde047;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;white-space:nowrap;">🟡 ${days}d — Follow Up</span>`;
  return '';
}

export function getNextDueDate(q) {
  const interval = planIntervalDays[q.plan];
  if (!interval) return null;
  // Priority: invoice date > scheduled date > quote date
  const baseStr = q.invoicedDate || (q.scheduledISO ? q.scheduledISO.slice(0,10) : null) || q.date;
  const base = parseQuoteDate(baseStr);
  if (!base) return null;
  return new Date(base.getTime() + interval * 24 * 60 * 60 * 1000);
}

export function getDaysUntilDue(q) {
  const next = getNextDueDate(q);
  if (!next) return null;
  const now = new Date();
  now.setHours(0,0,0,0);
  return Math.floor((next - now) / (1000 * 60 * 60 * 24));
}
