// src/quotePlugins/pluginRegistry.js
//
// WHY: Maps the service_type string from the businesses table to the correct
// quote plugin object. Every business has one service type; the app loads the
// matching plugin once at login and uses it for the entire session.
//
// TO ADD A NEW TRADE:
//   1. Create src/quotePlugins/myTradePlugin.js following the plugin contract
//   2. Import it below and add one line to PLUGIN_MAP

import { windowCleaningPlugin } from './windowCleaningPlugin.js';
// import { pressureWashPlugin }  from './pressureWashPlugin.js';
// import { gutterCleanPlugin }   from './gutterCleanPlugin.js';

const PLUGIN_MAP = {
  'window-cleaning': windowCleaningPlugin,
  // 'pressure-washing': pressureWashPlugin,
  // 'gutter-cleaning':  gutterCleanPlugin,
};

const DEFAULT_SERVICE_TYPE = 'window-cleaning';

// ── resolveQuotePlugin ────────────────────────────────────────────────────────
// Called once during afterSignIn() after the business record is loaded.
// Returns the plugin object for the business's service_type.
// Falls back to window-cleaning if the type is unrecognised (should never
// happen in production — guards against stale or corrupted DB values).
// ─────────────────────────────────────────────────────────────────────────────
export function resolveQuotePlugin(serviceType) {
  const plugin = PLUGIN_MAP[serviceType || DEFAULT_SERVICE_TYPE];
  if (!plugin) {
    console.warn(`[CrewHub] Unknown service_type "${serviceType}", falling back to default`);
    return PLUGIN_MAP[DEFAULT_SERVICE_TYPE];
  }
  return plugin;
}

// Returns [{ id, label }] for every registered plugin — used in the onboarding
// trade-picker step so the UI doesn't need to know about the map directly.
export function getAvailableServiceTypes() {
  return Object.entries(PLUGIN_MAP).map(([id, plugin]) => ({
    id,
    label: plugin.label,
  }));
}
