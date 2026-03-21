// ═══════════════════════════════════════════════════════════════════════════════
// ═══ LEGACY BRIDGE ═══
// All existing Crew Hub app logic, migrated from the single-file index.html.
// Functions are exposed to window.* so inline onclick handlers keep working.
// This bridge will be gradually replaced as tabs convert to React components.
// ═══════════════════════════════════════════════════════════════════════════════

// initGooglePlaces stub is defined in index.html as an inline <script> that runs
// before the Maps SDK defer tag and before this module. It sets window._mapsApiReady
// = true when Maps fires the callback. After initLegacyApp() runs, we check that
// flag and call the real init if we missed the callback.

import { CONFIG } from './config.js';
import { _sb as _sbClient }                                                              from './db/supabaseClient.js';
import { dbSaveJob as _dbSaveJob, dbDeleteJob as _dbDeleteJob, dbLoadAllJobs }                                               from './db/jobs.js';
import { dbSaveCustomer as _dbSaveCustomer, dbDeleteCustomer as _dbDeleteCustomer, dbLoadAllCustomers, dbUploadCustomerPhoto as _dbUploadCustomerPhoto, dbDeleteCustomerPhoto as _dbDeleteCustomerPhoto, dbUpdateCustomerPhotos as _dbUpdateCustomerPhotos } from './db/customers.js';
import { rowToNote, dbSaveNote as _dbSaveNote, dbDeleteNote as _dbDeleteNote, dbLoadAllNotes }                               from './db/notes.js';
import { dbSaveLead as _dbSaveLead, dbDeleteLead as _dbDeleteLead, dbSaveLeadsBatch as _dbSaveLeadsBatch, dbLoadAllLeads }   from './db/leads.js';
import { dbSaveNeighborhoodsBatch as _dbSaveNeighborhoodsBatch, dbLoadAllNeighborhoods }                                                                       from './db/neighborhoods.js';
import { dbClockIn as _dbClockIn, dbClockOut as _dbClockOut, dbUpdateBreakMins as _dbUpdateBreakMins }                       from './db/timeEntries.js';
import { dbLoadTeamMembers, dbAddTeamMember as _dbAddTeamMember, dbUpdateTeamMember, dbRemoveTeamMember, dbLoadBusinessInfo as _dbLoadBusinessInfo, dbUpdateBusiness as _dbUpdateBusiness, dbUploadLogo as _dbUploadLogo, dbRemoveLogo as _dbRemoveLogo } from './db/team.js';
import { dbBootstrapBusiness as _dbBootstrapBusiness, dbLoadIdentity as _dbLoadIdentity, dbClaimInvite as _dbClaimInvite, canAccess as _canAccess }            from './db/auth.js';

import { safeGet, esc, formatPhone } from './helpers/formatting.js';
import { parseQuoteDate, getAgingBadge } from './helpers/quoteHelpers.js';
import { resolveQuotePlugin, getAvailableServiceTypes } from './quotePlugins/pluginRegistry.js';
import { createCalendarEvent } from './services/googleCalendar.js';
import { driveSearchFiles, driveCreateFolder, driveUploadFile, driveDownloadBlob, driveDeleteFile } from './services/googleDrive.js';
import { sendEmail } from './services/emailService.js';
import useAppStore from './state/useAppStore.js';
import { syncAuthToStore, clearAuthInStore, syncDataToStore, syncAllToStore } from './state/legacyBridge.js';

