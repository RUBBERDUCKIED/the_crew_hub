import { CONFIG } from '../config.js';

// window.supabase is loaded by the CDN <script> in index.html before any modules run.
export const _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON);
