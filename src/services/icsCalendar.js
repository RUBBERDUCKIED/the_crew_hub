// .ics (iCalendar) file generator — universal calendar format
// Works with: Apple Calendar, Outlook, Samsung Calendar, Yahoo, and any app that supports .ics

/**
 * Generate an .ics file content string and trigger a download.
 * @param {Object} opts
 * @param {string} opts.jobName     Customer name
 * @param {string} opts.address     Job address
 * @param {string} opts.contact     Contact info
 * @param {string} opts.quoteNum    Quote number
 * @param {number} opts.grandTotal  Job total
 * @param {string} opts.startISO    Start datetime (YYYY-MM-DDTHH:mm:ss)
 * @param {string} opts.endISO      End datetime (YYYY-MM-DDTHH:mm:ss)
 * @param {string} opts.timeZone    IANA timezone (e.g. America/Vancouver)
 * @param {string} opts.serviceLabel  Service type label
 */
export function downloadIcsFile({ jobName, address, contact, quoteNum, grandTotal, startISO, endISO, timeZone, serviceLabel }) {
  const summary  = `${serviceLabel || 'Job'} — ${jobName}`;
  const location = (address || '').replace(/,/g, '\\,');
  const desc     = [
    `Customer: ${jobName}`,
    `Address: ${address || 'N/A'}`,
    `Contact: ${contact || 'N/A'}`,
    `Quote #: ${quoteNum || 'N/A'}`,
    `Total: $${grandTotal ? grandTotal.toFixed(2) : 'N/A'}`,
  ].join('\\n');

  // Convert ISO strings to iCal format (remove dashes/colons)
  const toIcal = iso => iso.replace(/[-:]/g, '');
  const dtStart = toIcal(startISO);
  const dtEnd   = toIcal(endISO);
  const uid     = `crewhub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@thecrewhub.ca`;
  const now     = toIcal(new Date().toISOString().slice(0, 19));

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Crew Hub//Job Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}Z`,
    `DTSTART;TZID=${timeZone}:${dtStart}`,
    `DTEND;TZID=${timeZone}:${dtEnd}`,
    `SUMMARY:${summary.replace(/,/g, '\\,')}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${desc}`,
    'STATUS:CONFIRMED',
    `BEGIN:VALARM`,
    `TRIGGER:-P1D`,
    `ACTION:DISPLAY`,
    `DESCRIPTION:Reminder: ${summary}`,
    `END:VALARM`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(jobName || 'job').replace(/[^a-zA-Z0-9]/g, '_')}_${startISO.slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