function initLegacyApp() {
  // ╔══════════════════════════════════════════════════════════════╗
  // ║  THE CREW HUB — CODE MAP  (legacy.js)                       ║
  // ╠══════════════════════════════════════════════════════════════╣
  // ║  React tabs: Today, Pipeline, CRM, Reports, Leads           ║
  // ║  Legacy tabs: Quotes (form), Timesheets, Team (settings)    ║
  // ╠══════════════════════════════════════════════════════════════╣
  // ║                                                              ║
  // ║  1. APP STATE ............................ ~Line 81          ║
  // ║     Global vars, constants, localStorage cache              ║
  // ║                                                              ║
  // ║  2a. UTILITIES — Quoting UI .............. ~Line 228         ║
  // ║      setCondition, setPlan, setType, setSide,               ║
  // ║      calc, toggleAddon, onCustNameInput, formatPhone         ║
  // ║                                                              ║
  // ║  2b. UTILITIES — Google Places ........... ~Line 873         ║
  // ║      initGooglePlaces autocomplete                          ║
  // ║                                                              ║
  // ║  3. DATABASE ACCESS LAYER ................ ~Line 2362        ║
  // ║     db* wrappers for src/db/ modules                        ║
  // ║     stampLastContact, canAccess, dbClockIn/Out              ║
  // ║                                                              ║
  // ║  4. AUTH + ONBOARDING .................... ~Line 1863        ║
  // ║     handleSignIn, afterSignIn, syncNow, selectBusiness,     ║
  // ║     handleCreateBusiness, invite claim, sbSignOut,          ║
  // ║     showAuthModal / showNoBizModal                          ║
  // ║                                                              ║
  // ║  5a. CUSTOMER TABLE ...................... ~Line 1028        ║
  // ║      findOrCreateCustomer, dbSaveCustomer wrappers          ║
  // ║                                                              ║
  // ║  5b. QUOTING ENGINE ...................... ~Line 1157        ║
  // ║      saveQuote, deleteQuote, toggleWon, preFillFromQuote,   ║
  // ║      openScheduleModal, confirmSchedule                     ║
  // ║                                                              ║
  // ║  5c. QUOTE/RECEIPT/INVOICE TEMPLATES ..... ~Line 694        ║
  // ║      generateQuote, generateQuoteFromSaved,                 ║
  // ║      generateReceiptFromSaved, generateInvoiceFromSaved,    ║
  // ║      buildStandaloneHTML, downloadQuoteHTML, printQuote     ║
  // ║                                                              ║
  // ║  5d. EMAIL & COMMUNICATIONS .............. ~Line 864        ║
  // ║      sendDocumentEmail, sendReviewRequest                   ║
  // ║                                                              ║
  // ║  5e. PIPELINE HELPERS + RENDERERS ........ ~Line 1648       ║
  // ║      getAgingBadge, renderSchedDayPreview, updateDuration   ║
  // ║                                                              ║
  // ║  5f. LEAD PIPELINE ...................... ~Line ~2993        ║
  // ║      quoteFromLead (only active lead function)              ║
  // ║                                                              ║
  // ║  5g. PHOTO STORAGE (Google Drive) ........ ~Line 2608       ║
  // ║      handlePhotoUpload, deletePhotoDrive, fetchAndCacheLogo ║
  // ║                                                              ║
  // ║  6a. TAB SWITCHING ....................... ~Line 1709        ║
  // ║      switchTab (visibility only, React portals handle render)║
  // ║                                                              ║
  // ║  6f. ROLE PERMISSIONS & BUSINESS SETTINGS ~Line 2536        ║
  // ║      applyRolePermissions, loadBusinessInfo, saveBusinessInfo║
  // ║                                                              ║
  // ║  6g. PHOTO MODAL ......................... ~Line 2702        ║
  // ║      openPhotoModal, openPhotoModalByIndex, closePhotoModal  ║
  // ║                                                              ║
  // ║  6h. REVIEW REQUESTS ..................... ~Line 2819        ║
  // ║      sendReviewRequest, closeReviewModal                    ║
  // ║                                                              ║
  // ║  6i. EXPORT / IMPORT ..................... ~Line 1731        ║
  // ║      exportJSON, importJSON, exportCSV                      ║
  // ║                                                              ║
  // ║  7. BOOT ................................. ~Line 2999        ║
  // ║     syncAllToStore, onAuthStateChange, window bridge        ║
  // ║                                                              ║
  // ╚══════════════════════════════════════════════════════════════╝

  // ═══════════════════════════════════════════════════════════════
  // ═══ 1. APP STATE ═══
  // All global variables in one place. Nothing else declares globals.
  // ═══════════════════════════════════════════════════════════════

  // ── Config Constants (values sourced from .env via src/config.js) ──
  const _sb = _sbClient; // Shared Supabase client from src/db/supabaseClient.js
  const GOOG_CLIENT_ID    = CONFIG.GOOGLE_CLIENT_ID;

  // ── EmailJS init (moved here from inline <script> in index.html) ──
  if (typeof emailjs !== 'undefined') emailjs.init(CONFIG.EMAILJS_USER_ID);
  const GOOG_SCOPES       = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.events';
  const PHOTO_FOLDER_NAME = 'CrewHub Photos';
  // ── Auth & Identity ──
  let sbUser            = null;
  let isSyncing         = false;
  let gAccessToken      = null;
  let gTokenExpiry      = 0;
  let currentBusinessId = null;
  let currentMemberId   = null;
  let currentUserRole   = 'owner'; // 'owner' | 'admin' | 'dispatcher' | 'crew'
  // Auth flow state (multi-step modal)
  let _authInviteId    = null;   // UUID from ?invite= URL param
  let _authInviteInfo  = null;   // { business_name, role, email } from get_invite_info RPC
  let _authMemberships = [];     // All active team_members rows (multi-business picker)
  let _justCreatedBusiness = false; // Flag for onboarding type detection

  // ── Core Data (populated from Supabase on sign-in; localStorage is read cache) ──
  let savedQuotes        = safeGet('twc_quotes', []);
  let customers          = safeGet('twc_customers', {});
  let deletedCustomerIds = safeGet('twc_deleted_customers', []);
  let crmArchived        = safeGet('twc_crm_archived', []); // kept for migration only
  let crmNotes           = JSON.parse(localStorage.getItem('twc_crm_notes')     || '{}');
  let crmOverrides       = JSON.parse(localStorage.getItem('twc_crm_overrides') || '{}');
  let leads              = safeGet('twc_leads', []);
  let neighborhoods      = safeGet('twc_neighborhoods', []);
  let customerPhotos     = {};
  let photoBlobCache     = {};
  let cachedLogoB64      = ''; // Legacy b64 cache disabled — logos come from Supabase Storage now

  // ── One-time migration: purge ghost customers (no customerId) left by old bug ──
  (function purgeGhostCustomers() {
    const raw = customers;
    let dirty = false;
    Object.keys(raw).forEach(k => {
      if (!raw[k].customerId) { delete raw[k]; dirty = true; }
    });
    if (dirty) {
      try { localStorage.setItem('twc_customers', JSON.stringify(raw)); } catch(e) {}
      console.info('[CrewHub] Ghost customer records purged.');
    }
  })();

  // ── UI State ──
  // propType, cleaningSide, windowCondition, servicePlan are now owned by the
  // active quote plugin (module closure in e.g. windowCleaningPlugin.js).
  let activePlugin       = null;          // Resolved once at login by initPluginAndUI()
  let currentLines       = [];
  let currentGrand       = 0;
  let currentSubtotal    = 0;
  let currentCustomerId  = null;
  let photoFolderId      = null;
  let photoModalKey      = null;
  let placesReady        = false;
  let _pendingReceiptIdx = null;
  let _emailDocMeta      = { toEmail: '', subject: '', docType: '' };
  let _autoSyncTimer     = null;


  // ── DOM value helpers (still used by calc shared-adjustments and doc generators) ──
  function v(id) { const el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; }
  function s(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

  // ── Brand-aware color helper for doc templates (inline styles can't use CSS vars) ──
  function docColors() {
    const cs = getComputedStyle(document.documentElement);
    const gv = name => cs.getPropertyValue(name).trim();
    return {
      teal:      gv('--teal')       || '#1e7d93',
      tealDark:  gv('--teal-dark')  || '#1a6ea8',
      blue:      gv('--blue')       || '#145689',
      blueDark:  gv('--blue-dark')  || '#0e3d5e',
      tealLight: gv('--teal-light') || '#2a9db5',
      offwhite:  gv('--offwhite')   || '#f4fbfc',
      gray:      gv('--gray')       || '#eaf4f7',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 2. Utilities — Customer Typeahead & Quoting UI ═══
  // Depends on: CUSTOMER TABLE (customers, currentCustomerId,
  //               findOrCreateCustomer, getPhotosForCustomer)
  //             GOOGLE PLACES (attachPlacesAutocomplete)
  //             PHOTO STORAGE (updateQuotePhotoPanel, renderQuotePhotoGrid)
  //             QUOTE/RECEIPT TEMPLATES (generateReceiptFromSaved)
  //             SUPABASE (autoSync via saveQuote → pushSync)
  // Called by:  Quote form HTML (oninput/onclick), TAB SWITCHING
  // ═══════════════════════════════════════════════════════════════

  function onCustNameInput() {
    const query = document.getElementById('custName').value.trim();
    // If user is typing, unlink any previously selected customer
    if (currentCustomerId) clearCustomerLink(true);
    updateCustBadge();
    showCustDropdown(query);
    updateQuotePhotoPanel();
  }

  function showCustDropdown(query) {
    const dd = document.getElementById('cust-dropdown');
    if (!query || query.length < 1) { dd.style.display = 'none'; return; }
    const normQ = query.toUpperCase();
    const matches = Object.values(customers)
      .filter(c => !c.archived &&
        ((c.name || '').toUpperCase().includes(normQ) ||
         (c.company || '').toUpperCase().includes(normQ) ||
         (c.address || '').toUpperCase().includes(normQ)))
      .slice(0, 8);
    if (!matches.length) { dd.style.display = 'none'; return; }
    dd.style.display = 'block';
    dd.innerHTML = matches.map(c => `
      <div onclick="selectCustomer('${c.customerId}')"
        style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; display:flex; flex-direction:column; gap:2px;"
        onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='white'">
        <div style="font-size:13px; font-weight:800; color:var(--text);">
          ${c.company ? `<span style="color:var(--teal-dark);font-size:11px;">${esc(c.company)} · </span>` : ''}${esc(c.name)}
        </div>
        <div style="font-size:11px; font-weight:600; color:var(--muted);">${[c.address, c.phone, c.email].filter(Boolean).join(' · ') || 'No address on file'}</div>
      </div>`).join('');
  }

  function closeCustDropdown() {
    const dd = document.getElementById('cust-dropdown');
    if (dd) dd.style.display = 'none';
    // If name was typed but no customer selected, show new badge
    const name = (document.getElementById('custName').value || '').trim();
    if (name && !currentCustomerId) {
      document.getElementById('cust-new-badge').style.display = 'inline-flex';
    }
  }

  function selectCustomer(customerId) {
    const c = customers[customerId];
    if (!c) return;
    currentCustomerId = customerId;
    // Fill all fields from customer record
    document.getElementById('custName').value    = c.name || '';
    document.getElementById('custAddress').value = c.address || '';
    document.getElementById('custPhone').value   = c.phone || '';
    document.getElementById('custEmail').value   = c.email || '';
    document.getElementById('custLeadSource').value = c.leadSource || '';
    document.getElementById('custCompany').value = c.company || '';
    document.getElementById('cust-dropdown').style.display = 'none';
    updateCustBadge();
    updateQuotePhotoPanel();
  }

  function clearCustomerLink(silent) {
    currentCustomerId = null;
    updateCustBadge();
    if (!silent) {
      // Clear fields so user can re-type
      document.getElementById('custAddress').value = '';
      document.getElementById('custPhone').value   = '';
      document.getElementById('custEmail').value   = '';
      document.getElementById('custLeadSource').value = '';
      document.getElementById('custCompany').value = '';
      document.getElementById('custName').focus();
    }
    updateQuotePhotoPanel();
  }

  function updateCustBadge() {
    const linked = document.getElementById('cust-linked-badge');
    const newBadge = document.getElementById('cust-new-badge');
    const name = (document.getElementById('custName').value || '').trim();
    if (currentCustomerId && customers[currentCustomerId]) {
      linked.style.display = 'inline-flex';
      newBadge.style.display = 'none';
    } else if (name) {
      linked.style.display = 'none';
      newBadge.style.display = 'inline-flex';
    } else {
      linked.style.display = 'none';
      newBadge.style.display = 'none';
    }
  }

  function getActivePhotoKey() {
    // Always prefer customerId — fall back to name-key only if no customer record exists at all
    if (currentCustomerId) return currentCustomerId;
    const name = (document.getElementById('custName')?.value || '').trim();
    if (!name) return null;
    // Try to find an existing customer with this name and use their ID
    const match = Object.values(customers).find(c =>
      (c.name || '').trim().toLowerCase() === name.toLowerCase() && !c.archived
    );
    if (match) return match.customerId;
    // Truly new customer not yet saved — use name key as last resort
    return name.toUpperCase();
  }

  function updateQuotePhotoPanel() {
    const key        = getActivePhotoKey();
    const signinNote = document.getElementById('quote-photo-signin-note');
    const nameNote   = document.getElementById('quote-photo-name-note');
    const photoUI    = document.getElementById('quote-photo-ui');
    if (signinNote) signinNote.style.display = 'none'; // no longer needed — Supabase Storage
    if (!key) {
      if (nameNote)  nameNote.style.display = 'block';
      if (photoUI)   photoUI.style.display  = 'none';
      return;
    }
    if (nameNote)  nameNote.style.display = 'none';
    if (photoUI)   photoUI.style.display  = 'block';
    renderQuotePhotoGrid(key);
  }

  function renderQuotePhotoGrid(key) {
    const grid = document.getElementById('quote-photo-grid');
    if (!grid) return;
    // If key is a customerId, also check legacy name key
    const c = key && customers[key] ? customers[key] : null;
    const legacyKey = c ? (c.name || '').trim().toUpperCase() : null;
    const photos = c
      ? getPhotosForCustomer(key, legacyKey)
      : (customerPhotos[key] || []);
    if (!photos.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = photos.map(p => `
      <div style="position:relative;border-radius:8px;overflow:hidden;background:#f1f5f9;aspect-ratio:1;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="openPhotoLightbox('${p.fileId}')">
        <img src="${p.url || ''}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.4);color:white;font-size:9px;font-weight:600;padding:3px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
      </div>`).join('');
  }

  async function handleQuoteCameraCapture() {
    const input = document.getElementById('quote-camera-input');
    const files = Array.from(input.files);
    if (!files.length) return;
    const key = getActivePhotoKey();
    if (!key) { alert('Please enter or select a customer first.'); return; }
    const status = document.getElementById('quote-photo-status');
    status.style.color = 'var(--teal)';
    status.textContent = 'Uploading photo...';
    try {
      const cust = customers[key] || Object.values(customers).find(c => (c.name||'').trim().toUpperCase() === key);
      const custId = cust ? cust.customerId : key;
      const meta = await _dbUploadCustomerPhoto(files[0], currentBusinessId, custId);
      if (!customerPhotos[key]) customerPhotos[key] = [];
      customerPhotos[key].push(meta);
      if (cust) await _dbUpdateCustomerPhotos(cust.customerId, customerPhotos[cust.customerId] || []);
      status.style.color = '#16a34a';
      status.textContent = '✓ Photo saved!';
      input.value = '';
      renderQuotePhotoGrid(key);
    } catch(e) {
      status.style.color = '#dc2626';
      status.textContent = 'Upload failed: ' + e.message;
    }
  }

  async function handleQuotePhotoUpload() {
    const key = getActivePhotoKey();
    if (!key) { alert('Please enter or select a customer first.'); return; }
    const input  = document.getElementById('quote-photo-input');
    const files  = Array.from(input.files);
    if (!files.length) return;
    const status = document.getElementById('quote-photo-status');
    const btn    = document.getElementById('quote-photo-btn');
    btn.disabled = true; btn.textContent = 'Uploading...';
    status.style.color = 'var(--teal)';
    status.textContent = `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}...`;
    try {
      const cust = customers[key] || Object.values(customers).find(c => (c.name||'').trim().toUpperCase() === key);
      const custId = cust ? cust.customerId : key;
      for (let i = 0; i < files.length; i++) {
        status.textContent = `Uploading ${i+1} of ${files.length}...`;
        const meta = await _dbUploadCustomerPhoto(files[i], currentBusinessId, custId);
        if (!customerPhotos[key]) customerPhotos[key] = [];
        customerPhotos[key].push(meta);
      }
      if (cust) await _dbUpdateCustomerPhotos(cust.customerId, customerPhotos[cust.customerId] || []);
      status.style.color = '#16a34a';
      status.textContent = `✓ ${files.length} photo${files.length > 1 ? 's' : ''} saved!`;
      input.value = '';
      renderQuotePhotoGrid(key);
    } catch(e) {
      status.style.color = '#dc2626';
      status.textContent = 'Upload failed: ' + e.message;
    }
    btn.disabled = false; btn.textContent = '⬆ Upload';
  }

  // ── Thin orchestrator ─────────────────────────────────────────────────────────
  // Gathers all field values from the plugin's rendered form, delegates pricing
  // to the active plugin, then applies shared travel / discount / tax on top.
  // Plugin-specific state (propType, condition, plan, etc.) lives in the plugin
  // module closure — this function never reads those directly.
  function calc() {
    if (!activePlugin) return;

    // ── Collect plugin field values ──────────────────────────────────────────
    const container = document.getElementById('service-fields-container');
    const fieldValues = {};
    if (container) {
      container.querySelectorAll('input, select').forEach(el => {
        if (!el.id) return;
        fieldValues[el.id] = (el.type === 'number') ? (parseFloat(el.value) || 0) : el.value;
      });
      // Addon toggle state: .addon elements that have class 'on'
      container.querySelectorAll('.addon[id]').forEach(el => {
        fieldValues[el.id] = el.classList.contains('on');
      });
    }

    // ── Plugin pricing ───────────────────────────────────────────────────────
    const pluginData  = activePlugin.buildQuoteData(fieldValues);
    const propType    = pluginData.type || 'Residential';
    const pluginResult = activePlugin.calculateLineItems(fieldValues, propType);
    let lines    = (pluginResult.lines    || []).slice();   // already { l, a, c } format
    let subtotal =  pluginResult.subtotal || 0;

    // ── Shared adjustments (travel, manual discounts, tax) ───────────────────
    const travel         = v('travel');
    const discountPct    = v('discount');
    const discountDollar = v('discountDollar');
    const taxPct         = v('tax');

    if (travel > 0) {
      subtotal += travel;
      lines.push({ l: 'Travel / call-out fee', a: travel, c: '' });
    }
    if (discountPct > 0) {
      const d = subtotal * discountPct / 100;
      subtotal -= d;
      lines.push({ l: `Discount  −${discountPct}%`, a: -d, c: 'disc' });
    }
    if (discountDollar > 0) {
      const d = Math.min(discountDollar, subtotal);
      subtotal -= d;
      lines.push({ l: `Discount  −$${discountDollar.toFixed(2)}`, a: -d, c: 'disc' });
    }
    const taxAmt = subtotal * taxPct / 100;
    if (taxPct > 0) lines.push({ l: `GST  ${taxPct}%`, a: taxAmt, c: 'tax-l' });

    const grand = subtotal + taxAmt;
    currentLines    = lines;
    currentGrand    = grand;
    currentSubtotal = subtotal;

    // ── Update display ───────────────────────────────────────────────────────
    const lineItemsEl = document.getElementById('lineItems');
    if (lineItemsEl) {
      lineItemsEl.innerHTML = lines.length
        ? lines.map(l => `
          <div class="line-item ${l.c}">
            <span class="li-label">${esc(l.l)}</span>
            <span class="li-amt">${l.a < 0 ? '−' : ''}$${Math.abs(l.a).toFixed(2)}</span>
          </div>`).join('')
        : '<div style="color:rgba(255,255,255,0.4);font-size:13px;padding:8px 0;">Enter details above to build your quote.</div>';
    }

    const totalEl = document.getElementById('totalAmt');
    if (totalEl) {
      totalEl.textContent = `$${grand.toFixed(2)}`;
      totalEl.classList.add('flash');
      setTimeout(() => totalEl.classList.remove('flash'), 220);
    }
    const subEl = document.getElementById('totalSub');
    if (subEl) subEl.textContent = `$${subtotal.toFixed(2)}`;

    // ── Build window._cur (read by saveQuote + document generators) ──────────
    window._cur = {
      grand, subtotal,
      ...pluginData,
      name:    s('custName'),
      address: s('custAddress'),
      company: s('custCompany') || '',
      phone:   s('custPhone'),
      email:   s('custEmail'),
      contact: (s('custPhone') + (s('custPhone') && s('custEmail') ? ' · ' : '') + s('custEmail')).trim(),
      notes:   s('custNotes'),
    };
  }

  function generateQuote() {
    if (!window._cur || currentGrand <= 0) {
      alert('Please fill in the service details above before generating a quote.');
      return;
    }

    const quoteNum = 'TWC-' + Date.now().toString().slice(-6);
    const today = new Date();
    const expiry = new Date(today); expiry.setDate(expiry.getDate() + 30);
    const fmt = d => d.toLocaleDateString('en-CA', { day:'numeric', month:'long', year:'numeric' });

    const bizName = s('bizName') || 'The Window Crew';
    const bizAddress = s('bizAddress');
    const bizPhone = s('bizPhone');
    const bizEmail = s('bizEmail');
    const custName = s('custName');
    const custAddress = s('custAddress');
    const custPhone = s('custPhone'); const custEmail = s('custEmail');
    const custContact = [custPhone, custEmail].filter(Boolean).join(' · ');
    const custNotes = s('custNotes');
    const custCompany = s('custCompany');

    const taxAmt = currentGrand - currentSubtotal;

    const lineRows = currentLines.filter(l => l.c !== 'tax-l' && l.c !== 'disc').map(l => `
      <tr>
        <td style="padding:13px 20px; font-size:14px; color:#1a3a4a; border-bottom:1px solid #eaf4f7;">${esc(l.l.replace(/\s{2,}/g, ' '))}</td>
        <td style="padding:13px 20px; text-align:right; font-size:14px; font-weight:700; color:#1a3a4a; border-bottom:1px solid #eaf4f7;">$${l.a.toFixed(2)}</td>
      </tr>`).join('');

    const discLine = currentLines.find(l => l.c === 'disc');
    const dc = docColors();

    document.getElementById('quoteDocument').innerHTML = `
      <div style="font-family:'Nunito',sans-serif;">

        <!-- Header bar -->
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:24px 28px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div style="min-width:0; flex:1;">
            ${logoImgTag(110) ? `<div style="margin-bottom:10px; text-align:left;">${logoImgTag(110)}</div>` : `<div style="background:${dc.tealLight}; display:inline-block; border-radius:10px; padding:8px 14px; margin-bottom:10px;"><span style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:18px; color:white; letter-spacing:0.02em;">${bizName}</span></div>`}
            ${bizAddress ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:4px;">📍 ${bizAddress}</div>` : ''}
            ${bizPhone ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">📞 ${bizPhone}</div>` : ''}
            ${bizEmail ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">✉️ ${bizEmail}</div>` : ''}
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:28px; color:white; letter-spacing:0.04em;">QUOTE</div>
            <div style="color:rgba(255,255,255,0.7); font-size:12px; font-weight:700; letter-spacing:0.1em; margin-top:2px;">${quoteNum}</div>
            <div style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:600; margin-top:8px;">Date: ${fmt(today)}</div>
            <div style="color:${dc.offwhite}; font-size:12px; font-weight:700; margin-top:2px;">Valid until: ${fmt(expiry)}</div>
          </div>
        </div>

        <!-- Customer info -->
        <div style="background:${dc.offwhite}; padding:22px 36px; display:flex; gap:40px; flex-wrap:wrap; border-bottom:2px solid ${dc.gray};">
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Prepared For</div>
            ${custCompany ? `<div style="font-size:14px; font-weight:800; color:${dc.tealLight};">${custCompany}</div>` : ''}
            <div style="font-size:16px; font-weight:800; color:#1a3a4a;">${custName || '—'}</div>
            ${custAddress ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${custAddress}</div>` : ''}
            ${custContact ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${custContact}</div>` : ''}
          </div>
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Service Type</div>
            <div style="display:inline-block; background:${dc.tealLight}; color:white; font-size:12px; font-weight:800; padding:4px 12px; border-radius:20px;">${propType}</div>
          </div>
        </div>

        <!-- Line items table -->
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:${dc.blueDark};">
              <th style="padding:11px 20px; text-align:left; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Description</th>
              <th style="padding:11px 20px; text-align:right; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="background:${dc.offwhite}; padding:20px 36px; border-top:2px solid ${dc.gray};">
          ${discLine ? `
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;">
            <span style="color:#6b9aaa; font-weight:600;">${discLine.l.replace(/\s{2,}/g,' ')}</span>
            <span style="color:${dc.tealLight}; font-weight:700;">−$${Math.abs(discLine.a).toFixed(2)}</span>
          </div>` : ''}
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;">
            <span style="color:#6b9aaa; font-weight:600;">Subtotal (excl. tax)</span>
            <span style="color:#1a3a4a; font-weight:700;">$${currentSubtotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;">
            <span style="color:#6b9aaa; font-weight:600;">GST ${v('tax')}%</span>
            <span style="color:#6b9aaa; font-weight:600;">$${taxAmt.toFixed(2)}</span>
          </div>
        </div>

        <!-- Total banner -->
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:22px 36px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:16px; color:rgba(255,255,255,0.8); letter-spacing:0.06em; text-transform:uppercase;">Total Due (inc. GST)</div>
          <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:42px; color:white; letter-spacing:-0.01em;">$${currentGrand.toFixed(2)}</div>
        </div>

        <!-- Footer -->
        <div style="padding:22px 36px 28px; background:white;">
          <div style="font-size:11px; font-weight:600; color:#aac4cc; text-align:center; margin-top:8px;">
            This quote is valid for 30 days from the date of issue. Prices may vary if site conditions differ from those described. Thank you for choosing ${bizName}!
          </div>
        </div>

      </div>
    `;

    setEmailMeta('', '', 'quote');
    document.getElementById('quoteModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function generateReceiptFromSaved(i) {
    const q = savedQuotes[i];
    // If payment method already chosen, go straight to receipt — no re-picking
    if (q.paymentMethod) {
      _buildReceipt(i, q.paymentMethod);
      return;
    }
    _pendingReceiptIdx = i;
    document.getElementById('paymentMethodModal').style.display = 'flex';
  }

  function selectPaymentMethod(method) {
    document.getElementById('paymentMethodModal').style.display = 'none';
    _buildReceipt(_pendingReceiptIdx, method);
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 5c. Quote / Receipt / Invoice Templates ═══
  // Depends on: CUSTOMER TABLE (customers for name/address lookup)
  //             QUOTING ENGINE (savedQuotes, quoteNum generation)
  //             EMAIL & COMMUNICATIONS (setEmailMeta to wire send btn)
  //             SUPABASE (autoSync via pushSync after status update)
  // Called by:  CUSTOMER TYPEAHEAD (generateQuote/Receipt),
  //             PIPELINE (generateQuoteFromSaved, generateInvoiceFromSaved)
  // ═══════════════════════════════════════════════════════════════

  async function _buildReceipt(i, paymentMethod) {
    const q = savedQuotes[i];
    if (!q.lines) { alert('This job was saved before receipt generation was added. Please rebuild it.'); return; }

    const refNum = q.quoteNum || 'TWC-' + Date.now().toString().slice(-6);
    const today = new Date();
    const fmt = d => d.toLocaleDateString('en-CA', { day:'numeric', month:'long', year:'numeric' });

    const bizName = s('bizName') || 'The Window Crew';
    const bizAddress = s('bizAddress');
    const bizPhone = s('bizPhone');
    const bizEmail = s('bizEmail');
    const taxAmt = q.grand - q.subtotal;
    const discLine = q.lines.find(l => l.c === 'disc');
    const dc = docColors();
    const lineRows = q.lines.filter(l => l.c !== 'tax-l' && l.c !== 'disc').map(l => `
      <tr>
        <td style="padding:13px 20px; font-size:14px; color:#1a3a4a; border-bottom:1px solid ${dc.gray};">${esc(l.l.replace(/\s{2,}/g, ' '))}</td>
        <td style="padding:13px 20px; text-align:right; font-size:14px; font-weight:700; color:#1a3a4a; border-bottom:1px solid ${dc.gray};">$${l.a.toFixed(2)}</td>
      </tr>`).join('');

    const prevLines = currentLines, prevGrand = currentGrand, prevSub = currentSubtotal;
    try {
    currentLines = q.lines; currentGrand = q.grand; currentSubtotal = q.subtotal;

    document.getElementById('quoteDocument').innerHTML = `
      <div style="font-family:'Nunito',sans-serif;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:24px 28px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div style="min-width:0; flex:1;">
            ${logoImgTag(110) ? `<div style="margin-bottom:10px; text-align:left;">${logoImgTag(110)}</div>` : `<div style="background:${dc.tealLight}; display:inline-block; border-radius:10px; padding:8px 14px; margin-bottom:10px;"><span style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:18px; color:white; letter-spacing:0.02em;">${bizName}</span></div>`}
            ${bizAddress ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:4px;">📍 ${bizAddress}</div>` : ''}
            ${bizPhone ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">📞 ${bizPhone}</div>` : ''}
            ${bizEmail ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">✉️ ${bizEmail}</div>` : ''}
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:28px; color:white; letter-spacing:0.04em;">RECEIPT</div>
            <div style="color:rgba(255,255,255,0.7); font-size:12px; font-weight:700; letter-spacing:0.1em; margin-top:2px;">Ref: ${refNum}</div>
            <div style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:600; margin-top:8px;">Date Paid: ${fmt(today)}</div>
            <div style="background:#10b981; display:inline-block; border-radius:20px; padding:3px 12px; margin-top:6px;">
              <span style="color:white; font-size:11px; font-weight:800; letter-spacing:0.06em;">✓ PAID IN FULL</span>
            </div>
          </div>
        </div>

        <!-- Customer info -->
        <div style="background:${dc.offwhite}; padding:22px 36px; display:flex; gap:40px; flex-wrap:wrap; border-bottom:2px solid ${dc.gray};">
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Receipt For</div>
            <div style="font-size:16px; font-weight:800; color:#1a3a4a;">${esc(q.name || '—')}</div>
            ${q.address ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${esc(q.address)}</div>` : ''}
            ${q.contact ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${esc(q.contact)}</div>` : ''}
          </div>
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Service Type</div>
            <div style="display:inline-block; background:${dc.tealLight}; color:white; font-size:12px; font-weight:800; padding:4px 12px; border-radius:20px;">${q.type}</div>
            <div style="margin-top:10px;">
              <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:4px;">Reference</div>
              <div style="font-size:12px; font-weight:700; color:#1a3a4a;">${refNum}</div>
            </div>
          </div>
        </div>

        <!-- Line items -->
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:${dc.blueDark};">
              <th style="padding:11px 20px; text-align:left; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Description</th>
              <th style="padding:11px 20px; text-align:right; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Amount</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>

        <!-- Totals -->
        <div style="background:${dc.offwhite}; padding:20px 36px; border-top:2px solid ${dc.gray};">
          ${discLine ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">${discLine.l.replace(/\s{2,}/g,' ')}</span><span style="color:${dc.tealLight}; font-weight:700;">−$${Math.abs(discLine.a).toFixed(2)}</span></div>` : ''}
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">Subtotal</span><span style="color:#1a3a4a; font-weight:700;">$${q.subtotal.toFixed(2)}</span></div>
          ${taxAmt > 0 ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">GST ${q.taxRate || 0}%</span><span style="color:#6b9aaa; font-weight:600;">$${taxAmt.toFixed(2)}</span></div>` : ''}
        </div>

        <!-- Amount Paid banner -->
        <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%); padding:22px 36px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:16px; color:rgba(255,255,255,0.85); letter-spacing:0.06em; text-transform:uppercase;">Amount Paid</div>
            <div style="font-size:12px; font-weight:600; color:rgba(255,255,255,0.65); margin-top:4px;">${fmt(today)}</div>
            <div style="margin-top:6px; background:rgba(255,255,255,0.2); display:inline-block; border-radius:20px; padding:3px 12px;">
              <span style="color:white; font-size:12px; font-weight:800;">💳 ${paymentMethod}</span>
            </div>
          </div>
          <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:42px; color:white; letter-spacing:-0.01em;">$${q.grand.toFixed(2)}</div>
        </div>

        <!-- Footer -->
        <div style="padding:22px 36px 28px; background:white;">
          <div style="background:#f0fdf4; border:2px solid #10b981; border-radius:10px; padding:14px 18px; margin-bottom:16px; text-align:center;">
            <div style="font-size:14px; font-weight:800; color:#065f46; margin-bottom:4px;">✓ Payment Received — Thank You!</div>
            <div style="font-size:12px; font-weight:600; color:#6b9aaa;">Please keep this receipt for your records. Reference: <strong>${refNum}</strong></div>
          </div>
          <div style="background:${dc.offwhite}; border:2px solid ${dc.tealLight}; border-radius:10px; padding:14px 18px; margin-bottom:12px;">
            <div style="font-size:14px; font-weight:800; color:#1a3a4a; margin-bottom:6px;">Happy with the service? ⭐</div>
            <div style="font-size:13px; font-weight:600; color:#1a3a4a; line-height:1.6;">If you were happy with our service, we'd love if you left us a quick review!<br>You'll get <span style="background:${dc.tealLight}; padding:2px 8px; border-radius:4px; font-weight:800; color:white;">$25 off</span> your next service — just show your review when you book again.</div>
          </div>
          <div style="font-size:11px; font-weight:600; color:#aac4cc; text-align:center;">Thank you for choosing ${bizName}! We appreciate your business.</div>
        </div>

      </div>`;

    setEmailMeta(resolveEmail(q), `Receipt – ${bizName}`, 'receipt', q.customerId);
    document.getElementById('quoteModal').style.display = 'block';
    document.body.style.overflow = 'hidden';

    savedQuotes[i].receipted = true;
    savedQuotes[i].paymentMethod = paymentMethod;
    if (!savedQuotes[i].reviewRequestSent) savedQuotes[i].reviewPending = true;
    if (savedQuotes[i].id) await dbSaveJob(savedQuotes[i]).catch(e => console.error('[CrewHub] receipt save error:', e));

    } finally {
      currentLines = prevLines; currentGrand = prevGrand; currentSubtotal = prevSub;
    }
  }

  function buildStandaloneHTML() {
    const content = document.getElementById('quoteDocument').innerHTML;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Quote — ${s('bizName') || 'Quote'}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Nunito', sans-serif; background: #e8f4f7; padding: 30px 16px 60px; }
.doc { max-width: 680px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 48px rgba(26,110,168,0.18); }
@media print {
  body { background: white; padding: 0; }
  .doc { box-shadow: none; border-radius: 0; max-width: 100%; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
</head>
<body>
<div class="doc">${content}</div>
</body>
</html>`;
  }

  function downloadQuoteHTML() {
    const html = buildStandaloneHTML();
    const custName = s('custName').replace(/[^a-z0-9]/gi, '_') || 'Quote';
    const quoteNum = document.querySelector('#quoteDocument [style*="TWC-"]')?.textContent || 'TWC';
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `WindowCrew_Quote_${custName}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 5d. Email & Communications ═══
  // Depends on: CUSTOMER TABLE (customers — resolves latest email)
  //             QUOTE/RECEIPT TEMPLATES (quoteDocument innerHTML)
  //             EmailJS SDK (window.emailjs — loaded in <head>)
  // Called by:  QUOTE/RECEIPT TEMPLATES (setEmailMeta wires send btn),
  //             user clicking 📧 Send Email button in quote modal
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // ═══ 2. Utilities — Google Places Autocomplete ═══
  // Depends on: Google Maps JS API (loaded async in <head>)
  //             Leaflet.js (for Today's map — loaded in <head>)
  // Called by:  CUSTOMER TYPEAHEAD (attachPlacesAutocomplete on
  //               address field), page load setTimeout fallback
  // ═══════════════════════════════════════════════════════════════

  window.initGooglePlaces = function() {
    placesReady = true;
    attachPlacesAutocomplete('custAddress');
  };

  function attachPlacesAutocomplete(inputId) {
    if (!placesReady || !window.google) return;
    const input = document.getElementById(inputId);
    if (!input || input._placesAttached) return;
    input._placesAttached = true;

    try {
      const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'ca' },
        fields: ['formatted_address'],
        types: ['address']
      });

      // Bias toward Penticton area
      autocomplete.setBounds(new google.maps.LatLngBounds(
        new google.maps.LatLng(49.40, -119.70),
        new google.maps.LatLng(49.60, -119.45)
      ));

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          input.value = place.formatted_address.replace(/, Canada$/, '');
        }
      });
    } catch(e) {
      console.warn('Places autocomplete unavailable', e);
    }
  }

  function resolveEmail(q) {
    // Check CRM customer record first (may have been updated after quote was saved)
    // customers is a keyed object so use direct lookup, not .find()
    if (q.customerId) {
      const cust = customers[q.customerId];
      if (cust && cust.email) return cust.email;
    }
    // Fall back to email stored on quote at time of creation
    return q.email || '';
  }

  function setEmailMeta(toEmail, subject, docType, customerId) {
    _emailDocMeta = { toEmail, subject, docType, customerId: customerId || null };
    // Show/hide send button based on whether we have an email
    const btn = document.getElementById('sendEmailBtn');
    if (btn) btn.style.display = toEmail ? 'inline-block' : 'none';
  }

  async function sendDocumentEmail() {
    const { toEmail, subject, docType } = _emailDocMeta;
    if (!toEmail) {
      alert('No email address on file for this customer. Edit them in the CRM to add one.');
      return;
    }
    const btn = document.getElementById('sendEmailBtn');
    btn.textContent = '⏳ Sending...';
    btn.disabled = true;
    try {
      // Build email header using HTML tables (Gmail strips flexbox entirely)
      const rawContent = document.getElementById('quoteDocument').innerHTML;
      const bizNameEmail = s('bizName') || 'The Window Crew';
      const bizAddrEmail = s('bizAddress') || '';
      const bizPhoneEmail = s('bizPhone') || '';
      const bizEmailEmail = s('bizEmail') || '';

      // Strip original header, keep only the body (customer info + line items)
      // Body starts at the light-background customer info section
      const dc = docColors();
      const bodyStart = rawContent.indexOf('<div style="background:' + dc.offwhite);
      const docBody = bodyStart !== -1 ? rawContent.slice(bodyStart) : rawContent;

      // Extract right-col content (QUOTE/INVOICE/RECEIPT title, number, dates)
      const rightColMatch = rawContent.match(/text-align:right; flex-shrink:0;">([\s\S]*?)<\/div>\s*<\/div>/);
      const docRightCol = rightColMatch ? rightColMatch[1].trim() : '';

      // Build clean table-based header — use Supabase logo URL if available (not base64)
      const logoPublicUrl = window._currentLogoUrl || null;
      const logoBlock = logoPublicUrl
        ? '<div style="margin-bottom:10px;"><img src="' + logoPublicUrl + '" alt="' + bizNameEmail + '" style="height:60px;max-width:200px;object-fit:contain;display:block;"></div>'
        : '<div style="background:' + dc.tealLight + ';display:inline-block;border-radius:10px;padding:8px 14px;margin-bottom:10px;">' +
            '<span style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:18px;color:white;letter-spacing:0.02em;">' + bizNameEmail + '</span>' +
          '</div>';
      const tableHeader = '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,' + dc.teal + ' 0%,' + dc.tealDark + ' 100%);">' +
        '<tr>' +
          '<td style="padding:24px 28px; vertical-align:middle;">' +
            logoBlock +
            (bizAddrEmail ? '<div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;margin-top:4px;">📍 ' + bizAddrEmail + '</div>' : '') +
            (bizPhoneEmail ? '<div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;margin-top:2px;">📞 ' + bizPhoneEmail + '</div>' : '') +
            (bizEmailEmail ? '<div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;margin-top:2px;">✉️ ' + bizEmailEmail + '</div>' : '') +
          '</td>' +
          '<td align="right" style="padding:24px 28px 24px 0; vertical-align:middle; text-align:right;">' +
            docRightCol +
          '</td>' +
        '</tr>' +
      '</table>';

      // Final email content: clean table header + body only
      let emailContent = tableHeader + docBody;
      // Strip ALL base64 data URIs — catches logo anywhere it may have slipped through
      emailContent = emailContent.replace(/<img[^>]*src="data:[^"]*"[^>]*>/gi, '');
      // Wrap in minimal email shell with fonts
      const emailHtml = `<!DOCTYPE html><html><head>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Montserrat:wght@700;900&display=swap" rel="stylesheet">
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{margin:0;padding:0;background:#f0f4f8;} .wrap{max-width:680px;margin:0 auto;}</style>
      </head><body><div class="wrap">${emailContent}</div></body></html>`;
      await sendEmail({
        toEmail,
        subject,
        htmlContent: emailHtml,
        fromName:  s('bizName')  || 'Your Business',
        fromEmail: s('bizEmail') || '',
      });
      btn.textContent = '✅ Sent!';
      btn.style.background = '#16a34a';
      if (_emailDocMeta.customerId) stampLastContact(_emailDocMeta.customerId);
      setTimeout(() => {
        btn.textContent = '📧 Send Email';
        btn.style.background = '#10b981';
        btn.disabled = false;
      }, 3000);
    } catch(err) {
      console.error('EmailJS error:', err);
      alert('Failed to send email. Check your internet connection and try again.\n\nError: ' + (err.text || err.message || JSON.stringify(err)));
      btn.textContent = '📧 Send Email';
      btn.disabled = false;
    }
  }

  function closeModal() {
    document.getElementById('quoteModal').style.display = 'none';
    document.body.style.overflow = '';
  }

  function printQuote() {
    const html = buildStandaloneHTML();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  // Close modal on backdrop click
  document.getElementById('quoteModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══ 5a. Customer Table ═══
  // Depends on: UTILITIES (safeGet, customers, deletedCustomerIds)
  // Called by:  QUOTING ENGINE (findOrCreateCustomer, saveCustomers),
  //             CRM (getCustomers, archiveCustomer),
  //             LEAD PIPELINE (sendLeadToCRM),
  //             SUPABASE (sync payload reads customers object)
  // ═══════════════════════════════════════════════════════════════

  async function findOrCreateCustomer(name, address, phone, email, company, leadSource) {
    const normName = (name || '').trim().toUpperCase();
    if (!normName) return null;
    const contact = (phone + (phone && email ? ' · ' : '') + email).trim();
    const existing = Object.values(customers).find(
      c => (c.name || '').trim().toUpperCase() === normName
    );
    if (existing) {
      if (address)    existing.address    = address;
      if (phone)      existing.phone      = phone;
      if (email)      existing.email      = email;
      if (contact)    existing.contact    = contact;
      if (company)    existing.company    = company;
      if (leadSource && !existing.leadSource) existing.leadSource = leadSource;
      await dbSaveCustomer(existing);
      return existing.customerId;
    }
    const customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const newCustomer = {
      customerId,
      name: name.trim(),
      address: address || '',
      phone: phone || '',
      email: email || '',
      contact: contact || '',
      company: company || '',
      leadSource: leadSource || '',
      tags: [],
      archived: false,
      createdAt: new Date().toISOString()
    };
    await dbSaveCustomer(newCustomer);
    return customerId;
  }

  function migrateToCustomerTable() {
    // Idempotent — safe to run on every load.
    // Also deduplicates customer records that share the same normalized name
    // (caused by earlier sync bug that stripped customerId from quotes).
    let changed = false;
    const nameToId = {};

    // Step 0: deduplicate existing customer records by normalized name.
    // Keep the oldest record (lowest createdAt) and remap quotes to it.
    Object.values(customers).forEach(c => {
      const norm = (c.name || 'Unknown').trim().toUpperCase();
      if (!nameToId[norm]) {
        nameToId[norm] = c.customerId;
      } else {
        // There is already a record for this name — pick the older one as canonical
        const existing = customers[nameToId[norm]];
        const keepId = (existing.createdAt || '') <= (c.createdAt || '')
          ? existing.customerId : c.customerId;
        const dropId = keepId === existing.customerId ? c.customerId : existing.customerId;
        nameToId[norm] = keepId;
        if (dropId !== keepId) {
          delete customers[dropId];
          changed = true;
        }
      }
    });

    // Step 1: re-stamp all quotes with the canonical customerId for their name
    savedQuotes.forEach(q => {
      const norm = (q.name || 'Unknown').trim().toUpperCase();
      // If quote points to a deleted/missing record, remap it
      if (q.customerId && !customers[q.customerId]) {
        q.customerId = nameToId[norm] || null;
        changed = true;
      }
      if (q.customerId && customers[q.customerId]) {
        // Already correctly linked — ensure nameToId is populated
        if (!nameToId[norm]) nameToId[norm] = q.customerId;
        return;
      }
      // Quote has no valid customerId — create or assign
      if (!nameToId[norm]) {
        const customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const ov = (window._crmOverridesForMigration || {})[norm] || {};
        const migrContact = ov.contact !== undefined ? ov.contact : (q.contact || '');
        const migrEmailMatch = migrContact.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        customers[customerId] = {
          customerId,
          name:     ov.name    || q.name    || 'Unknown',
          address:  ov.address || q.address || '',
          phone:    q.phone    || (migrEmailMatch ? migrContact.replace(migrEmailMatch[0],'').replace(/[·\s]+$/,'').trim() : migrContact),
          email:    q.email    || (migrEmailMatch ? migrEmailMatch[0] : ''),
          contact:  migrContact,
          company:  q.company  || '',
          archived: crmArchived.includes(norm),
          createdAt: q.date || new Date().toISOString()
        };
        nameToId[norm] = customerId;
        changed = true;
      }
      q.customerId = nameToId[norm];
      changed = true;
    });

    if (changed) {
      localStorage.setItem('twc_customers', JSON.stringify(customers));
      localStorage.setItem('twc_quotes',    JSON.stringify(savedQuotes));
    }
  }


  // Get all photos for a customer — checks both customerId key and legacy name key
  function getPhotosForCustomer(customerId, legacyNameKey) {
    const byId   = customerPhotos[customerId]    || [];
    const byName = customerPhotos[legacyNameKey] || [];
    const seen   = new Set(byId.map(p => p.fileId));
    const combined = [...byId];
    byName.forEach(p => { if (!seen.has(p.fileId)) combined.push(p); });
    return combined;
  }

  function saveCustomers() {
    localStorage.setItem('twc_customers', JSON.stringify(customers));
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 5b. Quoting Engine ═══
  // Depends on: CUSTOMER TABLE (findOrCreateCustomer, saveCustomers,
  //               customers object for ID lookups)
  //             QUOTE/RECEIPT TEMPLATES (generateReceiptFromSaved,
  //               generateQuoteFromSaved, generateInvoiceFromSaved)
  //             PHOTO MODAL (openPhotoModalByIndex)
  //             SUPABASE (autoSync after every save/delete/toggle)
  // Called by:  Quote form Save button, PIPELINE action buttons,
  //             LEAD PIPELINE (quoteFromLead pre-fills form)
  // ═══════════════════════════════════════════════════════════════

  async function saveQuote() {
    // ── Validate ──
    if (!window._cur || currentGrand <= 0) {
      alert('Please fill in the service details above before saving.');
      return;
    }
    const name = window._cur.name || prompt('Enter a name for this quote:');
    if (!name?.trim()) return;

    // ── Resolve customer ──
    const customerId = currentCustomerId || await findOrCreateCustomer(
      name.trim(),
      window._cur.address,
      window._cur.phone || '',
      window._cur.email || '',
      window._cur.company,
      (document.getElementById('custLeadSource')?.value || '')
    );

    // ── Save to database ──
    const noteText = window._cur.notes ? window._cur.notes.trim() : '';
    if (noteText && customerId) {
      const noteLabel = `[Quote ${new Date().toLocaleDateString('en-CA', { day:'numeric', month:'short', year:'numeric' })}] ${noteText}`;
      await dbSaveNote(customerId, noteLabel).catch(e => console.error('[CrewHub] quote note save error:', e));
    }

    const quoteObject = {
      customerId,
      name: name.trim(),
      address: window._cur.address,
      phone:   window._cur.phone || '',
      email:   window._cur.email || '',
      contact: window._cur.contact,
      company: window._cur.company || '',
      type: window._cur.type,
      grand: window._cur.grand,
      subtotal: window._cur.subtotal,
      std: window._cur.std,
      large: window._cur.large,
      addons: window._cur.addons,
      lines: currentLines,
      taxRate: v('tax'),
      won: null,
      condition: window._cur.condition || 'maintenance',
      plan:      window._cur.plan      || 'oneoff',
      quoteNum: 'TWC-' + Date.now().toString().slice(-6),
      date: new Date().toLocaleDateString('en-CA', { day:'2-digit', month:'short', year:'2-digit' })
    };
    await dbSaveJob(quoteObject);

    resetForm();
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-pipeline').classList.add('active');
    document.querySelector('[onclick*="pipeline"]').classList.add('active');
    generateQuoteFromSaved(0);
  }

  async function deleteQuote(i, e) {
    // ── Validate ──
    e.stopPropagation();
    if (!confirm('Delete this quote?')) return;

    // ── Delete from database ──
    const job = savedQuotes[i];
    if (job && job.id) {
      await dbDeleteJob(job.id);
    } else {
      savedQuotes.splice(i, 1);
      localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));
    }

  }

  async function toggleWon(i, val) {
    // ── Save to database ──
    savedQuotes[i].won = val;
    if (savedQuotes[i].id) await dbSaveJob(savedQuotes[i]);
    else localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));
    if (val === true && savedQuotes[i].customerId) stampLastContact(savedQuotes[i].customerId);

  }

  function openScheduleModal(i) {
    const q = savedQuotes[i];
    document.getElementById('schedModal-title').textContent = q.name + (q.address ? ' — ' + q.address : '');
    document.getElementById('schedModal-idx').value = i;
    document.getElementById('schedModal-duration').value = 4;
    updateDurationLabel(4);
    setTimeout(() => updateDurationLabel(document.getElementById('schedModal-duration').value), 50);
    document.getElementById('schedModal-day-preview').style.display = 'none';
    if (q.scheduledISO) {
      document.getElementById('schedModal-date').value = q.scheduledISO.slice(0,10);
      document.getElementById('schedModal-time').value = q.scheduledISO.slice(11,16);
      renderSchedDayPreview();
    } else {
      document.getElementById('schedModal-date').value = '';
      document.getElementById('schedModal-time').value = '08:00';
    }
    // Populate assign dropdown with team members
    const assignSel = document.getElementById('schedModal-assign');
    if (assignSel) {
      assignSel.innerHTML = '<option value="">— Unassigned —</option>';
      const roleLabel = { owner: 'Owner', admin: 'Admin', dispatcher: 'Dispatcher', crew: 'Crew' };
      (window._teamMembers || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} (${roleLabel[m.role] || m.role})`;
        if (q.assignedTo === m.id) opt.selected = true;
        assignSel.appendChild(opt);
      });
    }
    document.getElementById('schedModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function renderSchedDayPreview() {
    const dateVal = document.getElementById('schedModal-date').value;
    const panel   = document.getElementById('schedModal-day-preview');
    if (!dateVal) { panel.style.display = 'none'; return; }

    // Current job being scheduled (exclude it from the list so re-scheduling doesn't show itself)
    const currentIdx = parseInt(document.getElementById('schedModal-idx').value);

    const dayJobs = savedQuotes
      .map((q, i) => ({ ...q, _idx: i }))
      .filter(q => q.scheduled && q.scheduledISO && q.scheduledISO.slice(0,10) === dateVal && q._idx !== currentIdx)
      .sort((a, b) => (a.scheduledISO || '').localeCompare(b.scheduledISO || ''));

    if (!dayJobs.length) {
      panel.style.display = 'block';
      panel.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;font-size:12px;font-weight:700;color:#059669;">✓ No other jobs booked this day</div>`;
      return;
    }

    const rows = dayJobs.map(q => {
      const startStr = new Date(q.scheduledISO).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true });
      let endStr = '';
      if (q.scheduledEndISO) {
        endStr = new Date(q.scheduledEndISO).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true });
      } else if (q.scheduledMins) {
        // fallback: calc from stored mins
        const endMs = new Date(q.scheduledISO).getTime() + q.scheduledMins * 60000;
        endStr = new Date(endMs).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12:true });
      }
      const timeRange = endStr ? `${startStr} – ${endStr}` : startStr;
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #eaf4f7;">
        <div style="font-weight:800;font-size:12px;color:#1a6ea8;white-space:nowrap;min-width:110px;">${timeRange}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:12px;color:#1a3a4a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.name || '—')}</div>
          ${q.address ? `<div style="font-size:11px;color:#6b9aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.address)}</div>` : ''}
        </div>
        <div style="font-size:11px;font-weight:700;color:#0d9488;white-space:nowrap;">$${(q.grand||0).toFixed(2)}</div>
      </div>`;
    }).join('');

    panel.style.display = 'block';
    panel.innerHTML = `
      <div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:10px;padding:10px 14px;">
        <div style="font-size:11px;font-weight:800;color:#c2410c;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">⚠ ${dayJobs.length} job${dayJobs.length!==1?'s':''} already on this day</div>
        ${rows}
        <div style="font-size:10px;font-weight:600;color:#fb923c;margin-top:8px;">Double booking is allowed — this is just a heads up.</div>
      </div>`;
  }

  function updateDurationLabel(val) {
    const totalMins = parseInt(val) * 15;
    const hrs  = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const label = hrs > 0
      ? (mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`)
      : `${mins} min`;
    document.getElementById('schedModal-duration-label').textContent = label;
    // Compute and display end time
    const timeInput = document.getElementById('schedModal-time');
    const endEl = document.getElementById('schedModal-endtime');
    if (endEl && timeInput && timeInput.value) {
      const [h, m] = timeInput.value.split(':').map(Number);
      const startMins = h * 60 + m;
      const endMins = startMins + totalMins;
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;
      const ampm = endH >= 12 ? 'p.m.' : 'a.m.';
      const endH12 = endH % 12 || 12;
      endEl.textContent = `${endH12}:${String(endM).padStart(2,'0')} ${ampm}`;
    }
  }

  function closeScheduleModal() {
    document.getElementById('schedModal').style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── Assign Job Modal ──
  function openAssignModal(i) {
    const q = savedQuotes[i];
    document.getElementById('assignModal-idx').value = i;
    document.getElementById('assignModal-title').textContent = q.name + (q.address ? ' — ' + q.address : '');
    const list = document.getElementById('assignModal-list');
    const roleLabel = { owner: '👑 Owner', admin: '🛡️ Admin', dispatcher: '📋 Dispatcher', crew: '🔧 Crew' };
    const roleBg    = { owner: '#fef3c7', admin: '#f3e8ff', dispatcher: '#e0f2fe', crew: '#f0fdf4' };
    const roleColor = { owner: '#92400e', admin: '#6b21a8', dispatcher: '#0369a1', crew: '#065f46' };
    list.innerHTML = (window._teamMembers || []).map(m => {
      const isAssigned = q.assignedTo === m.id;
      return `<button onclick="doAssignJob('${m.id}')" style="width:100%;padding:12px 16px;background:${isAssigned ? '#f0fdf4' : '#f8fafc'};border:2px solid ${isAssigned ? '#86efac' : '#e2e8f0'};border-radius:12px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-family:'Nunito',sans-serif;">
        <div style="font-weight:800;font-size:14px;color:#1a3a4a;flex:1;">${esc(m.name)}${isAssigned ? ' ✓' : ''}</div>
        <span style="font-size:11px;font-weight:700;background:${roleBg[m.role] || '#f1f5f9'};color:${roleColor[m.role] || '#475569'};padding:2px 8px;border-radius:8px;">${roleLabel[m.role] || m.role}</span>
      </button>`;
    }).join('');
    // Add unassign option if currently assigned
    if (q.assignedTo) {
      list.innerHTML += `<button onclick="doAssignJob('')" style="width:100%;padding:10px 16px;background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;text-align:center;cursor:pointer;font-family:'Nunito',sans-serif;font-weight:800;font-size:13px;color:#dc2626;margin-top:4px;">Remove Assignment</button>`;
    }
    document.getElementById('assignModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
    document.body.style.overflow = '';
  }

  async function doAssignJob(memberId) {
    const i = parseInt(document.getElementById('assignModal-idx').value);
    const member = (window._teamMembers || []).find(m => m.id === memberId);
    // Confirmation for non-crew
    if (member && member.role !== 'crew') {
      const rl = { owner: 'Owner', admin: 'Admin', dispatcher: 'Dispatcher' }[member.role] || member.role;
      if (!confirm(`Are you sure you want to assign this job to ${member.name} (${rl})?`)) return;
    }
    savedQuotes[i].assignedTo = memberId || null;
    if (savedQuotes[i].id) await dbSaveJob(savedQuotes[i]);
    else localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));
    syncDataToStore({ savedQuotes });
    closeAssignModal();
  }

  async function confirmSchedule() {
    const i    = parseInt(document.getElementById('schedModal-idx').value);
    const date = document.getElementById('schedModal-date').value;
    const time = document.getElementById('schedModal-time').value || '08:00';
    if (!date) { alert('Please pick a date.'); return; }
    if (!gAccessToken) {
      if (confirm('Google Calendar access is needed.\n\nClick OK to connect.')) signIn();
      return;
    }

    // Check assignment
    const assignVal = document.getElementById('schedModal-assign')?.value || '';
    if (assignVal) {
      const assignedMember = (window._teamMembers || []).find(m => m.id === assignVal);
      if (assignedMember && assignedMember.role !== 'crew') {
        const rl = { owner: 'Owner', admin: 'Admin', dispatcher: 'Dispatcher' }[assignedMember.role] || assignedMember.role;
        if (!confirm(`Are you sure you want to assign this job to ${assignedMember.name} (${rl})?`)) return;
      }
    }

    const btn = document.getElementById('schedModal-confirm');
    btn.textContent = 'Saving...'; btn.disabled = true;

    const q = savedQuotes[i];
    const [hh, mm] = time.split(':').map(Number);
    const durationMins = parseInt(document.getElementById('schedModal-duration').value) * 15;
    const endTotalMins = hh * 60 + mm + durationMins;
    const startISO = `${date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
    const endISO   = `${date}T${String(Math.floor(endTotalMins/60)%24).padStart(2,'0')}:${String(endTotalMins%60).padStart(2,'0')}:00`;

    try {
      const result = await createCalendarEvent(gAccessToken, {
        jobName: q.name, address: q.address, contact: q.contact,
        quoteNum: q.quoteNum, grandTotal: q.grand,
        startISO, endISO, timeZone: CONFIG.DEFAULT_TIMEZONE,
        serviceLabel: activePlugin?.label || 'Job'
      });
      if (!result.id) throw new Error(result.error?.message || 'Calendar API error');

      // ── Persist schedule + assignment ──
      savedQuotes[i].scheduled       = true;
      savedQuotes[i].scheduledISO    = startISO;
      savedQuotes[i].scheduledEndISO = endISO;
      savedQuotes[i].scheduledMins   = durationMins;
      savedQuotes[i].assignedTo      = assignVal || null;
      if (savedQuotes[i].id) await dbSaveJob(savedQuotes[i]);
      else localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));

      // ── Update UI ──
      closeScheduleModal();
      alert('📅 Job scheduled! Event added to your Google Calendar.');
      if (q.customerId) stampLastContact(q.customerId);
    } catch(e) {
      console.error(e);
      alert('Could not connect to Google Calendar. ' + (e.message || ''));
    }
    btn.textContent = 'Add to Calendar'; btn.disabled = false;
  }

  function generateQuoteFromSaved(i) {
    const q = savedQuotes[i];
    if (!q.lines) { alert('This quote was saved before quote generation was added. Please rebuild it.'); return; }

    const quoteNum = q.quoteNum || 'TWC-' + Date.now().toString().slice(-6);
    const today = new Date();
    const expiry = new Date(today); expiry.setDate(expiry.getDate() + 30);
    const fmt = d => d.toLocaleDateString('en-CA', { day:'numeric', month:'long', year:'numeric' });

    const bizName = s('bizName') || 'The Window Crew';
    const bizAddress = s('bizAddress');
    const bizPhone = s('bizPhone');
    const bizEmail = s('bizEmail');
    const taxAmt = q.grand - q.subtotal;
    const discLine = q.lines.find(l => l.c === 'disc');
    const dc = docColors();
    const lineRows = q.lines.filter(l => l.c !== 'tax-l' && l.c !== 'disc').map(l => `
      <tr>
        <td style="padding:13px 20px; font-size:14px; color:#1a3a4a; border-bottom:1px solid ${dc.gray};">${esc(l.l.replace(/\s{2,}/g, ' '))}</td>
        <td style="padding:13px 20px; text-align:right; font-size:14px; font-weight:700; color:#1a3a4a; border-bottom:1px solid ${dc.gray};">$${l.a.toFixed(2)}</td>
      </tr>`).join('');

    // Temporarily set globals so buildStandaloneHTML works
    const prevLines = currentLines, prevGrand = currentGrand, prevSub = currentSubtotal;
    try {
    currentLines = q.lines; currentGrand = q.grand; currentSubtotal = q.subtotal;

    document.getElementById('quoteDocument').innerHTML = `
      <div style="font-family:'Nunito',sans-serif;">
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:24px 28px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div style="min-width:0; flex:1;">
            ${logoImgTag(110) ? `<div style="margin-bottom:10px; text-align:left;">${logoImgTag(110)}</div>` : `<div style="background:${dc.tealLight}; display:inline-block; border-radius:10px; padding:8px 14px; margin-bottom:10px;"><span style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:18px; color:white; letter-spacing:0.02em;">${bizName}</span></div>`}
            ${bizAddress ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:4px;">📍 ${bizAddress}</div>` : ''}
            ${bizPhone ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">📞 ${bizPhone}</div>` : ''}
            ${bizEmail ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">✉️ ${bizEmail}</div>` : ''}
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:28px; color:white; letter-spacing:0.04em;">QUOTE</div>
            <div style="color:rgba(255,255,255,0.7); font-size:12px; font-weight:700; letter-spacing:0.1em; margin-top:2px;">${quoteNum}</div>
            <div style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:600; margin-top:8px;">Date: ${fmt(today)}</div>
            <div style="color:${dc.offwhite}; font-size:12px; font-weight:700; margin-top:2px;">Valid until: ${fmt(expiry)}</div>
          </div>
        </div>
        <div style="background:${dc.offwhite}; padding:22px 36px; display:flex; gap:40px; flex-wrap:wrap; border-bottom:2px solid ${dc.gray};">
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Prepared For</div>
            <div style="font-size:16px; font-weight:800; color:#1a3a4a;">${esc(q.name || '—')}</div>
            ${q.address ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${esc(q.address)}</div>` : ''}
            ${q.contact ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${esc(q.contact)}</div>` : ''}
          </div>
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Service Type</div>
            <div style="display:inline-block; background:${dc.tealLight}; color:white; font-size:12px; font-weight:800; padding:4px 12px; border-radius:20px;">${q.type}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:${dc.blueDark};">
              <th style="padding:11px 20px; text-align:left; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Description</th>
              <th style="padding:11px 20px; text-align:right; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Amount</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>
        <div style="background:${dc.offwhite}; padding:20px 36px; border-top:2px solid ${dc.gray};">
          ${discLine ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">${discLine.l.replace(/\s{2,}/g,' ')}</span><span style="color:${dc.tealLight}; font-weight:700;">−$${Math.abs(discLine.a).toFixed(2)}</span></div>` : ''}
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">Subtotal (excl. tax)</span><span style="color:#1a3a4a; font-weight:700;">$${q.subtotal.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">GST ${q.taxRate || 5}%</span><span style="color:#6b9aaa; font-weight:600;">$${taxAmt.toFixed(2)}</span></div>
        </div>
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:22px 36px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:16px; color:rgba(255,255,255,0.8); letter-spacing:0.06em; text-transform:uppercase;">Total Due (inc. GST)</div>
          <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:42px; color:white; letter-spacing:-0.01em;">$${q.grand.toFixed(2)}</div>
        </div>
        <div style="padding:22px 36px 28px; background:white;">
          ${q.notes ? `<div style="margin-bottom:16px; background:${dc.offwhite}; border-left:4px solid ${dc.tealLight}; padding:12px 16px; border-radius:0 8px 8px 0;"><div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:4px;">Job Notes</div><div style="font-size:13px; font-weight:600; color:#1a3a4a;">${esc(q.notes)}</div></div>` : ''}
          <div style="font-size:11px; font-weight:600; color:#aac4cc; text-align:center; margin-top:8px;">This quote is valid for 30 days from the date of issue. Prices may vary if site conditions differ from those described. Thank you for choosing ${bizName}!</div>
        </div>
      </div>`;

    setEmailMeta(resolveEmail(q), `Quote ${quoteNum} – ${bizName}`, 'quote', q.customerId);
    document.getElementById('quoteModal').style.display = 'block';
    document.body.style.overflow = 'hidden';

    // restore globals
    } finally {
      currentLines = prevLines; currentGrand = prevGrand; currentSubtotal = prevSub;
    }
  }

  async function generateInvoiceFromSaved(i) {
    // ── Validate ──
    const q = savedQuotes[i];
    if (!q.lines) { alert('This quote was saved before invoice generation was added. Please rebuild it.'); return; }

    // ── Build template data ──
    const invoiceNum = q.quoteNum || 'TWC-' + Date.now().toString().slice(-6);
    const today = new Date();
    const dueDate = new Date(today); dueDate.setDate(dueDate.getDate() + 14);
    const fmt = d => d.toLocaleDateString('en-CA', { day:'numeric', month:'long', year:'numeric' });

    const bizName = s('bizName') || 'The Window Crew';
    const bizAddress = s('bizAddress');
    const bizPhone = s('bizPhone');
    const bizEmail = s('bizEmail');
    const taxAmt = q.grand - q.subtotal;
    const discLine = q.lines.find(l => l.c === 'disc');
    const dc = docColors();
    const lineRows = q.lines.filter(l => l.c !== 'tax-l' && l.c !== 'disc').map(l => `
      <tr>
        <td style="padding:13px 20px; font-size:14px; color:#1a3a4a; border-bottom:1px solid ${dc.gray};">${esc(l.l.replace(/\s{2,}/g, ' '))}</td>
        <td style="padding:13px 20px; text-align:right; font-size:14px; font-weight:700; color:#1a3a4a; border-bottom:1px solid ${dc.gray};">$${l.a.toFixed(2)}</td>
      </tr>`).join('');

    const prevLines = currentLines, prevGrand = currentGrand, prevSub = currentSubtotal;
    try {
    currentLines = q.lines; currentGrand = q.grand; currentSubtotal = q.subtotal;

    document.getElementById('quoteDocument').innerHTML = `
      <div style="font-family:'Nunito',sans-serif;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:24px 28px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div style="min-width:0; flex:1;">
            ${logoImgTag(110) ? `<div style="margin-bottom:10px; text-align:left;">${logoImgTag(110)}</div>` : `<div style="background:${dc.tealLight}; display:inline-block; border-radius:10px; padding:8px 14px; margin-bottom:10px;"><span style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:18px; color:white; letter-spacing:0.02em;">${bizName}</span></div>`}
            ${bizAddress ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:4px;">📍 ${bizAddress}</div>` : ''}
            ${bizPhone ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">📞 ${bizPhone}</div>` : ''}
            ${bizEmail ? `<div style="color:rgba(255,255,255,0.85); font-size:13px; font-weight:600; margin-top:2px;">✉️ ${bizEmail}</div>` : ''}
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:28px; color:white; letter-spacing:0.04em;">INVOICE</div>
            <div style="color:rgba(255,255,255,0.7); font-size:12px; font-weight:700; letter-spacing:0.1em; margin-top:2px;">${invoiceNum}</div>
            <div style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:600; margin-top:8px;">Date: ${fmt(today)}</div>
            <div style="color:${dc.offwhite}; font-size:12px; font-weight:700; margin-top:2px;">Payment Due: ${fmt(dueDate)}</div>
          </div>
        </div>

        <!-- Customer info -->
        <div style="background:${dc.offwhite}; padding:22px 36px; display:flex; gap:40px; flex-wrap:wrap; border-bottom:2px solid ${dc.gray};">
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Bill To</div>
            <div style="font-size:16px; font-weight:800; color:#1a3a4a;">${esc(q.name || '—')}</div>
            ${q.address ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${esc(q.address)}</div>` : ''}
            ${q.contact ? `<div style="font-size:13px; font-weight:600; color:#6b9aaa; margin-top:2px;">${esc(q.contact)}</div>` : ''}
          </div>
          <div>
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:6px;">Service Type</div>
            <div style="display:inline-block; background:${dc.tealLight}; color:white; font-size:12px; font-weight:800; padding:4px 12px; border-radius:20px;">${q.type}</div>
            <div style="margin-top:10px;">
              <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:4px;">Ref. Quote</div>
              <div style="font-size:12px; font-weight:700; color:#1a3a4a;">${invoiceNum}</div>
            </div>
          </div>
        </div>

        <!-- Line items -->
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:${dc.blueDark};">
              <th style="padding:11px 20px; text-align:left; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Description</th>
              <th style="padding:11px 20px; text-align:right; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7);">Amount</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>

        <!-- Totals -->
        <div style="background:${dc.offwhite}; padding:20px 36px; border-top:2px solid ${dc.gray};">
          ${discLine ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">${discLine.l.replace(/\s{2,}/g,' ')}</span><span style="color:${dc.tealLight}; font-weight:700;">−$${Math.abs(discLine.a).toFixed(2)}</span></div>` : ''}
          <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">Subtotal</span><span style="color:#1a3a4a; font-weight:700;">$${q.subtotal.toFixed(2)}</span></div>
          ${taxAmt > 0 ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px;"><span style="color:#6b9aaa; font-weight:600;">GST ${q.taxRate || 0}%</span><span style="color:#6b9aaa; font-weight:600;">$${taxAmt.toFixed(2)}</span></div>` : ''}
        </div>

        <!-- Amount Due banner -->
        <div style="background:linear-gradient(135deg,${dc.teal} 0%,${dc.tealDark} 100%); padding:22px 36px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:16px; color:rgba(255,255,255,0.8); letter-spacing:0.06em; text-transform:uppercase;">Amount Due</div>
            <div style="font-size:12px; font-weight:600; color:rgba(255,255,255,0.55); margin-top:4px;">Due by ${fmt(dueDate)}</div>
          </div>
          <div style="font-family:'Montserrat',sans-serif; font-weight:900; font-size:42px; color:white; letter-spacing:-0.01em;">$${q.grand.toFixed(2)}</div>
        </div>

        <!-- Payment & notes -->
        <div style="padding:22px 36px 28px; background:white;">
          ${q.notes ? `<div style="margin-bottom:16px; background:${dc.offwhite}; border-left:4px solid ${dc.tealLight}; padding:12px 16px; border-radius:0 8px 8px 0;"><div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#6b9aaa; margin-bottom:4px;">Job Notes</div><div style="font-size:13px; font-weight:600; color:#1a3a4a;">${esc(q.notes)}</div></div>` : ''}
          <div style="background:#fffbea; border:2px solid ${dc.teal}; border-radius:10px; padding:14px 18px; margin-bottom:16px;">
            <div style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#b45309; margin-bottom:8px;">Payment Info</div>
            <div style="font-size:13px; font-weight:600; color:#1a3a4a; margin-bottom:10px;">Payment is due within <strong>15 days</strong> of the invoice date <strong>(Net 15)</strong>.</div>
            <div style="font-size:13px; font-weight:700; color:#1a3a4a; margin-bottom:6px;">We accept:</div>
            <div style="font-size:13px; font-weight:600; color:#1a3a4a; line-height:2;">
              💵 &nbsp;Cash<br>
              💳 &nbsp;Card (Square tap or chip)<br>
              📧 &nbsp;E-Transfer to: <strong>${bizEmail}</strong><br>
              📝 &nbsp;Cheque made out to: <strong>${bizName}</strong>
            </div>
          </div>
          <div style="background:${dc.offwhite}; border:2px solid ${dc.tealLight}; border-radius:10px; padding:14px 18px; margin-bottom:16px;">
            <div style="font-size:14px; font-weight:800; color:#1a3a4a; margin-bottom:6px;">Happy with the service? ⭐</div>
            <div style="font-size:13px; font-weight:600; color:#1a3a4a; line-height:1.6;">If you were happy with our service, we'd love if you left us a quick review!<br>You'll get <span style="background:${dc.tealLight}; padding:2px 8px; border-radius:4px; font-weight:800; color:white;">$25 off</span> your next service — just show your review when you book again.</div>
          </div>
          <div style="font-size:11px; font-weight:600; color:#aac4cc; text-align:center;">Thank you for choosing ${bizName}! We appreciate your business.</div>
        </div>

      </div>`;

    setEmailMeta(resolveEmail(q), `Invoice ${invoiceNum} – ${bizName}`, 'invoice', q.customerId);
    document.getElementById('quoteModal').style.display = 'block';
    document.body.style.overflow = 'hidden';

    savedQuotes[i].invoiced = true;
    if (!savedQuotes[i].invoicedDate) {
      savedQuotes[i].invoicedDate = new Date().toISOString().slice(0,10);
    }
    if (savedQuotes[i].id) await dbSaveJob(savedQuotes[i]).catch(e => console.error('[CrewHub] invoice save error:', e));

    } finally {
      currentLines = prevLines; currentGrand = prevGrand; currentSubtotal = prevSub;
    }
  }

  function preFillFromQuote(q) {
    // Switch to quotes tab
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-quotes').classList.add('active');
    document.querySelector('[onclick*="quotes"]').classList.add('active');

    // ── Shared customer fields ───────────────────────────────────────────────
    document.getElementById('custName').value    = q.name || '';
    document.getElementById('custAddress').value = q.address || '';
    document.getElementById('custPhone').value   = (currentCustomerId && customers[currentCustomerId]?.phone) || q.phone || '';
    document.getElementById('custEmail').value   = (currentCustomerId && customers[currentCustomerId]?.email) || q.email || '';
    document.getElementById('custNotes').value   = '';
    document.getElementById('custCompany').value = q.company || '';
    currentCustomerId = q.customerId || null;
    updateCustBadge();
    updateQuotePhotoPanel();

    // ── Delegate trade-specific pre-fill to the active plugin ────────────────
    if (activePlugin) activePlugin.preFillFromQuote(q);
    calc();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 5e. Pipeline Helpers + 6b. Pipeline Tab Renderers ═══
  // Depends on: QUOTING ENGINE (savedQuotes, deleteQuote, toggleWon,
  //               openScheduleModal, preFillFromQuote)
  //             CUSTOMER TABLE (customers for name/archive lookups)
  //             QUOTE/RECEIPT TEMPLATES (generateQuoteFromSaved,
  //               generateInvoiceFromSaved, generateReceiptFromSaved)
  //             PHOTO MODAL (openPhotoModalByIndex)
  //             REVIEW REQUESTS (renderReviewRequests)
  //             SUPABASE (autoSync after status changes)
  // Called by:  TAB SWITCHING (on pipeline tab click),
  //             SUPABASE (afterSignIn re-renders pipeline)
  // ═══════════════════════════════════════════════════════════════


  function resetForm() {
    // ── Reset shared customer fields ─────────────────────────────────────────
    ['custName','custAddress','custPhone','custEmail','custNotes','custCompany'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    currentCustomerId = null;
    updateCustBadge();

    // ── Reset shared adjustment fields ───────────────────────────────────────
    ['travel','discount','discountDollar','tax'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 0;
    });

    // ── Reset company-name field visibility (shared customer detail) ─────────
    const companyField = document.getElementById('company-name-field');
    if (companyField) companyField.style.display = 'none';
    const custNameLabel = document.getElementById('label-custName');
    if (custNameLabel) custNameLabel.textContent = 'Customer Name';

    // ── Delegate plugin field reset to the active plugin ─────────────────────
    if (activePlugin) activePlugin.resetFields();
    calc();
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 6a. Tab Switching ═══
  // Called by:  Tab button onclick="switchTab(...)" in HTML
  // All tab content is rendered by React — no render calls needed here.
  // ═══════════════════════════════════════════════════════════════
  function switchTab(tab, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    btn.classList.add('active');
  }



  // ── stampLastContact — call after any real customer interaction ──
  // Depends on: CUSTOMER TABLE (customers, saveCustomers)
  function stampLastContact(customerId) {
    if (!customerId || !customers[customerId]) return;
    customers[customerId].lastContactDate = new Date().toISOString();
    dbSaveCustomer(customers[customerId]).catch(e => console.error('[CrewHub] stampLastContact error:', e));
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 6i. Export / Import ═══
  // Depends on: QUOTING ENGINE (savedQuotes), CUSTOMER TABLE (customers),
  //             CRM (crmNotes), LEAD PIPELINE (leads, neighborhoods)
  //             UTILITIES (safeGet for re-hydrating on import)
  // Called by:  Reports tab Export/Import buttons (onclick in HTML)
  // ═══════════════════════════════════════════════════════════════
  function exportJSON() {
    const data = {
      exported: new Date().toISOString(),
      version: '2.0',
      customers,
      savedQuotes,
      crmNotes,
      leads: JSON.parse(localStorage.getItem('twc_leads') || '[]'),
      neighborhoods: JSON.parse(localStorage.getItem('twc_neighborhoods') || '[]'),
      leadsLastRun: localStorage.getItem('twc_leads_lastrun') || ''
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CrewHub_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        // ── Validate ──
        const data = JSON.parse(ev.target.result);
        if (!data.savedQuotes) { alert('Invalid backup file.'); return; }
        if (!confirm(`This will merge ${data.savedQuotes.length} quotes from the backup with your current data. Continue?`)) return;

        // ── Merge customers (v2.0+) ──
        if (data.customers) {
          const newCustomers = [];
          Object.keys(data.customers).forEach(cid => {
            if (!customers[cid]) {
              customers[cid] = data.customers[cid];
              newCustomers.push(data.customers[cid]);
            }
          });
          for (const c of newCustomers) {
            await dbSaveCustomer(c).catch(err => console.error('[CrewHub] importJSON customer error:', err));
          }
        }
        // ── Merge quotes ──
        const existingNums = new Set(savedQuotes.map(q => q.quoteNum));
        const newQuotes = data.savedQuotes.filter(q => !existingNums.has(q.quoteNum));
        savedQuotes = [...newQuotes, ...savedQuotes];
        for (const q of newQuotes) {
          await dbSaveJob(q).catch(err => console.error('[CrewHub] importJSON job error:', err));
        }
        // ── Merge notes (localStorage cache only — no batch API) ──
        if (data.crmNotes) {
          Object.keys(data.crmNotes).forEach(k => {
            if (!crmNotes[k]) crmNotes[k] = [];
            const existingTexts = new Set(crmNotes[k].map(n => n.text + n.date));
            data.crmNotes[k].forEach(n => {
              if (!existingTexts.has(n.text + n.date)) crmNotes[k].push(n);
            });
          });
          localStorage.setItem('twc_crm_notes', JSON.stringify(crmNotes));
        }
        // ── Merge leads ──
        if (data.leads && data.leads.length) {
          const existingLeadIds = new Set(leads.map(l => l.id));
          const newLeads = data.leads.filter(l => !existingLeadIds.has(l.id));
          leads = [...leads, ...newLeads];
          await dbSaveLeadsBatch(leads).catch(err => console.error('[CrewHub] importJSON leads error:', err));
        }
        if (data.neighborhoods && data.neighborhoods.length) {
          neighborhoods = data.neighborhoods;
          await dbSaveNeighborhoodsBatch(neighborhoods).catch(err => console.error('[CrewHub] importJSON nbhd error:', err));
        }
        if (data.leadsLastRun) localStorage.setItem('twc_leads_lastrun', data.leadsLastRun);

        alert(`✅ Import complete! ${newQuotes.length} new quotes added.`);
      } catch(err) {
        alert('Failed to read backup file. Make sure it is a valid Crew Hub backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function exportCSV() {
    const stageLabel = q => {
      if (q.receipted) return 'Complete';
      if (q.invoiced) return 'Invoiced';
      if (q.won === true) return 'Won';
      if (q.won === false) return 'Lost';
      return 'Quoted';
    };
    const rows = [
      ['Quote #', 'Date', 'Customer', 'Address', 'Contact', 'Type', 'Windows', 'Condition', 'Service Plan', 'Add-ons', 'Subtotal', 'Total', 'Pipeline Stage', 'Invoiced', 'Receipt Generated', 'Job Notes', 'CRM Notes']
    ];
    savedQuotes.forEach(q => {
      const custKey = (q.name || '').trim().toUpperCase();
      const custNotes = (crmNotes[custKey] || []).map(n => `[${n.date}] ${n.text}`).join(' | ');
      rows.push([
        q.quoteNum || '',
        q.date || '',
        q.name || '',
        q.address || '',
        q.contact || '',
        q.type || '',
        (q.std||0) + (q.large||0),
        q.condition || 'maintenance',
        q.plan || 'oneoff',
        (q.addons||[]).join(', '),
        (q.subtotal||0).toFixed(2),
        (q.grand||0).toFixed(2),
        stageLabel(q),
        q.invoiced ? 'Yes' : 'No',
        q.receipted ? 'Yes' : 'No',
        q.notes || '',
        custNotes
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CrewHub_Quotes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  // ═══════════════════════════════════════════════════════════════
  // ═══ 4. Auth + Onboarding ═══
  // Depends on: APP STATE (_sb, sbUser, currentBusinessId, etc.)
  //             Google Identity Services (for Drive/Calendar OAuth)
  // Called by:  Sync button (handleSyncBtn), page load (BOOT),
  //             Auth modal steps (handleSignIn, handleNewBusinessSignup, etc.)
  // ═══════════════════════════════════════════════════════════════

  function isTokenValid() { return !!sbUser; }

  function setSyncUI(state, msg) {
    const dot     = document.getElementById('syncIndicator');
    const lbl     = document.getElementById('syncLabel');
    const btn     = document.getElementById('syncBtn');
    const signOut = document.getElementById('signOutBtn');
    const colors  = { idle: '#10b981', syncing: '#f0d000', error: '#f87171', offline: '#aac4cc' };
    dot.style.background = colors[state] || colors.offline;
    lbl.textContent = msg;
    if (state === 'syncing') {
      btn.textContent = '⟳ Syncing...';
      btn.disabled = true;
    } else if (sbUser) {
      btn.textContent = '🔄 Sync Now';
      btn.disabled = false;
    } else {
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
    if (signOut) signOut.style.display = sbUser ? 'inline-block' : 'none';
  }

  function handleSyncBtn() {
    if (sbUser) { syncNow(); } else { showAuthModal(); }
  }

  // ── Auth modal helpers ──
  function showAuthModal() {
    if (_authInviteInfo) { showAuthStep('invite'); }
    else                 { showAuthStep('main');   }
  }
  function hideAuthModal() { document.getElementById('authModal').style.display = 'none'; }

  function showAuthError(msg, type) {
    const el = document.getElementById('authError');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.textContent      = msg;
    el.style.color      = type === 'success' ? '#16a34a' : '#dc2626';
    el.style.background = type === 'success' ? '#f0fdf4' : '#fef2f2';
    el.style.display    = 'block';
  }

  // ── Shared inline style snippets ──
  const _AS = {
    inp: 'width:100%;padding:12px 16px;border:2px solid #e8f4f7;border-radius:12px;font-family:\'Nunito\',sans-serif;font-size:14px;font-weight:600;color:#1a3a4a;margin-bottom:10px;outline:none;box-sizing:border-box;',
    bp:  'width:100%;padding:14px;background:linear-gradient(135deg,#2a9db5,#1a6ea8);color:#fff;border:none;border-radius:12px;font-family:\'Nunito\',sans-serif;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:10px;',
    bs:  'width:100%;padding:12px;background:#f4fbfc;color:#2a9db5;border:2px solid #2a9db5;border-radius:12px;font-family:\'Nunito\',sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;',
    bg:  'background:none;border:none;color:#6b9aaa;font-family:\'Nunito\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;padding:0;',
    lbl: 'display:block;font-size:11px;font-weight:700;color:#6b9aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;text-align:left;margin-top:8px;',
  };

  function _authHeader(backStep) {
    const back = backStep
      ? `<button onclick="showAuthStep('${backStep}')" style="position:absolute;top:0;left:0;background:none;border:none;font-size:24px;cursor:pointer;color:#6b9aaa;line-height:1;padding:0;" title="Back">←</button>`
      : '';
    return `<div style="position:relative;padding-top:${backStep ? '4' : '0'}px;">
      ${back}
      <div style="font-size:36px;margin-bottom:8px;">🪟</div>
      <h2 style="font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#1a3a4a;margin-bottom:4px;">Crew Hub</h2>
      <p style="font-size:13px;color:#6b9aaa;margin-bottom:18px;font-weight:600;">By The Window Crew</p>
      <div id="authError" style="display:none;background:#fef2f2;color:#dc2626;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;margin-bottom:14px;text-align:left;"></div>`;
  }

  function showAuthStep(step) {
    const content = document.getElementById('authModalContent');
    document.getElementById('authModal').style.display = 'flex';
    const I = _AS.inp, BP = _AS.bp, BS = _AS.bs, BG = _AS.bg, LB = _AS.lbl;

    if (step === 'main') {
      content.innerHTML = `${_authHeader(null)}
        <input type="email" id="authEmail" placeholder="Email address" style="${I}" onkeydown="if(event.key==='Enter')handleSignIn()">
        <input type="password" id="authPassword" placeholder="Password" style="${I}margin-bottom:18px;" onkeydown="if(event.key==='Enter')handleSignIn()">
        <button id="authSignInBtn" onclick="handleSignIn()" style="${BP}">Sign In</button>
        <button onclick="showAuthStep('choose')" style="${BS}">Create Account</button>
        <p style="font-size:11px;color:#aac4cc;margin-top:8px;font-weight:600;">Your data is private and syncs across all your devices.</p>
      </div>`;

    } else if (step === 'choose') {
      content.innerHTML = `${_authHeader('main')}
        <p style="font-size:14px;font-weight:700;color:#1a3a4a;margin-bottom:18px;">How are you joining?</p>
        <button onclick="showAuthStep('new-business')" style="width:100%;padding:18px 16px;background:#f0fdf4;border:2px solid #86efac;border-radius:14px;text-align:left;cursor:pointer;margin-bottom:12px;display:block;">
          <div style="font-size:22px;margin-bottom:4px;">🏢</div>
          <div style="font-weight:800;font-size:14px;color:#065f46;">Starting a new business</div>
          <div style="font-size:12px;color:#6b9aaa;font-weight:600;margin-top:2px;">Create your Crew Hub account and business profile</div>
        </button>
        <button onclick="showAuthStep('join-team')" style="width:100%;padding:18px 16px;background:#f0f9ff;border:2px solid #7dd3fc;border-radius:14px;text-align:left;cursor:pointer;display:block;">
          <div style="font-size:22px;margin-bottom:4px;">👥</div>
          <div style="font-weight:800;font-size:14px;color:#0c4a6e;">Joining an existing team</div>
          <div style="font-size:12px;color:#6b9aaa;font-weight:600;margin-top:2px;">Your owner added your email — create your account here</div>
        </button>
      </div>`;

    } else if (step === 'new-business') {
      content.innerHTML = `${_authHeader('choose')}
        <p style="font-size:14px;font-weight:700;color:#1a3a4a;margin-bottom:14px;">Create your business</p>
        <label style="${LB}">Business Name</label>
        <input type="text" id="authBizName" placeholder="e.g. The Window Crew" style="${I}">
        <label style="${LB}">Your Name</label>
        <input type="text" id="authOwnerName" placeholder="e.g. Amadeus" style="${I}">
        <label style="${LB}">Email</label>
        <input type="email" id="authEmail" placeholder="you@email.com" style="${I}">
        <label style="${LB}">Password</label>
        <input type="password" id="authPassword" placeholder="6+ characters" style="${I}margin-bottom:18px;">
        <button id="authCreateBizBtn" onclick="handleNewBusinessSignup()" style="${BP}">🚀 Create My Business</button>
        <div style="background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:10px;padding:10px 14px;margin-top:12px;text-align:center;">
          <p style="font-size:12px;color:#0369a1;font-weight:700;margin:0;">Already a team member or owner on The Crew Hub?</p>
          <button onclick="showAuthStep('main')" style="${BG}margin-top:4px;color:#2a9db5;font-weight:800;">Sign In with existing credentials →</button>
        </div>
      </div>`;

    } else if (step === 'join-team') {
      content.innerHTML = `${_authHeader('choose')}
        <p style="font-size:14px;font-weight:700;color:#1a3a4a;margin-bottom:6px;">Join your team</p>
        <p style="font-size:12px;color:#6b9aaa;font-weight:600;margin-bottom:14px;line-height:1.5;">Use the same email your team owner added for you.</p>
        <label style="${LB}">Your Name</label>
        <input type="text" id="authOwnerName" placeholder="e.g. Marcus" style="${I}">
        <label style="${LB}">Email</label>
        <input type="email" id="authEmail" placeholder="same email your owner added" style="${I}">
        <label style="${LB}">Password</label>
        <input type="password" id="authPassword" placeholder="6+ characters" style="${I}margin-bottom:18px;">
        <button id="authSignInBtn" onclick="handleJoinTeamSignup()" style="${BP}">Join Team</button>
        <p style="font-size:11px;color:#aac4cc;margin-top:6px;font-weight:600;">Already have an account? <button onclick="showAuthStep('main')" style="${BG}">Sign In</button></p>
      </div>`;

    } else if (step === 'invite') {
      const biz      = _authInviteInfo?.business_name || 'a team';
      const roleMap  = { owner: '👑 Owner', dispatcher: '📋 Dispatcher', crew: '🔧 Crew' };
      const roleLabel = roleMap[_authInviteInfo?.role] || (_authInviteInfo?.role || 'Crew');
      const preEmail = _authInviteInfo?.email || '';
      content.innerHTML = `${_authHeader('main')}
        <div style="background:#f0f9ff;border:2px solid #7dd3fc;border-radius:14px;padding:14px 16px;margin-bottom:16px;text-align:left;">
          <div style="font-weight:800;font-size:14px;color:#0c4a6e;margin-bottom:2px;">You've been invited! 🎉</div>
          <div style="font-size:13px;color:#0369a1;font-weight:600;">Join <strong>${biz}</strong> as ${roleLabel}</div>
        </div>
        <label style="${LB}">Your Name</label>
        <input type="text" id="authOwnerName" placeholder="Your name" style="${I}">
        <label style="${LB}">Email</label>
        <input type="email" id="authEmail" placeholder="your email" value="${preEmail}" style="${I}">
        <label style="${LB}">Password</label>
        <input type="password" id="authPassword" placeholder="6+ characters" style="${I}margin-bottom:18px;">
        <button id="authSignInBtn" onclick="handleInviteSignup()" style="${BP}">✓ Accept Invite &amp; Join</button>
        <p style="font-size:11px;color:#aac4cc;margin-top:6px;font-weight:600;">Already have an account? <button onclick="showAuthStep('main')" style="${BG}">Sign In</button></p>
      </div>`;

    } else if (step === 'pick-business') {
      const roleMap = { owner: '👑 Owner', admin: '🛡️ Admin', dispatcher: '📋 Dispatcher', crew: '🔧 Crew' };
      const cards = _authMemberships.map(m => `
        <button onclick="selectBusiness('${m.id}','${m.business_id}','${m.role}')"
          style="width:100%;padding:16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;text-align:left;cursor:pointer;margin-bottom:10px;display:block;">
          <div style="font-weight:800;font-size:14px;color:#1a3a4a;">${m.business_name}</div>
          <div style="font-size:12px;color:#6b9aaa;font-weight:600;margin-top:2px;">${roleMap[m.role] || m.role}</div>
        </button>`).join('');
      content.innerHTML = `${_authHeader(null)}
        <p style="font-size:14px;font-weight:700;color:#1a3a4a;margin-bottom:16px;">Select a business</p>
        ${cards}
        <button onclick="showAuthStep('add-business')" style="${BS}margin-top:4px;">+ Create New Business</button>
        <button onclick="sbSignOut()" style="${BG}margin-top:4px;">Sign Out</button>
      </div>`;

    } else if (step === 'add-business') {
      const types = getAvailableServiceTypes();
      const tradeCards = types.map(t => `
        <button onclick="_pendingNewBizServiceType='${t.id}';document.querySelectorAll('.add-biz-trade-btn').forEach(b=>b.style.borderColor='#e2e8f0');this.style.borderColor='var(--teal)';"
          class="add-biz-trade-btn"
          style="width:100%;padding:14px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;text-align:left;cursor:pointer;margin-bottom:8px;display:block;transition:border-color .15s;">
          <div style="font-weight:800;font-size:13px;color:#1a3a4a;">${t.label}</div>
        </button>`).join('');
      content.innerHTML = `${_authHeader('pick-business')}
        <p style="font-size:14px;font-weight:700;color:#1a3a4a;margin-bottom:6px;">Create a New Business</p>
        <label style="${LB}">Business Name</label>
        <input type="text" id="addBizName" placeholder="My Cleaning Co." style="${I}">
        <label style="${LB}">Your Name (Owner)</label>
        <input type="text" id="addBizOwnerName" placeholder="Jane Doe" style="${I}">
        <p style="font-size:12px;font-weight:700;color:#1a3a4a;margin-top:12px;margin-bottom:8px;">What trade?</p>
        ${tradeCards}
        <button id="addBizCreateBtn" onclick="handleAddBusiness()" style="${BP}margin-top:8px;">🚀 Create My Business</button>
      </div>`;

    } else if (step === 'pick-trade') {
      const types = getAvailableServiceTypes();
      const tradeCards = types.map(t => `
        <button onclick="_pendingServiceType='${t.id}';document.querySelectorAll('.trade-pick-btn').forEach(b=>b.style.borderColor='#e2e8f0');this.style.borderColor='var(--teal)';"
          class="trade-pick-btn"
          style="width:100%;padding:16px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;text-align:left;cursor:pointer;margin-bottom:10px;display:block;transition:border-color .15s;">
          <div style="font-weight:800;font-size:14px;color:#1a3a4a;">${t.label}</div>
        </button>`).join('');
      content.innerHTML = `${_authHeader('new-business')}
        <p style="font-size:14px;font-weight:700;color:#1a3a4a;margin-bottom:6px;">What trade does your business do?</p>
        <p style="font-size:12px;color:#6b9aaa;font-weight:600;margin-bottom:16px;line-height:1.5;">This sets your quoting form. You can change it later in settings.</p>
        ${tradeCards}
        <button id="authFinishTradeBtn" onclick="_doCreateBusiness()" style="${BP}margin-top:4px;">🚀 Create My Business</button>
      </div>`;
    }
  }

  // ── Pending state for two-step business creation (credentials → pick-trade) ──
  let _pendingServiceType = 'window-cleaning';
  let _pendingAuthData    = null; // { bizName, ownerName, email }
  let _pendingNewBizServiceType = 'window-cleaning';

  // ── Auth handler functions ──
  async function handleSignIn() {
    const email    = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
    const btn = document.getElementById('authSignInBtn');
    if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
    if (error) { showAuthError(error.message); return; }
    sbUser = data.user;
    hideAuthModal();
    await afterSignIn();
  }

  async function handleNewBusinessSignup() {
    const bizName   = document.getElementById('authBizName')?.value.trim();
    const ownerName = document.getElementById('authOwnerName')?.value.trim();
    const email     = document.getElementById('authEmail')?.value.trim();
    const password  = document.getElementById('authPassword')?.value;
    if (!bizName)   { showAuthError('Please enter your business name.'); return; }
    if (!ownerName) { showAuthError('Please enter your name.'); return; }
    if (!email)     { showAuthError('Please enter your email address.'); return; }
    if (!password || password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
    const btn = document.getElementById('authCreateBizBtn');
    if (btn) { btn.textContent = '⏳ Checking...'; btn.disabled = true; }
    try {
      // Sign up / sign in the auth user first so the account exists
      if (!sbUser) {
        const { data: signUpData, error: signUpErr } = await _sb.auth.signUp({ email, password });
        if (signUpErr) {
          if (signUpErr.message?.toLowerCase().includes('already') || signUpErr.status === 422) {
            const { data: signInData, error: signInErr } = await _sb.auth.signInWithPassword({ email, password });
            if (signInErr) throw signInErr;
            sbUser = signInData.user;
          } else {
            throw signUpErr;
          }
        } else {
          sbUser = signUpData.user;
        }
      }
      // Store credentials and proceed to trade picker
      _pendingAuthData    = { bizName, ownerName, email };
      _pendingServiceType = 'window-cleaning';
      showAuthStep('pick-trade');
    } catch(e) {
      showAuthError(e.message || 'Failed to create account.');
      if (btn) { btn.textContent = '🚀 Create My Business'; btn.disabled = false; }
    }
  }

  // Called by the "🚀 Create My Business" button on the pick-trade step
  async function _doCreateBusiness() {
    if (!_pendingAuthData) { showAuthError('Something went wrong — please try again.'); return; }
    const { bizName, ownerName, email } = _pendingAuthData;
    const btn = document.getElementById('authFinishTradeBtn');
    if (btn) { btn.textContent = '⏳ Creating...'; btn.disabled = true; }
    try {
      const result = await dbBootstrapBusiness(bizName, ownerName, email, _pendingServiceType);
      // Ensure business name is saved reliably
      const newBizId = result?.businessId || result?.business_id || result?.id
                    || (typeof result === 'string' ? result : null);
      if (newBizId) {
        await _sb.from('businesses').update({ name: bizName }).eq('id', newBizId);
      }
      _pendingAuthData = null;
      _justCreatedBusiness = true;
      hideAuthModal();
      hideNoBizModal();
      await afterSignIn();
    } catch(e) {
      showAuthError(e.message || 'Failed to create business.');
      if (btn) { btn.textContent = '🚀 Create My Business'; btn.disabled = false; }
    }
  }

  async function handleAddBusiness() {
    const bizName   = document.getElementById('addBizName')?.value.trim();
    const ownerName = document.getElementById('addBizOwnerName')?.value.trim();
    if (!bizName)   { showAuthError('Please enter your business name.'); return; }
    if (!ownerName) { showAuthError('Please enter your name.'); return; }
    const btn = document.getElementById('addBizCreateBtn');
    if (btn) { btn.textContent = '⏳ Creating...'; btn.disabled = true; }
    try {
      if (!sbUser) throw new Error('Not signed in. Please sign out and sign back in.');
      const result = await dbBootstrapBusiness(bizName, ownerName, sbUser.email, _pendingNewBizServiceType);
      console.log('[CrewHub] bootstrap result:', JSON.stringify(result));
      // The bootstrap RPC should save the name, but as a safety net, also update it explicitly.
      // Try every possible key format from the RPC result
      const newBizId = result?.businessId || result?.business_id || result?.id
                    || (typeof result === 'string' ? result : null);
      // Try updating via direct query, then via RPC fallback
      const trySetName = async (bizId) => {
        const { error } = await _sb.from('businesses').update({ name: bizName }).eq('id', bizId);
        if (error) {
          console.warn('[CrewHub] Direct name update blocked (likely RLS), trying workaround:', error.message);
          // Fallback: use the set_business_name RPC if it exists, otherwise log warning
          try { await _sb.rpc('set_business_name', { biz_id: bizId, biz_name: bizName }); }
          catch(e) { console.warn('[CrewHub] set_business_name RPC not available:', e.message); }
        }
      };
      if (newBizId) {
        await trySetName(newBizId);
      } else {
        // Fallback: find most recently created business owned by this user that has no name
        const { data: memberships } = await _sb
          .from('team_members')
          .select('business_id')
          .eq('auth_user_id', sbUser.id)
          .eq('role', 'owner')
          .order('created_at', { ascending: false })
          .limit(1);
        if (memberships?.[0]) await trySetName(memberships[0].business_id);
      }
      _justCreatedBusiness = true;
      hideAuthModal();
      hideNoBizModal();
      await afterSignIn();
    } catch(e) {
      showAuthError(e.message || 'Failed to create business.');
      if (btn) { btn.textContent = '🚀 Create My Business'; btn.disabled = false; }
    }
  }

  async function handleJoinTeamSignup() {
    const ownerName = document.getElementById('authOwnerName')?.value.trim();
    const email     = document.getElementById('authEmail')?.value.trim();
    const password  = document.getElementById('authPassword')?.value;
    if (!ownerName)          { showAuthError('Please enter your name.'); return; }
    if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
    if (password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
    const btn = document.getElementById('authSignInBtn');
    if (btn) { btn.textContent = '⏳ Joining...'; btn.disabled = true; }

    // Try signUp first; if user already exists, fall back to signIn
    let { data, error } = await _sb.auth.signUp({ email, password });
    if (error && (error.message || '').toLowerCase().includes('already registered')) {
      const signInResult = await _sb.auth.signInWithPassword({ email, password });
      data  = signInResult.data;
      error = signInResult.error;
    }
    if (error) {
      showAuthError(error.message);
      if (btn) { btn.textContent = 'Join Team'; btn.disabled = false; }
      return;
    }
    sbUser = data.user;
    if (!sbUser) {
      showAuthError('✓ Check your email to confirm it, then sign in.', 'success');
      if (btn) { btn.textContent = 'Join Team'; btn.disabled = false; }
      return;
    }
    const identity = await dbClaimInvite(email);
    if (!identity) {
      showAuthError("We couldn't find a pending invite for " + email + ". Ask your team owner to add you first.");
      await _sb.auth.signOut(); sbUser = null;
      if (btn) { btn.textContent = 'Join Team'; btn.disabled = false; }
      return;
    }
    await dbUpdateTeamMember(currentMemberId, { name: ownerName }).catch(() => {});
    hideAuthModal();
    await afterSignIn();
  }

  async function handleInviteSignup() {
    const ownerName = document.getElementById('authOwnerName')?.value.trim();
    const email     = document.getElementById('authEmail')?.value.trim();
    const password  = document.getElementById('authPassword')?.value;
    if (!ownerName)          { showAuthError('Please enter your name.'); return; }
    if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
    if (password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
    const btn = document.getElementById('authSignInBtn');
    if (btn) { btn.textContent = '⏳ Joining...'; btn.disabled = true; }

    // Try signUp first; if user already exists, fall back to signIn
    let { data, error } = await _sb.auth.signUp({ email, password });
    if (error && (error.message || '').toLowerCase().includes('already registered')) {
      // Existing user — sign them in instead
      const signInResult = await _sb.auth.signInWithPassword({ email, password });
      data  = signInResult.data;
      error = signInResult.error;
    }
    if (error) {
      showAuthError(error.message);
      if (btn) { btn.textContent = '✓ Accept Invite & Join'; btn.disabled = false; }
      return;
    }
    sbUser = data.user;
    if (!sbUser) {
      showAuthError('✓ Check your email to confirm it, then sign in.', 'success');
      if (btn) { btn.textContent = '✓ Accept Invite & Join'; btn.disabled = false; }
      return;
    }
    const identity = await dbClaimInvite(email);
    if (!identity) {
      showAuthError('Could not claim the invite. Try signing in if you already have an account.');
      await _sb.auth.signOut(); sbUser = null;
      if (btn) { btn.textContent = '✓ Accept Invite & Join'; btn.disabled = false; }
      return;
    }
    await dbUpdateTeamMember(currentMemberId, { name: ownerName }).catch(() => {});
    _authInviteId   = null;
    _authInviteInfo = null;
    hideAuthModal();
    await afterSignIn();
  }

  // ── initPluginAndUI ───────────────────────────────────────────────────────────
  // Called after a business is fully loaded. Resolves the correct quote plugin
  // for this business's service_type, injects the plugin's form HTML into the
  // quote builder, registers the window bridge functions, and runs calc() once
  // to initialise the price display.
  async function initPluginAndUI() {
    // Load service_type + logo_url from the business record
    let serviceType = 'window-cleaning'; // safe default
    if (currentBusinessId) {
      try {
        const { data } = await _sb
          .from('businesses')
          .select('service_type, logo_url, name, email, phone, address')
          .eq('id', currentBusinessId)
          .single();
        if (data?.service_type) serviceType = data.service_type;
        // Always cache-bust logo URL so CDN/email clients fetch the latest version
        window._currentLogoUrl = data?.logo_url ? data.logo_url.split('?')[0] + '?t=' + Date.now() : null;
        // Populate hidden business-info fields used by quote/invoice generators
        const _set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        _set('bizName',    data?.name);
        _set('bizAddress', data?.address);
        _set('bizPhone',   data?.phone);
        _set('bizEmail',   data?.email);
      } catch(e) {
        console.warn('[CrewHub] Could not load business data:', e);
      }
    }

    // Clear legacy base64 logo cache — Supabase Storage is now the source of truth
    if (window._currentLogoUrl) {
      cachedLogoB64 = '';
      localStorage.removeItem('twc_logo_b64');
      localStorage.removeItem('twc_logo_fileid');
    }

    // Populate logo preview if one exists
    const preview   = document.getElementById('bizLogoPreview');
    const removeBtn = document.getElementById('bizLogoRemoveBtn');
    if (preview) {
      if (window._currentLogoUrl) {
        preview.src = window._currentLogoUrl;
        preview.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
      } else {
        preview.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
      }
    }

    // Cache active team members for assignment dropdowns
    try {
      const allMembers = await dbLoadTeamMembers(currentBusinessId);
      window._teamMembers = (allMembers || []).filter(m => m.active);
    } catch(e) { window._teamMembers = []; }

    activePlugin = resolveQuotePlugin(serviceType);

    // Inject the plugin's form HTML
    const container = document.getElementById('service-fields-container');
    if (container) container.innerHTML = activePlugin.getFormHTML();

    // Register window bridge functions (e.g. wcSetCondition, wcSetPlan, …)
    Object.assign(window, activePlugin.getWindowBridge());

    // Initial render
    calc();
    console.info(`[CrewHub] Quote plugin loaded: ${activePlugin.label}`);
  }

  async function selectBusiness(memberId, businessId, role) {
    const wasJustCreated = _justCreatedBusiness;
    _justCreatedBusiness = false;
    currentMemberId   = memberId;
    currentBusinessId = businessId;
    currentUserRole   = role;
    localStorage.setItem('twc_last_business', businessId);
    hideAuthModal();
    await dbLoadAll();
    applyRolePermissions();
    syncAllToStore({ sbUser, currentBusinessId, currentMemberId, currentUserRole, savedQuotes, customers, crmNotes, leads, neighborhoods });
    // Load business plan + brand theme for alpha banner
    dbLoadBusinessInfo().then(biz => {
      if (biz) {
        useAppStore.getState().setPlan(biz.plan, biz.subscription_status);
        if (biz.brand_color) applyBrandTheme(biz.brand_color);
      }
    }).catch(() => {});
    await initPluginAndUI();
    const now = new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
    setSyncUI('idle', `Synced ${now} · ${savedQuotes.length} jobs`);

    // Check onboarding for the selected membership (DB flag + localStorage fallback)
    const selectedMembership = _authMemberships.find(m => m.id === memberId);
    const lsOnboarded2 = localStorage.getItem('twc_onboarding_done_' + memberId) === 'true';
    if (selectedMembership && !selectedMembership.onboarding_completed && !lsOnboarded2) {
      const onboardDetail = {
        role,
        isNewBusiness:        wasJustCreated,
        hasOtherMemberships:  _authMemberships.length > 1,
        memberId,
        businessId,
      };
      window._pendingOnboarding = onboardDetail;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('crewhub:start-onboarding', { detail: onboardDetail }));
      }, 600);
    }
  }

  async function sbSignOut() {
    await _sb.auth.signOut();
    sbUser = null;
    clearAuthInStore();
    setSyncUI('offline', 'Signed out');
    showAuthModal();
  }

  async function afterSignIn() {
    setSyncUI('syncing', 'Loading your data...');
    const wasJustCreated = _justCreatedBusiness;
    _justCreatedBusiness = false;

    // Step 1: Query all active memberships for this user (across all businesses)
    const { data: memberships } = await _sb
      .from('team_members')
      .select('id, business_id, role, name, active, onboarding_completed, businesses(name)')
      .eq('auth_user_id', sbUser.id)
      .eq('active', true);

    let activeMemberships = (memberships || []).map(m => ({
      id:                    m.id,
      business_id:           m.business_id,
      role:                  m.role,
      name:                  m.name,
      business_name:         m.businesses?.name || 'Unnamed Business',
      onboarding_completed:  m.onboarding_completed ?? false,
    }));

    // Step 2: If no memberships, try claiming a pending invite by email
    if (activeMemberships.length === 0 && sbUser?.email) {
      const identity = await dbClaimInvite(sbUser.email);
      if (identity) {
        console.info('[CrewHub] Claimed pending invite for', sbUser.email);
        activeMemberships = [{
          id:            currentMemberId,
          business_id:   currentBusinessId,
          role:          currentUserRole,
          name:          sbUser.email,
          business_name: 'Your Team',
        }];
      }
    }

    // Step 3: Still nothing — ask user to create biz or wait for invite
    if (activeMemberships.length === 0) {
      setSyncUI('idle', 'No business linked');
      showAuthStep('choose');
      return;
    }

    // Step 4: Multiple businesses — always show picker
    if (activeMemberships.length > 1) {
      _authMemberships = activeMemberships;
      setSyncUI('idle', 'Pick a business');
      showAuthStep('pick-business');
      return;
    }

    // Step 5: Single membership — use it directly
    const m = activeMemberships[0];
    currentMemberId   = m.id;
    currentBusinessId = m.business_id;
    currentUserRole   = m.role;
    await dbLoadAll();
    applyRolePermissions();
    // Sync state to Zustand store for React components
    syncAllToStore({ sbUser, currentBusinessId, currentMemberId, currentUserRole, savedQuotes, customers, crmNotes, leads, neighborhoods });
    // Load business plan + brand theme
    dbLoadBusinessInfo().then(biz => {
      if (biz) {
        useAppStore.getState().setPlan(biz.plan, biz.subscription_status);
        if (biz.brand_color) applyBrandTheme(biz.brand_color);
      }
    }).catch(() => {});
    await initPluginAndUI();
    const now = new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
    setSyncUI('idle', `Synced ${now} · ${savedQuotes.length} jobs`);

    // Trigger onboarding if not completed yet (check both DB flag and localStorage fallback)
    const lsOnboarded = localStorage.getItem('twc_onboarding_done_' + m.id) === 'true';
    if (!m.onboarding_completed && !lsOnboarded) {
      // Store detail on window so React can pick it up even if event fires before mount
      const onboardDetail = {
        role:                 m.role,
        isNewBusiness:        wasJustCreated,
        hasOtherMemberships:  (memberships || []).length > 1,
        memberId:             m.id,
        businessId:           m.business_id,
      };
      window._pendingOnboarding = onboardDetail;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('crewhub:start-onboarding', { detail: onboardDetail }));
      }, 600);
    }
  }

  async function loadFromSupabase() {
    // Delegate to DATA ACCESS LAYER — legacy callers won't break
    if (!sbUser) return;
    if (!currentBusinessId) await dbLoadIdentity();
    await dbLoadAll();
  }

  // signIn() kept for Google Drive (photos + calendar) — triggered from photo panel
  function signIn() {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOG_CLIENT_ID,
      scope: GOOG_SCOPES,
      callback: (resp) => {
        if (resp.error) { alert('Google sign-in failed: ' + resp.error); return; }
        gAccessToken = resp.access_token;
        gTokenExpiry = Date.now() + 55 * 60 * 1000;
        updateQuotePhotoPanel();
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  }

  async function syncNow() {
    if (!sbUser || isSyncing) return;
    isSyncing = true;
    setSyncUI('syncing', 'Syncing...');
    try {
      if (!currentBusinessId) await dbLoadIdentity();
      await dbLoadAll();
      applyRolePermissions();
      syncAllToStore({ sbUser, currentBusinessId, currentMemberId, currentUserRole, savedQuotes, customers, crmNotes, leads, neighborhoods });
      const now = new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
      setSyncUI('idle', `Synced ${now} · ${savedQuotes.length} jobs`);
    } catch(err) {
      console.error('[CrewHub] Sync error:', err);
      setSyncUI('error', 'Sync failed — check console');
    }
    isSyncing = false;
  }

  // ── Legacy Drive stubs (kept so calendar/photo code referencing these doesn't crash) ──
  async function findOrCreateFile() {
    // Search Drive for existing file
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'${SYNC_FILE_NAME}'+and+trashed%3Dfalse&fields=files(id,name)&spaces=drive&corpora=user`,
      { headers: { Authorization: `Bearer ${gAccessToken}` } }
    );
    const searchData = await searchRes.json();
    console.log('Drive search result:', searchData);

    if (searchData.files && searchData.files.length > 0) {
      console.log('Found existing file:', searchData.files[0].id);
      return searchData.files[0].id;
    }

    // Create new file with empty data
    console.log('No file found — creating new one');
    const empty = { savedQuotes: [], crmNotes: {} };
    const boundary = 'crew_hub_boundary';
    const meta = JSON.stringify({ name: SYNC_FILE_NAME, mimeType: 'application/json' });
    const body = JSON.stringify(empty);
    const reqBody = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gAccessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: reqBody
      }
    );
    const created = await createRes.json();
    console.log('Created file:', created);
    if (!created.id) throw new Error('File creation failed: ' + JSON.stringify(created));
    return created.id;
  }

  async function readFile(fileId) {
    console.log('Reading file:', fileId);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${gAccessToken}` } }
    );
    if (!res.ok) {
      console.error('Read failed:', res.status, await res.text());
      return { savedQuotes: [], crmNotes: {} };
    }
    const text = await res.text();
    console.log('Read', text.length, 'bytes');
    try { return JSON.parse(text); }
    catch { return { savedQuotes: [], crmNotes: {} }; }
  }

  async function writeFile(fileId, data) {
    console.log('Writing file:', fileId, '— quotes:', data.savedQuotes.length);
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${gAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Write failed:', res.status, err);
      throw new Error('Write failed: ' + res.status);
    }
    console.log('Write success');
  }

  function mergeData(remote) {
    // Legacy stub — Supabase sync replaced this. Returns local state unchanged.
    return { savedQuotes, crmNotes, customerPhotos, customers, deletedCustomerIds, leads, neighborhoods };
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 3. Database Access Layer (wrappers for src/db/ modules) ═══
  // Imported functions are pure — these wrappers inject state context.
  // ═══════════════════════════════════════════════════════════════

  function canAccess(feature) { return _canAccess(feature, currentUserRole); }

  async function dbBootstrapBusiness(businessName, ownerName, ownerEmail, serviceType = 'window-cleaning') {
    const data = await _dbBootstrapBusiness(businessName, ownerName, ownerEmail, serviceType);
    currentBusinessId = data.businessId;
    currentMemberId   = data.memberId;
    currentUserRole   = 'owner';
    syncAuthToStore(sbUser, currentBusinessId, currentMemberId, currentUserRole);
    return data;
  }

  async function dbLoadIdentity() {
    if (!sbUser) return null;
    const identity = await _dbLoadIdentity(sbUser.id);
    if (!identity) return null;
    currentBusinessId = identity.businessId;
    currentMemberId   = identity.memberId;
    currentUserRole   = identity.role || 'owner';
    syncAuthToStore(sbUser, currentBusinessId, currentMemberId, currentUserRole);
    return identity;
  }

  async function dbClaimInvite(email) {
    const data = await _dbClaimInvite();
    if (!data) return null;
    currentBusinessId = data.businessId;
    currentMemberId   = data.memberId;
    currentUserRole   = data.role || 'crew';
    syncAuthToStore(sbUser, currentBusinessId, currentMemberId, currentUserRole);
    return data;
  }

  async function dbLoadAll() {
    if (!currentBusinessId) return;
    const bid = currentBusinessId;
    // 1. Jobs
    savedQuotes = await dbLoadAllJobs(bid);
    localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));
    // 2. Customers
    const custList = await dbLoadAllCustomers(bid);
    customers = {};
    custList.forEach(c => { customers[c.customerId] = c; });
    localStorage.setItem('twc_customers', JSON.stringify(customers));
    // Hydrate customerPhotos from customer records (persists across sessions)
    customerPhotos = {};
    custList.forEach(c => {
      if (c.photos && c.photos.length > 0) customerPhotos[c.customerId] = c.photos;
    });
    // 3. Notes (raw rows so we can group by customer_id)
    const noteRows = await dbLoadAllNotes(bid);
    crmNotes = {};
    noteRows.forEach(row => {
      const note = rowToNote(row);
      if (!crmNotes[row.customer_id]) crmNotes[row.customer_id] = [];
      crmNotes[row.customer_id].push(note);
    });
    localStorage.setItem('twc_crm_notes', JSON.stringify(crmNotes));
    // 4. Leads
    leads = await dbLoadAllLeads(bid);
    localStorage.setItem('twc_leads', JSON.stringify(leads));
    // 5. Neighborhoods
    neighborhoods = await dbLoadAllNeighborhoods(bid);
    localStorage.setItem('twc_neighborhoods', JSON.stringify(neighborhoods));
    syncDataToStore({ savedQuotes, customers, crmNotes, leads, neighborhoods });
  }

  async function dbSaveJob(jobData) {
    const job = await _dbSaveJob(jobData, currentBusinessId);
    if (jobData.id) {
      const idx = savedQuotes.findIndex(q => q.id === jobData.id);
      if (idx !== -1) savedQuotes[idx] = job;
    } else {
      savedQuotes.unshift(job);
    }
    localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));
    syncDataToStore({ savedQuotes });
    return job;
  }

  async function dbDeleteJob(jobId) {
    await _dbDeleteJob(jobId);
    savedQuotes = savedQuotes.filter(q => q.id !== jobId);
    localStorage.setItem('twc_quotes', JSON.stringify(savedQuotes));
    syncDataToStore({ savedQuotes });
  }

  async function dbSaveCustomer(customerData) {
    const c = await _dbSaveCustomer(customerData, currentBusinessId);
    customers[c.customerId] = c;
    localStorage.setItem('twc_customers', JSON.stringify(customers));
    syncDataToStore({ customers });
    return c;
  }

  async function dbDeleteCustomer(customerId) {
    await _dbDeleteCustomer(customerId);
    delete customers[customerId];
    delete crmNotes[customerId];
    localStorage.setItem('twc_customers', JSON.stringify(customers));
    localStorage.setItem('twc_crm_notes', JSON.stringify(crmNotes));
    syncDataToStore({ customers, crmNotes });
  }

  async function dbSaveNote(customerId, text) {
    const note = await _dbSaveNote(customerId, text, currentBusinessId, currentMemberId);
    if (!crmNotes[customerId]) crmNotes[customerId] = [];
    crmNotes[customerId].unshift(note);
    localStorage.setItem('twc_crm_notes', JSON.stringify(crmNotes));
    syncDataToStore({ crmNotes });
    return note;
  }

  async function dbDeleteNote(noteId, customerId) {
    await _dbDeleteNote(noteId);
    if (crmNotes[customerId]) {
      crmNotes[customerId] = crmNotes[customerId].filter(n => n.id !== noteId);
      localStorage.setItem('twc_crm_notes', JSON.stringify(crmNotes));
    }
    syncDataToStore({ crmNotes });
  }

  async function dbSaveLead(leadData) {
    const lead = await _dbSaveLead(leadData, currentBusinessId);
    const idx = leads.findIndex(l => l.id === leadData.id);
    if (idx !== -1) leads[idx] = lead; else leads.push(lead);
    localStorage.setItem('twc_leads', JSON.stringify(leads));
    syncDataToStore({ leads });
    return lead;
  }

  async function dbDeleteLead(leadId) {
    await _dbDeleteLead(leadId);
    leads = leads.filter(l => l.id !== leadId);
    localStorage.setItem('twc_leads', JSON.stringify(leads));
    syncDataToStore({ leads });
  }

  async function dbSaveLeadsBatch(leadsArray) {
    const incoming = await _dbSaveLeadsBatch(leadsArray, currentBusinessId);
    incoming.forEach(newLead => {
      const idx = leads.findIndex(l => l.id === newLead.id);
      if (idx !== -1) leads[idx] = newLead; else leads.push(newLead);
    });
    localStorage.setItem('twc_leads', JSON.stringify(leads));
    syncDataToStore({ leads });
  }

  async function dbSaveNeighborhoodsBatch(nbhdArray) {
    neighborhoods = await _dbSaveNeighborhoodsBatch(nbhdArray, currentBusinessId);
    localStorage.setItem('twc_neighborhoods', JSON.stringify(neighborhoods));
    syncDataToStore({ neighborhoods });
  }

  async function dbAddTeamMember(name, email, role) {
    return _dbAddTeamMember(name, email, role, currentBusinessId);
  }

  async function dbLoadBusinessInfo() {
    return _dbLoadBusinessInfo(currentBusinessId);
  }

  async function dbUpdateBusiness(updates) {
    return _dbUpdateBusiness(updates, currentBusinessId);
  }

  async function dbClockIn(memberId) {
    return _dbClockIn(memberId, currentBusinessId);
  }

  function dbClockOut(entryId) { return _dbClockOut(entryId); }

  async function dbUpdateBreakMins(entryId, breakMins) {
    return _dbUpdateBreakMins(entryId, breakMins, currentMemberId);
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 6f. Role Permissions & Business Settings ═══
  // Depends on: DATA ACCESS LAYER (dbLoadTeamMembers, dbLoadBusinessInfo,
  //               dbUpdateBusiness, canAccess, currentUserRole)
  // Called by:  afterSignIn (applyRolePermissions, loadBusinessInfo)
  // ═══════════════════════════════════════════════════════════════

  // ── Brand theming ──────────────────────────────────────────────
  // Takes a single hex colour and derives all teal-family CSS vars.
  // Neutrals (--text, --muted, --gray, --offwhite) stay untouched.
  function applyBrandTheme(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Darken: mix toward black
    const darken = (r, g, b, pct) => {
      const f = 1 - pct / 100;
      return `#${[r, g, b].map(c => Math.round(c * f).toString(16).padStart(2, '0')).join('')}`;
    };
    // Lighten: mix toward white
    const lighten = (r, g, b, pct) => {
      const f = pct / 100;
      return `#${[r, g, b].map(c => Math.round(c + (255 - c) * f).toString(16).padStart(2, '0')).join('')}`;
    };

    const root = document.documentElement.style;
    root.setProperty('--teal',       hex);
    root.setProperty('--teal-dark',  darken(r, g, b, 22));
    root.setProperty('--teal-light', lighten(r, g, b, 35));
    root.setProperty('--blue',       darken(r, g, b, 35));
    root.setProperty('--blue-dark',  darken(r, g, b, 48));
    // Derived neutrals that have a teal tint
    root.setProperty('--offwhite',   lighten(r, g, b, 95));
    root.setProperty('--gray',       lighten(r, g, b, 88));
    root.setProperty('--shadow',     `0 4px 24px rgba(${r},${g},${b},0.10)`);
    console.info('[CrewHub] Brand theme applied:', hex);
  }
  // Expose so React components can call it
  window.applyBrandTheme = applyBrandTheme;

  function applyRolePermissions() {
    // Maps tab name → feature(s) required (any match = visible)
    const tabMap = {
      today:      ['today'],
      leads:      ['leads'],
      quotes:     ['quotes'],
      pipeline:   ['pipeline'],
      crm:        ['crm'],
      reports:    ['reports'],
      timesheets: ['timesheets', 'my-timesheet'],
      team:       ['team'],
    };

    function canAccessTab(features) {
      return features.some(f => canAccess(f));
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      const match = onclick.match(/switchTab\('(\w+)'/);
      if (!match) return;
      const tabKey = match[1];
      const features = tabMap[tabKey];
      if (!features) return;
      btn.style.display = canAccessTab(features) ? '' : 'none';
    });

    // If the currently active tab is now hidden, fall back to Today
    const activeTab = document.querySelector('.tab-panel.active');
    if (activeTab) {
      const tabId = activeTab.id.replace('tab-', '');
      const features = tabMap[tabId];
      if (features && !canAccessTab(features)) {
        const todayBtn = document.getElementById('todayTabBtn');
        if (todayBtn) switchTab('today', todayBtn);
      }
    }
  }

  // noBizModal is superseded by auth flow steps — redirect any remaining callers
  function showNoBizModal() { showAuthStep('choose'); }
  function hideNoBizModal() { /* no-op — auth modal handles this now */ }

  // handleCreateBusiness — called by the legacy noBizModal "Create My Business" button.
  // User is already signed in at this point, so skip auth and go straight to bootstrap.
  async function handleCreateBusiness() {
    const bizName   = document.getElementById('noBiz-bizName')?.value.trim();
    const ownerName = document.getElementById('noBiz-ownerName')?.value.trim();
    const errEl     = document.getElementById('noBizError');
    const btn       = document.getElementById('noBiz-createBtn');
    function noBizErr(msg) {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    }
    if (!bizName)   { noBizErr('Please enter your business name.'); return; }
    if (!ownerName) { noBizErr('Please enter your name.'); return; }
    if (btn) { btn.textContent = '⏳ Creating...'; btn.disabled = true; }
    try {
      // User is already authenticated — skip signUp, just create the business
      if (!sbUser) throw new Error('Not signed in. Please sign out and sign back in.');
      await dbBootstrapBusiness(bizName, ownerName, sbUser.email);
      document.getElementById('noBizModal').style.display = 'none';
      await afterSignIn();
    } catch(e) {
      noBizErr(e.message || 'Failed to create business. Please try again.');
      if (btn) { btn.textContent = '🚀 Create My Business'; btn.disabled = false; }
    }
  }



  // ═══════════════════════════════════════════════════════════════
  // ═══ 5g. Photo Storage (Google Drive) ═══
  // Depends on: SUPABASE AUTH (gAccessToken — Google Drive OAuth token)
  //             CUSTOMER TABLE (customers, customerPhotos object)
  //             localStorage (twc_photos_* keys for metadata cache)
  // Called by:  CUSTOMER TYPEAHEAD (updateQuotePhotoPanel, renderQuotePhotoGrid),
  //             PHOTO MODAL (upload, delete, load photo actions)
  // ═══════════════════════════════════════════════════════════════

  async function ensurePhotoFolder() {
    if (photoFolderId) return photoFolderId;
    const files = await driveSearchFiles(
      `name='${PHOTO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      gAccessToken
    );
    if (files.length > 0) {
      photoFolderId = files[0].id;
      return photoFolderId;
    }
    const folder = await driveCreateFolder(PHOTO_FOLDER_NAME, gAccessToken);
    photoFolderId = folder.id;
    return photoFolderId;
  }

  async function uploadPhotoToDrive(file, customerKey) {
    const folderId = await ensurePhotoFolder();
    const safeName = customerKey.replace(/[^A-Z0-9]/g, '_');
    const fileName = `${safeName}_${Date.now()}_${file.name}`;
    const uploaded = await driveUploadFile(file, { name: fileName, parents: [folderId] }, gAccessToken);
    return { fileId: uploaded.id, name: file.name, uploadedAt: new Date().toISOString() };
  }

  // ── LOGO ──

  function extractLogoId(input) {
    // Accept full share URL or raw file ID
    const m = input.value.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m) input.value = m[1];
  }

  async function fetchAndCacheLogo() {
    const fileId = document.getElementById('bizLogoId').value.trim();
    const status = document.getElementById('logoStatus');
    const preview = document.getElementById('logoPreview');
    if (!fileId) { status.textContent = 'Enter a file ID first.'; return; }
    if (!gAccessToken) { status.textContent = 'Sign in to Drive first.'; return; }
    status.textContent = 'Loading...'; status.style.color = 'var(--teal)';
    try {
      const blob = await driveDownloadBlob(fileId, gAccessToken);
      if (!blob) throw new Error('Could not fetch — check file ID and sharing settings');
      const reader = new FileReader();
      reader.onload = e => {
        cachedLogoB64 = e.target.result;
        localStorage.setItem('twc_logo_b64', cachedLogoB64);
        localStorage.setItem('twc_logo_fileid', fileId);
        preview.src = cachedLogoB64; preview.style.display = 'inline-block';
        status.textContent = '✓ Logo saved!'; status.style.color = '#16a34a';
      };
      reader.readAsDataURL(blob);
    } catch(e) {
      status.textContent = e.message; status.style.color = '#dc2626';
    }
  }

  function logoImgTag(height) {
    // Prefer Supabase Storage URL (current source of truth); fall back to legacy base64 cache
    const src = window._currentLogoUrl || cachedLogoB64 || null;
    if (!src) return null;
    return `<img src="${src}" style="height:${height}px;max-width:200px;object-fit:contain;display:block;" alt="logo">`;
  }

  // (Logo preview restore is handled in the BOOT section at the end of this file)

  async function fetchPhotoBlob(fileId) {
    // With Supabase Storage, photos have a direct public URL — no blob fetch needed
    if (photoBlobCache[fileId]) return photoBlobCache[fileId];
    const allPhotos = Object.values(customerPhotos).flat();
    const photo = allPhotos.find(p => p.fileId === fileId);
    const url = photo?.url;
    if (!url) return null;
    photoBlobCache[fileId] = url;
    return url;
  }

  async function deleteCustomerPhoto(fileId, customerKey) {
    if (!confirm('Delete this photo?')) return;
    try {
      await _dbDeleteCustomerPhoto(fileId);
    } catch(e) { console.warn('Supabase Storage delete failed:', e); }
    // Remove from local state
    if (customerPhotos[customerKey]) {
      customerPhotos[customerKey] = customerPhotos[customerKey].filter(p => p.fileId !== fileId);
    }
    // Persist updated photos array to Supabase
    const cust = customers[customerKey] || Object.values(customers).find(c => (c.name||'').trim().toUpperCase() === customerKey);
    if (cust) await _dbUpdateCustomerPhotos(cust.customerId, customerPhotos[cust.customerId] || []);
    renderPhotoModal(customerKey);
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 6g. Photo Modal ═══
  // Depends on: PHOTO STORAGE (uploadPhotoToDrive, deletePhotoFromDrive,
  //               ensurePhotoFolder, photoBlobCache)
  //             CUSTOMER TABLE (getPhotosForCustomer, customerPhotos)
  //             SUPABASE AUTH (gAccessToken for Drive operations)
  // Called by:  PIPELINE (openPhotoModalByIndex from job card),
  //             CRM (openPhotoModal from customer card),
  //             CUSTOMER TYPEAHEAD (photo panel in quote form)
  // ═══════════════════════════════════════════════════════════════

  function getPhotoLabel(customerId, legacyNameKey) {
    const photos = getPhotosForCustomer(customerId, legacyNameKey);
    const count = photos.length;
    if (count === 0) return 'Photos';
    return count + ' Photo' + (count !== 1 ? 's' : '');
  }

  function openPhotoModalByIndex(i) {
    const q = savedQuotes[i];
    if (!q) return;
    const key  = q.customerId || (q.name || '').trim().toUpperCase();
    const name = q.name || '';
    openPhotoModal(key, name);
  }

  function openPhotoModal(customerKey, customerName) {
    photoModalKey = customerKey;
    document.getElementById('pm-title').textContent = customerName;
    document.getElementById('pm-upload-status').textContent = '';
    document.getElementById('pm-file-input').value = '';
    document.getElementById('photoModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    renderPhotoModal(customerKey);
  }

  function closePhotoModal() {
    document.getElementById('photoModal').style.display = 'none';
    document.body.style.overflow = '';
    photoModalKey = null;
  }

  async function renderPhotoModal(customerKey) {
    const grid = document.getElementById('pm-grid');
    const c = customers[customerKey];
    const legacyKey = c ? (c.name || '').trim().toUpperCase() : null;
    const photos = c
      ? getPhotosForCustomer(customerKey, legacyKey)
      : (customerPhotos[customerKey] || []);
    if (!photos.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--muted);font-size:13px;font-weight:600;">No photos yet — upload some below.</div>`;
      return;
    }
    grid.innerHTML = photos.map(p => `
      <div style="position:relative;border-radius:10px;overflow:hidden;background:#f1f5f9;aspect-ratio:1;display:flex;align-items:center;justify-content:center;">
        <img src="${p.url || ''}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onclick="openPhotoLightbox('${p.fileId}')">
        <button onclick="deleteCustomerPhoto('${p.fileId}','${customerKey}')" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;font-size:12px;cursor:pointer;line-height:1;">×</button>
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.45);color:white;font-size:10px;font-weight:600;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
      </div>`).join('');
    for (const p of photos) {
      // URL-based display — no blob fetch needed; keep loop for future hooks
      const img = document.getElementById('pm-img-' + p.fileId);
      if (false) { // placeholder — blob fetch removed
        const img = document.getElementById('pm-img-' + p.fileId);
        const spin = document.getElementById('pm-spin-' + p.fileId);
        }
    }
  }

  async function handlePhotoUpload() {
    const input = document.getElementById('pm-file-input');
    const files = Array.from(input.files);
    if (!files.length || !photoModalKey) return;
    const status = document.getElementById('pm-upload-status');
    const btn = document.getElementById('pm-upload-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    status.style.color = 'var(--teal)';
    status.textContent = `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}...`;
    try {
      const cust   = customers[photoModalKey] || Object.values(customers).find(c => (c.name||'').trim().toUpperCase() === photoModalKey);
      const custId = cust ? cust.customerId : photoModalKey;
      for (let i = 0; i < files.length; i++) {
        status.textContent = `Uploading ${i+1} of ${files.length}...`;
        const photoMeta = await _dbUploadCustomerPhoto(files[i], currentBusinessId, custId);
        if (!customerPhotos[photoModalKey]) customerPhotos[photoModalKey] = [];
        customerPhotos[photoModalKey].push(photoMeta);
      }
      if (cust) await _dbUpdateCustomerPhotos(cust.customerId, customerPhotos[cust.customerId] || []);
      status.style.color = '#16a34a';
      status.textContent = `✓ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded!`;
      input.value = '';
      autoSync();
      renderPhotoModal(photoModalKey);
    } catch(e) {
      status.style.color = '#dc2626';
      status.textContent = 'Upload failed: ' + e.message;
    }
    btn.disabled = false;
    btn.textContent = '⬆ Upload';
  }

  // Lightbox
  function openPhotoLightbox(fileId) {
    // Find URL from metadata — no blob fetch needed with Supabase Storage
    const allPhotos = Object.values(customerPhotos).flat();
    const photo = allPhotos.find(p => p.fileId === fileId);
    const url = photo?.url;
    if (!url) return;
    const lb = document.getElementById('photoLightbox');
    document.getElementById('lb-img').src = url;
    lb.style.display = 'flex';
  }
  function closePhotoLightbox() {
    document.getElementById('photoLightbox').style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══ 6h. Review Requests ═══
  // Depends on: QUOTING ENGINE (savedQuotes — filters receipted jobs),
  //             EMAIL & COMMUNICATIONS (EmailJS for sending review link),
  //             SUPABASE (autoSync after marking request sent)
  // Called by:  REPORTS (renderReviewRequests sub-panel),
  //             PIPELINE (⭐ review button on job cards)
  // ═══════════════════════════════════════════════════════════════

  async function sendReviewRequest(i, btn) {
    const q = savedQuotes[i];
    if (!q.email) {
      alert('No email address on file. Edit this customer in the CRM to add one, then try again.');
      return;
    }
    const bizName = s('bizName') || 'The Window Crew';
    const bizEmail = s('bizEmail') || '';
    const firstName = (q.name || 'there').split(' ')[0];

    if (btn) btn.textContent = '⏳ Sending...';
    if (btn) btn.disabled = true;

    const plainBody = `Hey ${firstName}!

Thanks again for choosing ${bizName}. We really appreciate your support and hope you're loving those clean windows.

If you were happy with our work, we'd be incredibly thankful if you took a minute to leave us a quick Google review. As a small local business, every review truly helps us grow!

👉 https://g.page/r/CQVf6RM5_Es3EAE/review

As a thank you, mention this email when you book your next service and we'll take $25 off!

Thanks again,
${bizName}
${bizEmail}`;

    const htmlBody = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a3a4a;}
      .btn{display:inline-block;background:#f0d000;color:#1a3a4a;padding:14px 28px;border-radius:30px;text-decoration:none;font-weight:800;font-size:16px;margin:16px 0;}
      .footer{font-size:12px;color:#aaa;margin-top:24px;}</style>
    </head><body>
      <h2 style="color:#1e7d93;">Hey ${firstName}! 🪟</h2>
      <p>Thanks again for choosing <strong>${bizName}</strong>. We really appreciate your support and hope you're loving those clean windows!</p>
      <p>If you were happy with our work, we'd be incredibly thankful if you took a minute to leave us a quick Google review. As a small local business, every review truly helps us grow!</p>
      <a href="https://g.page/r/CQVf6RM5_Es3EAE/review" class="btn">⭐ Leave a Google Review</a>
      <p style="background:#fffbea;border-left:4px solid #f0d000;padding:10px 14px;border-radius:0 8px 8px 0;font-weight:700;">As a thank you, mention this email when you book your next service and we'll take <strong>$25 off!</strong></p>
      <div class="footer">Thanks again,<br><strong>${bizName}</strong><br>${bizEmail}</div>
    </body></html>`;

    try {
      await sendEmail({
        toEmail:     q.email,
        subject:     `Thanks for choosing ${bizName}! 🪟`,
        htmlContent: htmlBody,
        fromName:    bizName,
        fromEmail:   bizEmail,
      });
      savedQuotes[i].reviewRequestSent = true;
      savedQuotes[i].reviewPending = false;
      if (savedQuotes[i].id) await dbSaveJob(savedQuotes[i]).catch(e => console.error('[CrewHub] review save error:', e));
      if (savedQuotes[i].customerId) stampLastContact(savedQuotes[i].customerId);
    } catch(err) {
      console.error('Review request error:', err);
      alert('Failed to send. Error: ' + (err.text || err.message || JSON.stringify(err)));
      if (btn) btn.textContent = '⭐ Send Request';
      if (btn) btn.disabled = false;
    }
  }

  function showReviewRequest(q) {
    const contact = q.contact || '';
    const name    = q.name || 'there';
    const bizName = s('bizName') || 'The Window Crew';
    const bizEmail = s('bizEmail') || '';

    // Extract email if present, otherwise leave blank for user to fill
    // Use dedicated email field if present, else fall back to regex on contact string
    const emailMatch = contact.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const toEmail = q.email || (emailMatch ? emailMatch[0] : '');

    const subject = encodeURIComponent(`Thanks for choosing ${bizName}! 🪟`);
    const firstName = name.split(' ')[0] || name;
    const body = encodeURIComponent(
`Hey ${firstName}!

Thanks again for choosing ${bizName}. We really appreciate your support and hope you're loving those clean windows.

If you were happy with our work, we'd be incredibly thankful if you took a minute to leave us a quick Google review. As a small local business, every review truly helps us grow!

👉 https://g.page/r/CQVf6RM5_Es3EAE/review

As a thank you, mention this email when you book your next service and we'll take $25 off!

Thanks again,
${bizName}
${bizEmail}`
    );

    const mailtoLink = `mailto:${toEmail}?subject=${subject}&body=${body}`;

    const plainBody = decodeURIComponent(body);
    document.getElementById('rrm-name').textContent    = name;
    document.getElementById('rrm-contact').textContent = contact || 'No contact info saved';
    document.getElementById('rrm-preview').textContent  = plainBody;
    document.getElementById('rrm-mailto').href = mailtoLink;
    window._reviewEmailBody = plainBody;
    window._reviewEmailSubject = decodeURIComponent(subject);
    document.getElementById('quoteModal').style.display = 'none';
    document.getElementById('reviewModal').style.display = 'block';
  }

  function copyReviewEmail(btn) {
    const text = 'Subject: ' + (window._reviewEmailSubject || '') + '\n\n' + (window._reviewEmailBody || '');
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      btn.style.background = '#dcfce7';
      btn.style.borderColor = '#86efac';
      btn.style.color = '#16a34a';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '#e0f2fe';
        btn.style.borderColor = '#7dd3fc';
        btn.style.color = '#0369a1';
      }, 2000);
    });
  }

  function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
    document.getElementById('quoteModal').style.display = 'block';
  }

  function autoSync() {
    // No-op: data writes now go directly to Supabase via db* functions.
    // Kept so existing callers don't crash during transition.
  }

  async function pushSync() {
    // No-op: replaced by direct Supabase writes via db* functions.
  }

  function quoteFromLead(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    // Switch to quotes tab
    const quotesBtn = document.querySelector('.tab-btn[onclick*="\'quotes\'"]');
    if (quotesBtn) switchTab('quotes', quotesBtn);

    // Set property type button — use the plugin's bridge function (wc- prefixed IDs)
    const seg = lead.lead_segment || 'commercial';
    const typeMap = { commercial: 'Commercial', storefront: 'Storefront', residential: 'Residential' };
    const typeName = typeMap[seg] || 'Commercial';
    const typeBtn = document.querySelector(`.wc-type-btn[data-type="${typeName}"]`);
    if (typeBtn && window.wcSetType) window.wcSetType(typeBtn);

    // Fill customer fields
    const isResidential = seg === 'residential';
    document.getElementById('custCompany').value = isResidential ? '' : (lead.name || '');
    document.getElementById('custName').value    = isResidential ? (lead.name || '') : (lead.owner_name || lead.name || '');
    document.getElementById('custAddress').value = lead.address || '';
    document.getElementById('custPhone').value   = lead.phone   || '';
    document.getElementById('custEmail').value   = lead.email   || '';

    // Set lead source to Lead Pipeline if the option exists
    const srcSelect = document.getElementById('custLeadSource');
    if (srcSelect) {
      const opt = Array.from(srcSelect.options).find(o =>
        o.value.toLowerCase().includes('lead') || o.text.toLowerCase().includes('lead')
      );
      if (opt) srcSelect.value = opt.value;
    }

    // Scroll to top of quote form
    document.getElementById('tab-quotes').scrollTop = 0;
  }


  // ═══════════════════════════════════════════════════════════════
  // ═══ 7. BOOT ═══
  // The app initialization sequence. Runs once on page load.
  // All functions and variables are fully declared by this point.
  // ═══════════════════════════════════════════════════════════════

  // ── Initial UI state (renders before sign-in data loads) ──
  // calc() is called by initPluginAndUI() after the plugin is loaded at login.
  // No pre-login calc needed — the quote form is empty until the user signs in.
  setTimeout(() => attachPlacesAutocomplete('custAddress'), 1500);

  // ── Data migration ──
  window._crmOverridesForMigration = crmOverrides;
  migrateToCustomerTable();
  window._crmOverridesForMigration = null;

  // ── Deferred DOM listeners (require elements to exist in DOM) ──
  window.addEventListener('load', function() {
    // Restore logo preview
    const savedLogoId = localStorage.getItem('twc_logo_fileid') || '';
    if (savedLogoId) { const el = document.getElementById('bizLogoId'); if (el) el.value = savedLogoId; }
    if (cachedLogoB64) {
      const p = document.getElementById('logoPreview');
      if (p) { p.src = cachedLogoB64; p.style.display = 'inline-block'; }
      const s = document.getElementById('logoStatus');
      if (s) s.textContent = '✓ Logo loaded';
    }
  });

  // ── Supabase session restore ──
  (async function boot() {
    // 1. Check for ?invite=UUID in URL
    const params   = new URLSearchParams(window.location.search);
    const inviteId = params.get('invite');
    if (inviteId) {
      window.history.replaceState({}, '', window.location.pathname); // clean URL
      try {
        const { data } = await _sb.rpc('get_invite_info', { invite_id: inviteId });
        if (data) { _authInviteId = inviteId; _authInviteInfo = data; }
      } catch(e) { console.warn('[CrewHub] Could not load invite info:', e); }
    }

    // 2. Restore existing Supabase session
    const { data: { session } } = await _sb.auth.getSession();
    if (_authInviteInfo) {
      // Invite link clicked — always show the invite signup form so they create/confirm their account.
      // If they were already signed in on this browser, sign them out first to force a fresh login.
      if (session) await _sb.auth.signOut();
      sbUser = null;
      showAuthModal(); // shows 'invite' step with name/email/password fields
    } else if (session) {
      sbUser = session.user;
      await afterSignIn();
    } else {
      showAuthModal();
    }
  })();

  // ── Keep session alive across tab refreshes / token renewals ──
  _sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT')     { sbUser = null; setSyncUI('offline', 'Signed out'); showAuthModal(); }
    if (event === 'TOKEN_REFRESHED' && session) { sbUser = session.user; }
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // Expose store for debugging in console
  // Usage: window.__appStore.getState()
  window.__appStore = useAppStore;

  // ═══ WINDOW BRIDGE ═══
  // Every function referenced by an inline onclick/oninput/onchange/onkeydown
  // in the HTML is exposed here so it survives the module boundary.
  // When a function is converted to a React component, remove it from this list.
  // ═══════════════════════════════════════════════════════════════════════════
  Object.assign(window, {
    // ── Auth + Onboarding (index.html onclick handlers) ──
    handleSignIn, esc, escHtml: esc,
    handleNewBusinessSignup, handleJoinTeamSignup, handleInviteSignup,
    showAuthStep, selectBusiness, sbSignOut, handleSyncBtn, handleCreateBusiness,
    _doCreateBusiness, handleAddBusiness,

    // ── Plugin registry (exposed so the pick-trade step can list service types) ──
    getAvailableServiceTypes,

    // ── Logo Upload ──
    uploadBusinessLogo: async function(input) {
      const file = input.files[0];
      if (!file) return;
      const btn = document.getElementById('bizLogoUploadLabel');
      if (btn) btn.textContent = 'Uploading…';
      try {
        const url = await _dbUploadLogo(file, currentBusinessId);
        window._currentLogoUrl = url;
        const preview = document.getElementById('bizLogoPreview');
        if (preview) { preview.src = url; preview.style.display = 'block'; }
        const removeBtn = document.getElementById('bizLogoRemoveBtn');
        if (removeBtn) removeBtn.style.display = 'inline-flex';
      } catch(e) {
        alert('Logo upload failed: ' + e.message);
      } finally {
        if (btn) btn.textContent = '📷 Upload Logo';
      }
    },
    removeBusinessLogo: async function() {
      await _dbRemoveLogo(currentBusinessId);
      window._currentLogoUrl = null;
      const preview = document.getElementById('bizLogoPreview');
      if (preview) { preview.src = ''; preview.style.display = 'none'; }
      const removeBtn = document.getElementById('bizLogoRemoveBtn');
      if (removeBtn) removeBtn.style.display = 'none';
    },

    // ── Tab Switching ──
    switchTab,

    // ── Quoting UI (index.html form handlers) ──
    // Note: setCondition/setPlan/setType/setSide/toggleAddon/updateMeta are no longer
    // defined here — they are registered per-plugin via getWindowBridge() in initPluginAndUI().
    onCustNameInput, closeCustDropdown, selectCustomer, clearCustomerLink,
    calc, saveQuote, formatPhone, resetForm,

    // ── Document Generation (modal onclick handlers) ──
    generateQuote, generateQuoteFromSaved, generateReceiptFromSaved,
    selectPaymentMethod, generateInvoiceFromSaved,
    buildStandaloneHTML, downloadQuoteHTML, closeModal, printQuote, sendDocumentEmail,

    // ── Schedule Modal (modal onclick handlers) ──
    openScheduleModal, renderSchedDayPreview, updateDurationLabel,
    closeScheduleModal, confirmSchedule,

    // ── Assign Job Modal ──
    openAssignModal, closeAssignModal, doAssignJob,

    // ── Pipeline Actions (called by React PipelineTab via window.*) ──
    deleteQuote, toggleWon, preFillFromQuote,

    // ── DB Wrappers (called by React components via window.*) ──
    dbSaveCustomer, dbDeleteCustomer, dbSaveNote, dbDeleteNote,
    dbSaveLead, dbDeleteLead, dbSaveLeadsBatch, dbSaveNeighborhoodsBatch,
    stampLastContact, fetchPhotoBlob,

    // ── Photo Modal (index.html + React onclick handlers) ──
    openPhotoModal, openPhotoModalByIndex, closePhotoModal,
    handlePhotoUpload, deleteCustomerPhoto, extractLogoId, fetchAndCacheLogo,
    openPhotoLightbox:  typeof openPhotoLightbox  !== 'undefined' ? openPhotoLightbox  : undefined,
    closePhotoLightbox: typeof closePhotoLightbox !== 'undefined' ? closePhotoLightbox : undefined,

    // ── Reviews (called by React PipelineTab via window.*) ──
    sendReviewRequest, closeReviewModal,
    showReviewRequest: typeof showReviewRequest !== 'undefined' ? showReviewRequest : undefined,
    copyReviewEmail:   typeof copyReviewEmail   !== 'undefined' ? copyReviewEmail   : undefined,

    // ── Leads (called by React LeadsTab via window.*) ──
    quoteFromLead,

    // ── Export / Import ──
    exportJSON, importJSON, exportCSV,

    // ── Google Places callback ──
    initGooglePlaces: window.initGooglePlaces,
  });

  // Live getter so React PipelineTab always sees the current customerPhotos object
  Object.defineProperty(window, 'customerPhotos', { get: () => customerPhotos, configurable: true });

  // Make _pendingServiceType writable from inline onclick handlers (trade picker step)
  Object.defineProperty(window, '_pendingServiceType', {
    get: () => _pendingServiceType,
    set: (v) => { _pendingServiceType = v; },
    configurable: true,
  });
  Object.defineProperty(window, '_pendingNewBizServiceType', {
    get: () => _pendingNewBizServiceType,
    set: (v) => { _pendingNewBizServiceType = v; },
    configurable: true,
  });

  // Re-expose Google Places with the real function now that it's defined
  window.initGooglePlaces = function() {
    placesReady = true;
    try { attachPlacesAutocomplete('custAddress'); } catch(e) {}
  };

  // If the Maps SDK already fired before initLegacyApp ran, catch up now.
  // window._mapsApiReady is set by the inline stub in index.html.
  if (window._mapsApiReady) {
    window.initGooglePlaces();
  }
} // end initLegacyApp

// ── Run when DOM is ready ──────────────────────────────────────────────────
// <script type="module"> is deferred, so DOM is ready by the time this runs.
// We still guard with readyState for safety.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLegacyApp);
} else {
  initLegacyApp();
}
