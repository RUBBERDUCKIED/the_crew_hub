// src/quotePlugins/windowCleaningPlugin.js
//
// WHY: Extracted from legacy.js and index.html to make the quoting system
// modular. This file contains ALL window-cleaning-specific quoting logic.
// The main system (legacy.js) calls these methods through the plugin contract
// — it never reaches into plugin internals.
//
// WHAT: Renders the window cleaning form fields, calculates line items based
// on pane counts / storeys / condition / plan / side / addons, and provides
// defaults and pre-fill logic for saved quotes.
//
// DEPENDENCIES: conditionMultipliers, conditionNotes, planDiscounts, planNotes
// from helpers/pricing.js (data constants only — no side effects).

import {
  conditionMultipliers, conditionNotes,
  planDiscounts, planNotes,
} from '../helpers/pricing.js';

// ── Plugin-scoped state ───────────────────────────────────────────────────────
// These were top-level variables in legacy.js. They now live in this module's
// closure — only accessible through the contract methods and window bridge.
let currentPropType  = 'Residential';
let cleaningSide     = 'outside';
let windowCondition  = 'maintenance';
let servicePlan      = 'oneoff';

// ── DOM helpers ───────────────────────────────────────────────────────────────
function v(id)   { return parseFloat(document.getElementById(id)?.value) || 0; }

// ── Internal UI handlers ──────────────────────────────────────────────────────
// Exposed to window.* via getWindowBridge() so inline onclick handlers work.

function setCondition(val) {
  windowCondition = val;
  document.querySelectorAll('[id^="wc-cond-"]').forEach(b => b.classList.remove('active-side'));
  document.getElementById('wc-cond-' + val)?.classList.add('active-side');
  const noteEl = document.getElementById('wc-condNote');
  if (noteEl) noteEl.textContent = conditionNotes[val] || '';
  window.calc();
}

function setPlan(val) {
  servicePlan = val;
  document.querySelectorAll('[id^="wc-plan-"]').forEach(b => b.classList.remove('active-side'));
  document.getElementById('wc-plan-' + val)?.classList.add('active-side');
  const noteEl = document.getElementById('wc-planNote');
  if (noteEl) noteEl.textContent = planNotes[val] || '';
  window.calc();
}

