// Environment-based configuration.
// In dev, these come from .env via Vite's import.meta.env.
// In production, they are baked in at build time.
// Imported by legacy.js — all hardcoded API keys have been replaced with these.

export const CONFIG = {
  SUPABASE_URL:        import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON:       import.meta.env.VITE_SUPABASE_ANON,
  GOOGLE_CLIENT_ID:    import.meta.env.VITE_GOOGLE_CLIENT_ID,
  GOOGLE_MAPS_KEY:     import.meta.env.VITE_GOOGLE_MAPS_KEY,
  EMAILJS_USER_ID:     import.meta.env.VITE_EMAILJS_USER_ID,
  EMAILJS_SERVICE_ID:  import.meta.env.VITE_EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,

  // ── Business / locale defaults ─────────────────────────────────────────────
  // Override via .env: VITE_DEFAULT_LAT, VITE_DEFAULT_LNG, VITE_DEFAULT_CITY,
  // VITE_DEFAULT_TIMEZONE — useful when deploying for a different service area.
  DEFAULT_LAT:      parseFloat(import.meta.env.VITE_DEFAULT_LAT)  || 49.4991,
  DEFAULT_LNG:      parseFloat(import.meta.env.VITE_DEFAULT_LNG)  || -119.5937,
  DEFAULT_CITY:     import.meta.env.VITE_DEFAULT_CITY             || 'Penticton, BC',
  DEFAULT_TIMEZONE: import.meta.env.VITE_DEFAULT_TIMEZONE         || 'America/Vancouver',
};
