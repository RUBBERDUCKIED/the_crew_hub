// Google Calendar API — creates events on the user's primary calendar

export async function createCalendarEvent(accessToken, { jobName, address, contact, quoteNum, grandTotal, startISO, endISO, timeZone }) {
  const event = {
    summary:     `Window Cleaning — ${jobName}`,
    location:    address || '',
    description: `Customer: ${jobName}\nAddress: ${address || 'N/A'}\nContact: ${contact || 'N/A'}\nQuote #: ${quoteNum || 'N/A'}\nTotal: $${grandTotal ? grandTotal.toFixed(2) : 'N/A'}`,
    start:       { dateTime: startISO, timeZone },
    end:         { dateTime: endISO, timeZone },
    reminders:   { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
  };
  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  return resp.json();
}