function setType(btn) {
  document.querySelectorAll('.wc-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPropType = btn.dataset.type;
  const isStorefront = currentPropType === 'Storefront';
  const isCommercial = currentPropType === 'Commercial';

  // Show/hide company name field in the SHARED customer section
  const companyField = document.getElementById('company-name-field');
  if (companyField) companyField.style.display = (isStorefront || isCommercial) ? 'block' : 'none';
  const nameLabel = document.getElementById('label-custName');
  if (nameLabel) nameLabel.textContent = (isStorefront || isCommercial) ? 'Contact Name' : 'Customer Name';

  // Swap plan panels
  const resPlans  = document.getElementById('wc-plans-residential');
  const sfPlans   = document.getElementById('wc-plans-storefront');
  if (resPlans) resPlans.style.display = isStorefront ? 'none' : 'grid';
  if (sfPlans)  sfPlans.style.display  = isStorefront ? 'grid' : 'none';

  // Swap prices and min charge
  const priceStdEl   = document.getElementById('wc-priceStd');
  const priceLargeEl = document.getElementById('wc-priceLarge');
  const minChargeEl  = document.getElementById('wc-minCharge');
  if (priceStdEl)   priceStdEl.value   = isStorefront ? '2.00' : '4.00';
  if (priceLargeEl) priceLargeEl.value = isStorefront ? '3.50' : '7.00';
  if (minChargeEl)  minChargeEl.value  = isStorefront ? '25.00' : '60.00';

  // Show/hide storey surcharge row
  const storeyRow = document.getElementById('wc-storey-surcharge-row');
  if (storeyRow) storeyRow.style.display = isStorefront ? 'none' : 'block';

  // Update field labels
  const stdLbl   = document.getElementById('wc-label-priceStd');
  const largeLbl = document.getElementById('wc-label-priceLarge');
  if (stdLbl)   stdLbl.textContent   = isStorefront ? 'Standard Door/Pane ($ / side)' : 'Standard ($ / pane)';
  if (largeLbl) largeLbl.textContent = isStorefront ? 'Large Pane ($ / side)' : 'Large ($ / pane)';

  // Default plan for this type
  setPlan(isStorefront ? 'monthly' : 'oneoff');
  window.calc();
}

function setSide(val) {
  cleaningSide = val;
  ['outside', 'inside', 'both'].forEach(side => {
    document.getElementById('wc-side-' + side)?.classList.toggle('active-side', side === val);
  });
  const notes = {
    outside: 'Outside only — standard rate',
    inside:  'Inside only — standard rate',
    both:    'Inside & outside — ×1.6 multiplier',
  };
  const noteEl = document.getElementById('wc-sideNote');
  if (noteEl) noteEl.textContent = notes[val] || '';
  window.calc();
}

function toggleAddon(el) {
  el.classList.toggle('on');
  if (el.id === 'wc-ao-screens') {
    const wrap = document.getElementById('wc-screenCountWrap');
    const isActive = el.classList.contains('on');
    if (wrap) wrap.style.display = isActive ? 'block' : 'none';
    el.style.borderRadius = isActive ? '10px 10px 0 0' : '10px';
    if (isActive) document.getElementById('wc-screenCount')?.focus();
  }
  if (el.id === 'wc-ao-hw') {
    const wrap = document.getElementById('wc-hwCountWrap');
    const isActive = el.classList.contains('on');
    if (wrap) wrap.style.display = isActive ? 'block' : 'none';
    el.style.borderRadius = isActive ? '10px 10px 0 0' : '10px';
    if (isActive) document.getElementById('wc-hwCount')?.focus();
  }
  window.calc();
}

function updateMeta() {
  const el = document.getElementById('wc-hwMeta');
  if (el) el.textContent = `$${v('wc-hwPrice').toFixed(2)} per window`;
  const screenEl = document.getElementById('wc-screenMeta');
  if (screenEl) screenEl.textContent = `$${v('wc-screenPrice').toFixed(2)} per screen`;
}


// ═════════════════════════════════════════════════════════════════════════════
// THE EXPORTED PLUGIN OBJECT
// ═════════════════════════════════════════════════════════════════════════════

export const windowCleaningPlugin = {

  id:    'window-cleaning',
  label: 'Window Cleaning',
  propertyTypes: ['Residential', 'Commercial', 'Storefront'],

  // Allows the orchestrator to read the active prop type without reaching in
  get _currentPropType() { return currentPropType; },

  // ── getFormHTML ─────────────────────────────────────────────────────────────
  // Returns the full HTML for the window cleaning form section.
  // All IDs are prefixed with 'wc-' to avoid collisions.
  // All onclick/oninput handlers call window.wc* functions registered via
  // getWindowBridge(), or call window.calc() for recalculation.
  getFormHTML(propType) {
    return `
      <!-- ── 2-column layout: core fields left, add-ons + adjustments right ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">

        <!-- ── LEFT COLUMN: Window Details + Condition + Plan + Pricing ── -->
        <div class="card">

          <div class="card-title" style="margin-bottom:4px;">Property Type</div>
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <button class="wc-type-btn type-btn active" data-type="Residential" onclick="wcSetType(this)">Residential</button>
            <button class="wc-type-btn type-btn" data-type="Commercial" onclick="wcSetType(this)">Commercial</button>
            <button class="wc-type-btn type-btn" data-type="Storefront" onclick="wcSetType(this)">Storefront</button>
          </div>

          <hr class="divider">
          <div class="card-title">Window Details</div>

          <div class="two">
            <div>
              <label class="field-label"># Standard Panes</label>
              <div class="input-wrap">
                <input type="number" id="wc-stdCount" value="10" min="0" oninput="calc()">
              </div>
            </div>
            <div>
              <label class="field-label"># Large Panes</label>
              <div class="input-wrap">
                <input type="number" id="wc-largeCount" value="0" min="0" oninput="calc()">
              </div>
            </div>
          </div>

          <div id="wc-storey-surcharge-row">
            <label class="field-label">Storeys / Floors</label>
            <div class="input-wrap">
              <input type="number" id="wc-storeys" value="1" min="1" oninput="calc()">
            </div>
          </div>

          <hr class="divider">

          <div class="addon-name" style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">Window Condition</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px;">
            <button class="side-btn active-side" id="wc-cond-maintenance" onclick="wcSetCondition('maintenance')">✨ Maintenance</button>
            <button class="side-btn" id="wc-cond-mild" onclick="wcSetCondition('mild')">🟡 Mildly Soiled</button>
            <button class="side-btn" id="wc-cond-moderate" onclick="wcSetCondition('moderate')">🟠 Moderately Soiled</button>
            <button class="side-btn" id="wc-cond-heavy" onclick="wcSetCondition('heavy')">🔴 Heavily Soiled</button>
          </div>
          <div style="font-size:10px;font-weight:600;color:var(--muted);margin-bottom:14px;" id="wc-condNote">No surcharge — standard rate</div>

          <hr class="divider">

          <div class="addon-name" style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">Service Plan</div>
          <div id="wc-plans-residential" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px;">
            <button class="side-btn active-side" id="wc-plan-oneoff" onclick="wcSetPlan('oneoff')">1× One-Off</button>
            <button class="side-btn" id="wc-plan-annual" onclick="wcSetPlan('annual')">📅 Annual  −5%</button>
            <button class="side-btn" id="wc-plan-biannual" onclick="wcSetPlan('biannual')">📅 Twice/Year  −7.5%</button>
            <button class="side-btn" id="wc-plan-quarterly" onclick="wcSetPlan('quarterly')">📅 Quarterly  −10%</button>
          </div>
          <div id="wc-plans-storefront" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:4px;">
            <button class="side-btn" id="wc-plan-weekly" onclick="wcSetPlan('weekly')">📆 Weekly</button>
            <button class="side-btn" id="wc-plan-biweekly" onclick="wcSetPlan('biweekly')">📆 Bi-Weekly</button>
            <button class="side-btn active-side" id="wc-plan-monthly" onclick="wcSetPlan('monthly')">📆 Monthly</button>
          </div>
          <div style="font-size:10px;font-weight:600;color:var(--muted);margin-bottom:14px;" id="wc-planNote"></div>

          <hr class="divider">
          <div class="card-title" style="margin-bottom:12px;">Pricing</div>
          <div class="two">
            <div>
              <label class="field-label" id="wc-label-priceStd">Standard ($ / pane)</label>
              <div class="input-wrap pfx-wrap">
                <span class="pfx">$</span>
                <input type="number" id="wc-priceStd" value="4.00" min="0" step="0.50" oninput="calc()">
              </div>
            </div>
            <div>
              <label class="field-label" id="wc-label-priceLarge">Large ($ / pane)</label>
              <div class="input-wrap pfx-wrap">
                <span class="pfx">$</span>
                <input type="number" id="wc-priceLarge" value="7.00" min="0" step="0.50" oninput="calc()">
              </div>
            </div>
          </div>

          <div id="wc-storey-surcharge-row-price">
            <label class="field-label">Upper Floor Surcharge ($ / window)</label>
            <div class="input-wrap pfx-wrap">
              <span class="pfx">$</span>
              <input type="number" id="wc-floorSurcharge" value="3.00" min="0" step="0.50" oninput="calc()">
            </div>
          </div>

          <label class="field-label">Minimum Job Charge ($)</label>
          <div class="input-wrap pfx-wrap">
            <span class="pfx">$</span>
            <input type="number" id="wc-minCharge" value="60.00" min="0" oninput="calc()">
          </div>
        </div>
        <!-- /LEFT COLUMN -->

        <!-- ── RIGHT COLUMN: Add-ons + Adjustments ── -->
        <div style="display:flex;flex-direction:column;gap:16px;">

          <div class="card">
            <div class="card-title" style="margin-bottom:12px;">Add-ons</div>

            <div class="addon-name" style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">Cleaning Side</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
              <button class="side-btn active-side" id="wc-side-outside" onclick="wcSetSide('outside')">Outside Only</button>
              <button class="side-btn" id="wc-side-inside" onclick="wcSetSide('inside')">Inside Only</button>
              <button class="side-btn" id="wc-side-both" onclick="wcSetSide('both')">Inside &amp; Out</button>
            </div>
            <div style="font-size:10px;font-weight:600;color:var(--muted);margin-top:6px;margin-bottom:14px;" id="wc-sideNote">Outside only — standard rate</div>

            <div class="addon" id="wc-ao-screens" onclick="wcToggleAddon(this)">
              <div class="addon-info">
                <div class="addon-name">Screen Cleaning</div>
                <div class="addon-sub" id="wc-screenMeta">$2.00 per screen</div>
              </div>
              <div class="check"><svg viewBox="0 0 14 14"><polyline points="2,7 5.5,11 12,3"/></svg></div>
            </div>
            <div id="wc-screenCountWrap" style="display:none;margin-top:-4px;padding:10px 14px;background:#e6f6fa;border:2px solid var(--teal);border-top:none;border-radius:0 0 10px 10px;margin-bottom:8px;">
              <label class="field-label"># of Screens</label>
              <div class="input-wrap" style="margin-bottom:0;">
                <input type="number" id="wc-screenCount" value="0" min="0" oninput="calc()" onclick="event.stopPropagation()">
              </div>
            </div>

            <div class="addon" id="wc-ao-hw" onclick="wcToggleAddon(this)" style="margin-top:8px;">
              <div class="addon-info">
                <div class="addon-name">Hard Water Treatment</div>
                <div class="addon-sub" id="wc-hwMeta">$6.00 per window</div>
              </div>
              <div class="check"><svg viewBox="0 0 14 14"><polyline points="2,7 5.5,11 12,3"/></svg></div>
            </div>
            <div id="wc-hwCountWrap" style="display:none;margin-top:-4px;padding:10px 14px;background:#fef3c7;border:2px solid #d97706;border-top:none;border-radius:0 0 10px 10px;">
              <label class="field-label"># of Windows</label>
              <div class="input-wrap" style="margin-bottom:0;">
                <input type="number" id="wc-hwCount" value="0" min="0" oninput="calc()" onclick="event.stopPropagation()">
              </div>
            </div>

            <hr class="divider">
            <div class="card-title" style="margin-bottom:12px;">Add-on Rates</div>
            <div class="two">
              <div>
                <label class="field-label">Screen price ($)</label>
                <div class="input-wrap pfx-wrap">
                  <span class="pfx">$</span>
                  <input type="number" id="wc-screenPrice" value="2.00" min="0" step="0.50" oninput="wcUpdateMeta();calc()">
                </div>
              </div>
              <div>
                <label class="field-label">Hard water ($)</label>
                <div class="input-wrap pfx-wrap">
                  <span class="pfx">$</span>
                  <input type="number" id="wc-hwPrice" value="6.00" min="0" step="0.50" oninput="wcUpdateMeta();calc()">
                </div>
              </div>
            </div>
          </div>

          <!-- Adjustments — shared across all trades, IDs read by legacy.js calc() -->
          <div class="card">
            <div class="card-title" style="margin-bottom:12px;">Adjustments</div>
            <div class="two">
              <div>
                <label class="field-label">Travel / Call-out ($)</label>
                <div class="input-wrap pfx-wrap">
                  <span class="pfx">$</span>
                  <input type="number" id="travel" value="0" min="0" oninput="calc()">
                </div>
              </div>
              <div>
                <label class="field-label">Discount (%)</label>
                <div class="input-wrap">
                  <input type="number" id="discount" value="0" min="0" max="100" oninput="calc()">
                </div>
              </div>
              <div>
                <label class="field-label">Discount ($)</label>
                <div class="input-wrap pfx-wrap">
                  <span class="pfx">$</span>
                  <input type="number" id="discountDollar" value="0" min="0" oninput="calc()">
                </div>
              </div>
              <div>
                <label class="field-label">GST / Tax (%)</label>
                <div class="input-wrap">
                  <input type="number" id="tax" value="0" min="0" oninput="calc()">
                </div>
              </div>
            </div>
          </div>

        </div>
        <!-- /RIGHT COLUMN -->

      </div>
    `;
  },

  // ── getDefaultValues ─────────────────────────────────────────────────────────
  getDefaultValues(propType) {
    const isStorefront = propType === 'Storefront';
    return {
      'wc-stdCount':      10,
      'wc-largeCount':    0,
      'wc-storeys':       1,
      'wc-priceStd':      isStorefront ? 2.00 : 4.00,
      'wc-priceLarge':    isStorefront ? 3.50 : 7.00,
      'wc-floorSurcharge': 3.00,
      'wc-minCharge':     isStorefront ? 25.00 : 60.00,
      'wc-screenPrice':   2.00,
      'wc-hwPrice':       6.00,
      'wc-screenCount':   0,
      'wc-hwCount':       0,
    };
  },

  // ── calculateLineItems ───────────────────────────────────────────────────────
  // The pricing engine — extracted from the old calc() in legacy.js.
  // Returns { lines, subtotal } BEFORE travel, shared discounts, and tax.
  // The orchestrator (legacy.js calc()) applies those on top.
  calculateLineItems(fieldValues, propType) {
    const std   = Math.max(0, fieldValues['wc-stdCount']  || 0);
    const large = Math.max(0, fieldValues['wc-largeCount'] || 0);
    const total = std + large;
    const isStorefront = propType === 'Storefront';

    const storeys       = Math.max(1, fieldValues['wc-storeys']       || 1);
    const floorSurcharge = fieldValues['wc-floorSurcharge'] || 0;
    const surch = isStorefront ? 0 : total * (1 - 1 / storeys) * floorSurcharge;

    const sideMultiplier = isStorefront
      ? (cleaningSide === 'both' ? 2 : 1)
      : (cleaningSide === 'both' ? 1.6 : 1);

    const priceStd   = fieldValues['wc-priceStd']  || 0;
    const priceLarge = fieldValues['wc-priceLarge'] || 0;
    const minCharge  = fieldValues['wc-minCharge']  || 0;

    let base = (std * priceStd + large * priceLarge) * sideMultiplier + surch;
    base *= conditionMultipliers[windowCondition] || 1.0;

    const preMin = base;
    base = Math.max(base, total > 0 ? minCharge : 0);
    const hitMin = total > 0 && base === minCharge && preMin < minCharge;

    let lines = [];
    if (isStorefront) {
      const sideLabel = cleaningSide === 'both' ? ' (×2 sides)' : cleaningSide === 'inside' ? ' (inside)' : ' (outside)';
      if (std > 0)   lines.push({ l: `${std} standard pane${std > 1 ? 's' : ''}  ×  $${priceStd.toFixed(2)}/side${sideLabel}`,   a: std * priceStd * sideMultiplier, c: '' });
      if (large > 0) lines.push({ l: `${large} large pane${large > 1 ? 's' : ''}  ×  $${priceLarge.toFixed(2)}/side${sideLabel}`, a: large * priceLarge * sideMultiplier, c: '' });
    } else {
      if (std > 0)   lines.push({ l: `${std} standard pane${std > 1 ? 's' : ''}  ×  $${priceStd.toFixed(2)}`,   a: std * priceStd, c: '' });
      if (large > 0) lines.push({ l: `${large} large pane${large > 1 ? 's' : ''}  ×  $${priceLarge.toFixed(2)}`, a: large * priceLarge, c: '' });
      if (surch > 0) lines.push({ l: 'Upper storey surcharge', a: surch, c: '' });
      if (cleaningSide === 'outside') lines.push({ l: 'Outside only', a: 0, c: '' });
      if (cleaningSide === 'inside')  lines.push({ l: 'Inside only',  a: 0, c: '' });
      if (cleaningSide === 'both')    lines.push({ l: 'Inside & outside  ×1.6', a: (base / (conditionMultipliers[windowCondition] || 1)) - (base / (conditionMultipliers[windowCondition] || 1)) / 1.6, c: '' });
    }
    if (windowCondition !== 'maintenance') {
      const pct = Math.round((conditionMultipliers[windowCondition] - 1) * 100);
      lines.push({ l: `${windowCondition.charAt(0).toUpperCase() + windowCondition.slice(1)} soiled  +${pct}%`, a: base - base / (conditionMultipliers[windowCondition] || 1), c: '' });
    }
    if (hitMin) lines.push({ l: 'Minimum job charge applied', a: minCharge - preMin, c: '' });

    let subtotal = base;

    // Screen addon
    if (fieldValues['wc-ao-screens']) {
      const screenCount = Math.max(0, fieldValues['wc-screenCount'] || 0);
      const screenPrice = fieldValues['wc-screenPrice'] || 0;
      const sc = screenCount * screenPrice;
      subtotal += sc;
      lines.push({ l: `Screen cleaning  (${screenCount} screen${screenCount !== 1 ? 's' : ''})`, a: sc, c: '' });
    }
    // Hard water addon
    if (fieldValues['wc-ao-hw']) {
      const hwCount = Math.max(0, fieldValues['wc-hwCount'] || 0);
      const hwPrice = fieldValues['wc-hwPrice'] || 0;
      const hwAmt   = hwCount * hwPrice;
      subtotal += hwAmt;
      lines.push({ l: `Hard water treatment  (${hwCount} window${hwCount !== 1 ? 's' : ''})`, a: hwAmt, c: '' });
    }

    // Service plan discount (applied here so the plan label appears near the
    // trade-specific lines, not after travel and shared discounts)
    const planDisc = planDiscounts[servicePlan] || 0;
    if (planDisc > 0) {
      const d = subtotal * planDisc / 100;
      subtotal -= d;
      const PLAN_LABELS = {
        annual: 'Annual plan', biannual: 'Twice/year plan', quarterly: 'Quarterly plan',
        weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly',
      };
      lines.push({ l: `${PLAN_LABELS[servicePlan]}  −${planDisc}%`, a: -d, c: 'disc' });
    }

    return { lines, subtotal };
  },

  // ── resetFields ──────────────────────────────────────────────────────────────
  resetFields(propType) {
    currentPropType  = propType || 'Residential';
    cleaningSide     = 'outside';
    windowCondition  = 'maintenance';
    servicePlan      = currentPropType === 'Storefront' ? 'monthly' : 'oneoff';

    // Apply numeric defaults to DOM
    const defaults = this.getDefaultValues(currentPropType);
    Object.entries(defaults).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    // Reset addon toggles
    ['wc-ao-screens', 'wc-ao-hw'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('on'); el.style.borderRadius = '10px'; }
    });
    const screenWrap = document.getElementById('wc-screenCountWrap');
    if (screenWrap) screenWrap.style.display = 'none';
    const hwWrap = document.getElementById('wc-hwCountWrap');
    if (hwWrap) hwWrap.style.display = 'none';

    // Reset button states (these call calc internally — suppress by setting flags first)
    setSide('outside');
    setCondition('maintenance');
    setPlan(currentPropType === 'Storefront' ? 'monthly' : 'oneoff');

    // Reset property type buttons
    document.querySelectorAll('.wc-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === currentPropType);
    });

    // Show/hide panels for current prop type
    const resPlans = document.getElementById('wc-plans-residential');
    const sfPlans  = document.getElementById('wc-plans-storefront');
    const storeyRow = document.getElementById('wc-storey-surcharge-row');
    if (resPlans)   resPlans.style.display   = currentPropType === 'Storefront' ? 'none' : 'grid';
    if (sfPlans)    sfPlans.style.display    = currentPropType === 'Storefront' ? 'grid' : 'none';
    if (storeyRow)  storeyRow.style.display  = currentPropType === 'Storefront' ? 'none' : 'block';

    const storeyRowPrice = document.getElementById('wc-storey-surcharge-row-price');
    if (storeyRowPrice) storeyRowPrice.style.display = currentPropType === 'Storefront' ? 'none' : 'block';

    updateMeta();
  },

  // ── buildQuoteData ───────────────────────────────────────────────────────────
  // Returns the trade-specific fields to persist on the quote object.
  // Merged into the quote by the orchestrator's calc() via window._cur spread.
  buildQuoteData(fieldValues, propType) {
    return {
      type:      currentPropType,
      std:       fieldValues['wc-stdCount']   || 0,
      large:     fieldValues['wc-largeCount'] || 0,
      storeys:   fieldValues['wc-storeys']    || 1,
      condition: windowCondition,
      plan:      servicePlan,
      side:      cleaningSide,
      addons: [
        cleaningSide === 'inside' && 'Inside Only',
        cleaningSide === 'both'   && 'Inside/Out',
        fieldValues['wc-ao-screens'] && 'Screens',
        fieldValues['wc-ao-hw']      && 'Hard Water',
      ].filter(Boolean),
    };
  },

  // ── preFillFromQuote ─────────────────────────────────────────────────────────
  // Restores trade-specific form fields from a saved quote object.
  // Called by the orchestrator's preFillFromQuote() wrapper.
  preFillFromQuote(q) {
    const stdEl   = document.getElementById('wc-stdCount');
    const largeEl = document.getElementById('wc-largeCount');
    if (stdEl)   stdEl.value   = q.std   || 0;
    if (largeEl) largeEl.value = q.large || 0;

    // Restore property type
    if (q.type) {
      document.querySelectorAll('.wc-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === q.type);
      });
      currentPropType = q.type;
    }

    // Restore condition, plan, side (each function calls calc — defer until last)
    if (q.condition) setCondition(q.condition);
    if (q.plan)      setPlan(q.plan);
  },

  // ── getWindowBridge ──────────────────────────────────────────────────────────
  // Returns functions to merge into window.* for inline HTML handler use.
  // All names are prefixed with 'wc' to avoid collisions with other plugins.
  getWindowBridge() {
    return {
      wcSetCondition: setCondition,
      wcSetPlan:      setPlan,
      wcSetType:      setType,
      wcSetSide:      setSide,
      wcToggleAddon:  toggleAddon,
      wcUpdateMeta:   updateMeta,
    };
  },
};
