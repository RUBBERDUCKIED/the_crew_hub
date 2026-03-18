// src/quotePlugins/pressureWashPlugin.js
//
// WHY: Skeleton for a future pressure washing trade plugin.
// Follows the same plugin contract as windowCleaningPlugin.js so it can be
// dropped into the registry without touching the orchestrator (legacy.js).
//
// TO DO: Replace placeholder getFormHTML(), calculateLineItems(), etc.
// with real pressure-washing pricing logic when this trade goes live.
// Uncomment in pluginRegistry.js when ready.

// ── Plugin-scoped state ───────────────────────────────────────────────────────
let currentSurface = 'driveway'; // driveway | deck | house | fence

// ── Internal UI handlers ──────────────────────────────────────────────────────
function setSurface(val) {
  currentSurface = val;
  document.querySelectorAll('[id^="pw-surf-"]').forEach(b => b.classList.remove('active-side'));
  document.getElementById('pw-surf-' + val)?.classList.add('active-side');
  window.calc();
}

// ── Plugin contract ───────────────────────────────────────────────────────────
export const pressureWashPlugin = {
  id:    'pressure-washing',
  label: 'Pressure Washing',

  // ── Property types shown in the Quote Builder header ─────────────────────
  propertyTypes: ['Residential', 'Commercial'],

  // ── Form HTML injected into #service-fields-container ────────────────────
  getFormHTML() {
    return `
      <!-- ── Surface Type ───────────────────────────────────────────────── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Surface Type</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <button id="pw-surf-driveway" class="type-btn active-side" onclick="pwSetSurface('driveway')">Driveway</button>
          <button id="pw-surf-deck"     class="type-btn"             onclick="pwSetSurface('deck')">Deck / Patio</button>
          <button id="pw-surf-house"    class="type-btn"             onclick="pwSetSurface('house')">House Exterior</button>
          <button id="pw-surf-fence"    class="type-btn"             onclick="pwSetSurface('fence')">Fence</button>
        </div>
      </div>

      <!-- ── Square Footage ─────────────────────────────────────────────── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Area</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:120px">
            <label class="form-label">Square Feet</label>
            <input id="pw-sqft" type="number" min="0" class="form-input"
                   placeholder="e.g. 500" oninput="calc()" />
          </div>
        </div>
      </div>

      <!-- ── Placeholder notice ─────────────────────────────────────────── -->
      <div style="padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;color:var(--muted)">
        ⚠️ Pressure washing pricing is not yet configured.
        Edit <code>src/quotePlugins/pressureWashPlugin.js</code> to add real rates.
      </div>
    `;
  },

  // ── Defaults when the form is first loaded ────────────────────────────────
  getDefaultValues() {
    return {
      surface: 'driveway',
    };
  },

  // ── Pricing engine ────────────────────────────────────────────────────────
  // Returns an array of { label, amount } line items.
  // The orchestrator (legacy.js) handles travel, discount, and tax on top.
  calculateLineItems(fieldValues /*, propType */) {
    const sqft  = parseFloat(fieldValues['pw-sqft']) || 0;
    const ratePerSqft = 0.25; // TODO: replace with real rate table
    const base  = sqft * ratePerSqft;

    if (base === 0) return [];

    return [
      { label: `Pressure washing (${sqft} sq ft)`, amount: base },
    ];
  },

  // ── Reset all plugin fields to defaults ───────────────────────────────────
  resetFields() {
    currentSurface = 'driveway';

    const sqftEl = document.getElementById('pw-sqft');
    if (sqftEl) sqftEl.value = '';

    document.querySelectorAll('[id^="pw-surf-"]').forEach(b => b.classList.remove('active-side'));
    document.getElementById('pw-surf-driveway')?.classList.add('active-side');
  },

  // ── Build the data object spread onto window._cur ────────────────────────
  buildQuoteData(fieldValues /*, propType */) {
    return {
      type:    'Commercial', // pressure washing is typically commercial
      surface: currentSurface,
      sqft:    parseFloat(fieldValues['pw-sqft']) || 0,
    };
  },

  // ── Pre-fill the form from a saved quote ──────────────────────────────────
  preFillFromQuote(q) {
    currentSurface = q.surface || 'driveway';

    const sqftEl = document.getElementById('pw-sqft');
    if (sqftEl) sqftEl.value = q.sqft || '';

    setSurface(currentSurface);
  },

  // ── Window bridge: functions called by inline onclick handlers ────────────
  // Keys are the global names; values are the functions.
  getWindowBridge() {
    return {
      pwSetSurface: setSurface,
    };
  },
};
