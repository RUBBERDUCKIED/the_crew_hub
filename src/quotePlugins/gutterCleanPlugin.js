// src/quotePlugins/gutterCleanPlugin.js
//
// WHY: Skeleton for a future gutter cleaning trade plugin.
// Follows the same plugin contract as windowCleaningPlugin.js so it can be
// dropped into the registry without touching the orchestrator (legacy.js).
//
// TO DO: Replace placeholder getFormHTML(), calculateLineItems(), etc.
// with real gutter-cleaning pricing logic when this trade goes live.
// Uncomment in pluginRegistry.js when ready.

// ── Plugin-scoped state ───────────────────────────────────────────────────────
let storeys    = 1;   // 1 | 2 | 3
let linearFt   = 0;

// ── Internal UI handlers ──────────────────────────────────────────────────────
function setStoreys(n) {
  storeys = n;
  document.querySelectorAll('[id^="gc-storey-"]').forEach(b => b.classList.remove('active-side'));
  document.getElementById('gc-storey-' + n)?.classList.add('active-side');
  window.calc();
}

// ── Plugin contract ───────────────────────────────────────────────────────────
export const gutterCleanPlugin = {
  id:    'gutter-cleaning',
  label: 'Gutter Cleaning',

  // ── Property types shown in the Quote Builder header ─────────────────────
  propertyTypes: ['Residential', 'Commercial'],

  // ── Form HTML injected into #service-fields-container ────────────────────
  getFormHTML() {
    return `
      <!-- ── Storeys ────────────────────────────────────────────────────── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Storeys</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <button id="gc-storey-1" class="type-btn active-side" onclick="gcSetStoreys(1)">1 Storey</button>
          <button id="gc-storey-2" class="type-btn"             onclick="gcSetStoreys(2)">2 Storeys</button>
          <button id="gc-storey-3" class="type-btn"             onclick="gcSetStoreys(3)">3 Storeys</button>
        </div>
      </div>

      <!-- ── Linear Footage ────────────────────────────────────────────── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Gutter Length</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:120px">
            <label class="form-label">Linear Feet</label>
            <input id="gc-linearft" type="number" min="0" class="form-input"
                   placeholder="e.g. 120" oninput="calc()" />
          </div>
        </div>
      </div>

      <!-- ── Placeholder notice ─────────────────────────────────────────── -->
      <div style="padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;color:var(--muted)">
        ⚠️ Gutter cleaning pricing is not yet configured.
        Edit <code>src/quotePlugins/gutterCleanPlugin.js</code> to add real rates.
      </div>
    `;
  },

  // ── Defaults when the form is first loaded ────────────────────────────────
  getDefaultValues() {
    return {
      storeys:  1,
      linearFt: 0,
    };
  },

  // ── Pricing engine ────────────────────────────────────────────────────────
  // Returns an array of { label, amount } line items.
  // The orchestrator (legacy.js) handles travel, discount, and tax on top.
  calculateLineItems(fieldValues /*, propType */) {
    const ft       = parseFloat(fieldValues['gc-linearft']) || 0;
    const baseRate = 1.50;  // TODO: replace with real rate table (per linear ft)
    const storeyMult = storeys === 1 ? 1.0 : storeys === 2 ? 1.25 : 1.5;
    const base     = ft * baseRate * storeyMult;

    if (base === 0) return [];

    return [
      { label: `Gutter cleaning (${ft} linear ft, ${storeys} storey${storeys > 1 ? 's' : ''})`, amount: base },
    ];
  },

  // ── Reset all plugin fields to defaults ───────────────────────────────────
  resetFields() {
    storeys  = 1;
    linearFt = 0;

    const ftEl = document.getElementById('gc-linearft');
    if (ftEl) ftEl.value = '';

    document.querySelectorAll('[id^="gc-storey-"]').forEach(b => b.classList.remove('active-side'));
    document.getElementById('gc-storey-1')?.classList.add('active-side');
  },

  // ── Build the data object spread onto window._cur ────────────────────────
  buildQuoteData(fieldValues /*, propType */) {
    return {
      type:     'Residential',
      storeys:  storeys,
      linearFt: parseFloat(fieldValues['gc-linearft']) || 0,
    };
  },

  // ── Pre-fill the form from a saved quote ──────────────────────────────────
  preFillFromQuote(q) {
    storeys  = q.storeys  || 1;
    linearFt = q.linearFt || 0;

    const ftEl = document.getElementById('gc-linearft');
    if (ftEl) ftEl.value = linearFt || '';

    setStoreys(storeys);
  },

  // ── Window bridge: functions called by inline onclick handlers ────────────
  // Keys are the global names; values are the functions.
  getWindowBridge() {
    return {
      gcSetStoreys: setStoreys,
    };
  },
};
