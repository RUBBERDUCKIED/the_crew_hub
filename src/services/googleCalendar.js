// Google Calendar API — manages business calendars and events

import { CONFIG } from '../config.js';

/**
 * Create a dedicated secondary calendar for a business.
 * Returns the new calendar object (includes .id which is the calendarId).
 */
export async function createBusinessCalendar(accessToken, businessName) {
  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary:  `${businessName} - Jobs`,
      timeZone: CONFIG.DEFAULT_TIMEZONE || 'America/Vancouver',
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create calendar (${resp.status})`);
  }
  return resp.json();
}

/**
 * Delete a secondary calendar (used when disconnecting).
 * Silently ignores errors — the calendar may already be deleted.
 */
export async function deleteBusinessCalendar(accessToken, calendarId) {
  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (_e) { /* ignore — calendar may not exist */ }
}

/**
 * Create an event on a calendar.
 * @param {string} calendarId  The calendar to add to (defaults to 'primary')
 */
export async function createCalendarEvent(accessToken, { jobName, address, contact, quoteNum, grandTotal, startISO, endISO, timeZone, serviceLabel, assignedName, notes }, calendarId = 'primary') {
  const descLines = [
    `Customer: ${jobName}`,
    `Address: ${address || 'N/A'}`,
    `Contact: ${contact || 'N/A'}`,
    `Quote #: ${quoteNum || 'N/A'}`,
    `Total: $${grandTotal ? grandTotal.toFixed(2) : 'N/A'}`,
  ];
  if (assignedName) descLines.push(`Assigned to: ${assignedName}`);
  if (notes) descLines.push(`\nNotes: ${notes}`);
  const event = {
    summary:     `${serviceLabel || 'Job'} — ${jobName}${assignedName ? ` (${assignedName})` : ''}`,
    location:    address || '',
    description: descLines.join('\n'),
    start:       { dateTime: startISO, timeZone },
    end:         { dateTime: endISO, timeZone },
    reminders:   { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
  };
  const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  return resp.json();
}
