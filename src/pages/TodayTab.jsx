import { useState, useEffect, useRef } from 'react';
import useAppStore from '../state/useAppStore.js';
import { CONFIG } from '../config.js';
import { dbClockIn as _dbClockIn, dbClockOut as _dbClockOut, dbGetActiveClockIn, dbGetTimeEntries } from '../db/timeEntries.js';
import { weatherIcon, weatherDesc, isWindowCleaningWeather } from '../helpers/weather.js';
import { esc } from '../helpers/formatting.js';

// ─────────────────────────────────────────────────────────────
// TodayTab — React component replacing legacy renderToday()
// ─────────────────────────────────────────────────────────────

export default function TodayTab() {
  const savedQuotes       = useAppStore(s => s.savedQuotes);
  const customers         = useAppStore(s => s.customers);
  const currentMemberId   = useAppStore(s => s.currentMemberId);
  const currentBusinessId = useAppStore(s => s.currentBusinessId);

  const [weather, setWeather]           = useState(null);
  const [clockEntry, setClockEntry]     = useState(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed]           = useState('0h 0m');
  const [weekData, setWeekData]         = useState(null);
  const [doneState, setDoneState]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('twc_today_done') || '{}'); } catch { return {}; }
  });

  const mapRef     = useRef(null);   // Leaflet map instance
  const mapElRef   = useRef(null);   // DOM element for the map
  const markersRef = useRef([]);     // Leaflet marker instances
  const timerRef   = useRef(null);   // setInterval ID for clock

  // ── Derived: today's jobs ──
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dayLabel = today.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const todayJobs = savedQuotes
    .map((q, i) => ({ ...q, _idx: i }))
    .filter(q => q.scheduled && q.scheduledISO && q.scheduledISO.slice(0, 10) === todayStr)
    .sort((a, b) => (a.scheduledISO || '').localeCompare(b.scheduledISO || ''));

  const totalRev = todayJobs.reduce((sum, q) => sum + (q.grand || 0), 0);

  // ── Weather fetch ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.DEFAULT_LAT}&longitude=${CONFIG.DEFAULT_LNG}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh&timezone=${encodeURIComponent(CONFIG.DEFAULT_TIMEZONE)}`);
        const data = await resp.json();
        if (!cancelled) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            wind: Math.round(data.current.windspeed_10m),
            code: data.current.weathercode,
          });
        }
      } catch (e) {
        console.warn('[CrewHub] Weather fetch failed:', e);
        if (!cancelled) setWeather(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Clock status fetch ──
  useEffect(() => {
    if (!currentMemberId) return;
    dbGetActiveClockIn(currentMemberId).then(entry => setClockEntry(entry || null));
  }, [currentMemberId]);

  // ── Clock timer ──
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!clockEntry) { setElapsed('0h 0m'); return; }
    const clockInTime = new Date(clockEntry.clock_in).getTime();
    const update = () => {
      const totalMins = Math.floor((Date.now() - clockInTime) / 60000);
      setElapsed(`${Math.floor(totalMins / 60)}h ${totalMins % 60}m`);
    };
    update();
    timerRef.current = setInterval(update, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [clockEntry]);

  // ── Weekly hours fetch ──
  useEffect(() => {
    if (!currentMemberId) return;
    const now       = new Date();
    const dayOfWeek = now.getDay();
    const mondayOff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday    = new Date(now);
    monday.setDate(now.getDate() + mondayOff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startStr      = monday.toISOString().slice(0, 10);
    const endStr        = sunday.toISOString().slice(0, 10);
    const todayDateStr  = now.toISOString().slice(0, 10);

    dbGetTimeEntries(currentMemberId, startStr, endStr).then(entries => {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const days = [];
      let weekTotalMins = 0;

      for (let d = 0; d < 7; d++) {
        const date    = new Date(monday);
        date.setDate(monday.getDate() + d);
        const dateStr = date.toISOString().slice(0, 10);
        const isToday  = dateStr === todayDateStr;
        const isFuture = date > now && !isToday;
        const dayEntries = entries.filter(e => e.clock_in.slice(0, 10) === dateStr);

        let dayMins = 0, clockInStr = '', clockOutStr = '', breakMins = 0, isActive = false;
        dayEntries.forEach(e => {
          const inTime = new Date(e.clock_in);
          clockInStr = inTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
          breakMins += e.break_mins || 0;
          if (e.clock_out) {
            const outTime = new Date(e.clock_out);
            clockOutStr = outTime.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
            dayMins += Math.max(0, (outTime - inTime) / 60000 - (e.break_mins || 0));
          } else {
            isActive    = true;
            clockOutStr = '⏱ now';
            dayMins    += Math.max(0, (Date.now() - inTime.getTime()) / 60000 - (e.break_mins || 0));
          }
        });
        weekTotalMins += dayMins;
        days.push({ name: dayNames[d], dateLabel: date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), dayMins: Math.round(dayMins), clockInStr, clockOutStr, breakMins, isToday, isFuture, isActive, hasEntry: dayEntries.length > 0 });
      }

      setWeekData({ days, weekTotalMins, mondayLabel: monday.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }), sundayLabel: sunday.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) });
    });
  }, [currentMemberId, clockEntry]); // refetch when clock status changes

  // ── Leaflet map ──
  useEffect(() => {
    if (!mapElRef.current || typeof L === 'undefined') return;
    // Clean up old map
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    markersRef.current = [];

    const defaultCenter = [CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG];
    const map = L.map(mapElRef.current).setView(defaultCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // Force Leaflet to recalculate container size after render
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 200);

    if (!todayJobs.length) return;

    // Geocode and add markers (async)
    (async () => {
      const bounds = [];
      for (let i = 0; i < todayJobs.length; i++) {
        const q = todayJobs[i];
        if (!q.address) { markersRef.current.push(null); continue; }
        const coords  = await geocodeAddress(q.address);
        bounds.push(coords);
        const timeStr    = q.scheduledISO ? new Date(q.scheduledISO).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
        const markerHtml = `<div style="background:#1e7d93;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`;
        const icon       = L.divIcon({ html: markerHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
        const isFallback = coords[0] === CONFIG.DEFAULT_LAT && coords[1] === CONFIG.DEFAULT_LNG;
        const marker = L.marker(coords, { icon }).addTo(map)
          .bindPopup(`<b>${esc(q.name || '—')}</b><br>${esc(q.address || '')}<br><span style="color:#1e7d93;font-weight:700;">${timeStr}</span>${isFallback ? '<br><span style="color:#f97316;font-size:11px;">⚠ Approximate</span>' : ''}`);
        marker.on('click', () => handleFocusJob(i));
        markersRef.current.push(marker);
      }
      if (bounds.length && mapRef.current) {
        map.fitBounds(bounds, { padding: [40, 40] });
        // Ensure tiles render correctly after bounds change
        setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
      }
    })();

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [todayJobs.length]); // re-init when job count changes

  // ── Geocode helper — with localStorage cache (cap 200 entries) ──
  async function geocodeAddress(address) {
    const CACHE_KEY = 'twc_geocode_cache';
    const FALLBACK  = [CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG];
    const cacheKey  = address.toLowerCase().trim();

    // Check cache first
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (_) {}
    if (cache[cacheKey]) return cache[cacheKey];

    const city     = CONFIG.DEFAULT_CITY;
    const attempts = [
      encodeURIComponent(address + ', ' + city + ', Canada'),
      encodeURIComponent(address + ', ' + city),
      encodeURIComponent(address + ', BC, Canada'),
    ];
    for (const query of attempts) {
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, { headers: { 'Accept-Language': 'en' } });
        const data = await resp.json();
        if (data && data[0]) {
          const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          // Only cache real results, not the fallback center
          if (coords[0] !== FALLBACK[0] || coords[1] !== FALLBACK[1]) {
            if (Object.keys(cache).length >= 200) {
              delete cache[Object.keys(cache)[0]];
            }
            cache[cacheKey] = coords;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
          }
          return coords;
        }
      } catch (e) {
        console.warn('[CrewHub] Geocode failed for:', query, e);
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return FALLBACK;
  }

  // ── Handlers ──
  async function handleClockIn() {
    setClockLoading(true);
    try {
      const entry = await _dbClockIn(currentMemberId, currentBusinessId);
      setClockEntry(entry);
    } catch (e) { alert('Failed to clock in: ' + (e.message || e)); }
    setClockLoading(false);
  }

  async function handleClockOut() {
    if (!clockEntry) return;
    if (!confirm('Clock out and end your shift?')) return;
    setClockLoading(true);
    try {
      await _dbClockOut(clockEntry.id);
      setClockEntry(null);
    } catch (e) { alert('Failed to clock out: ' + (e.message || e)); }
    setClockLoading(false);
  }

  function handleToggleDone(key, quoteIdx, e) {
    e.stopPropagation();
    const next = { ...doneState };
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = true;
      // Generate invoice via legacy bridge
      if (quoteIdx !== undefined && quoteIdx >= 0 && window.generateInvoiceFromSaved) {
        window.generateInvoiceFromSaved(quoteIdx);
      }
    }
    setDoneState(next);
    localStorage.setItem('twc_today_done', JSON.stringify(next));
  }

  function handleFocusJob(cardIdx) {
    if (markersRef.current[cardIdx] && mapRef.current) {
      mapRef.current.setView(markersRef.current[cardIdx].getLatLng(), 15);
      markersRef.current[cardIdx].openPopup();
    }
  }

  // ── Helper ──
  const formatHM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // ── Render ──
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 60px' }}>

      {/* ── Clock Widget ── */}
      {currentMemberId && (
        clockEntry ? (
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, boxShadow: '0 4px 16px rgba(5,150,105,0.25)', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 15 }}>Clocked In</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13, marginTop: 2 }}>Since {new Date(clockEntry.clock_in).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 28, color: '#f0d000', letterSpacing: '0.02em' }}>{elapsed}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700 }}>worked today</div>
            </div>
            <button onClick={handleClockOut} disabled={clockLoading} style={{ background: 'white', color: '#dc2626', border: 'none', borderRadius: 30, padding: '12px 24px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              {clockLoading ? '⏳ Clocking out...' : '🔴 Clock Out'}
            </button>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, border: '2px solid var(--gray)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 900, fontSize: 15 }}>Not Clocked In</div>
                <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13, marginTop: 2 }}>Tap to start your shift</div>
              </div>
            </div>
            <button onClick={handleClockIn} disabled={clockLoading} style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', borderRadius: 30, padding: '12px 24px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
              {clockLoading ? '⏳ Clocking in...' : '🟢 Clock In'}
            </button>
          </div>
        )
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 22, color: 'var(--text)' }}>Today's Jobs</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{dayLabel}</div>
        </div>
        {/* Weather */}
        <div style={{ background: 'white', borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', minWidth: 160 }}>
          {weather ? (
            <>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{weatherIcon(weather.code)}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{weather.temp}°C</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{weatherDesc(weather.code)} · 💨 {weather.wind} km/h</div>
                <div style={{ fontSize: 11, fontWeight: 800, marginTop: 3, color: isWindowCleaningWeather(weather.code, weather.temp, weather.wind) ? '#059669' : '#dc2626' }}>
                  {isWindowCleaningWeather(weather.code, weather.temp, weather.wind) ? '✓ Good conditions' : '⚠ Check conditions'}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Weather loading...</div>
          )}
        </div>
      </div>

      {/* ── Revenue Bar ── */}
      <div style={{ background: 'linear-gradient(135deg,#1e7d93,#1a6ea8)', borderRadius: 14, padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Today's Revenue</div>
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 28, color: '#f0d000' }}>${totalRev.toFixed(2)}</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13 }}>{todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} scheduled</div>
      </div>

      {/* ── Map ── */}
      <div ref={mapElRef} style={{ borderRadius: 14, overflow: 'hidden', height: 300, marginBottom: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', background: '#e8f4f7' }} />

      {/* ── Job Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {todayJobs.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📅</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>No jobs scheduled for today</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Schedule jobs from the Pipeline tab using the 📅 Schedule button.</div>
          </div>
        ) : todayJobs.map((q, cardIdx) => {
          const isDone      = !!doneState[q.quoteNum || q._idx];
          const timeStr     = q.scheduledISO ? new Date(q.scheduledISO).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'No time set';
          const cust        = customers[q.customerId];
          const company     = q.company || (cust && cust.company) || '';
          const phone       = q.phone   || (cust && cust.phone)   || '';
          const stageColor  = isDone ? '#059669' : '#1e7d93';
          const stageBg     = isDone ? '#d1fae5' : '#e8f4f7';

          return (
            <div key={q.id || cardIdx} onClick={() => handleFocusJob(cardIdx)} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: `2px solid ${isDone ? '#6ee7b7' : '#e8f4f7'}`, cursor: 'pointer', transition: 'border-color 0.2s' }}>
              {/* Header */}
              <div style={{ background: stageBg, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 16, color: stageColor }}>{timeStr}</div>
                  <div style={{ background: stageColor, color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800 }}>{q.type || 'Job'}</div>
                  {isDone && <div style={{ background: '#059669', color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800 }}>🧾 INVOICED</div>}
                </div>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 18, color: stageColor }}>${(q.grand || 0).toFixed(2)}</div>
              </div>
              {/* Body */}
              <div style={{ padding: '14px 18px' }}>
                <div>
                  {company && <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{company}</div>}
                  <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{q.name || '—'}</div>
                  {q.address && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>📍 {q.address}</div>}
                  {phone && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>📞 {phone}</div>}
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {q.address && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(q.address + ', ' + CONFIG.DEFAULT_CITY)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ background: '#1e7d93', color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      🗺 Navigate
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} onClick={e => e.stopPropagation()} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      📞 Call
                    </a>
                  )}
                  <button onClick={(e) => handleToggleDone(q.quoteNum || q._idx, q._idx, e)} style={{ background: isDone ? '#f1f5f9' : '#f0d000', color: isDone ? 'var(--muted)' : 'var(--blue-dark)', border: 'none', borderRadius: 20, padding: '8px 16px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                    {isDone ? '↩ Mark Undone' : '✓ Mark Done'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── My Hours Weekly Summary ── */}
      {weekData && currentMemberId && (
        <div style={{ marginTop: 24, background: 'white', borderRadius: 14, border: '2px solid var(--gray)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ background: '#f4fbfc', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--gray)' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>⏱ My Hours This Week</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{weekData.mondayLabel} – {weekData.sundayLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 22, color: 'var(--teal-dark)' }}>{Math.floor(weekData.weekTotalMins / 60)}h {Math.round(weekData.weekTotalMins % 60)}m</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>week total</div>
            </div>
          </div>
          <div style={{ padding: '6px 12px' }}>
            {weekData.days.map((d, i) => {
              if (d.isFuture && !d.hasEntry) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', borderBottom: '1px solid #f1f5f9', opacity: 0.4 }}>
                    <div style={{ width: 36, fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{d.name}</div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginLeft: 8 }}>{d.dateLabel}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>—</div>
                  </div>
                );
              }
              if (!d.hasEntry) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 36, fontSize: 12, fontWeight: 800, color: d.isToday ? 'var(--teal-dark)' : 'var(--muted)' }}>{d.name}</div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginLeft: 8 }}>{d.dateLabel}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{d.isToday ? 'not clocked in' : '— not worked —'}</div>
                  </div>
                );
              }
              const barWidth = d.dayMins > 0 ? Math.min(100, Math.round(d.dayMins / 600 * 100)) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', borderBottom: '1px solid #f1f5f9', ...(d.isToday ? { background: '#f0fdf4', borderRadius: 8 } : {}) }}>
                  <div style={{ width: 36, fontSize: 12, fontWeight: 800, color: d.isToday ? 'var(--teal-dark)' : 'var(--text)' }}>{d.name}</div>
                  <div style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{d.clockInStr} – {d.clockOutStr}{d.breakMins > 0 ? ` (${d.breakMins}m break)` : ''}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: d.isActive ? '#059669' : 'var(--text)' }}>{formatHM(d.dayMins)}{d.isActive ? ' ⏱' : ''}</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                      <div style={{ background: d.isActive ? '#10b981' : 'var(--teal)', width: `${barWidth}%`, height: '100%', borderRadius: 20, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
