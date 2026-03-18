// Business configuration constants — pricing, plans, conditions, tags

export const conditionMultipliers = { maintenance: 1.0, mild: 1.05, moderate: 1.10, heavy: 1.20 };

export const conditionNotes = {
  maintenance: 'No surcharge — standard rate',
  mild:        'Mildly soiled — +5% surcharge',
  moderate:    'Moderately soiled — +10% surcharge',
  heavy:       'Heavily soiled — +20% surcharge'
};

export const planDiscounts = { oneoff: 0, annual: 5, biannual: 7.5, quarterly: 10, weekly: 0, biweekly: 0, monthly: 0 };

export const planNotes = {
  oneoff:   'No discount — one-off clean',
  annual:   'Annual plan — 5% discount applied',
  biannual: 'Twice a year plan — 7.5% discount applied',
  quarterly:'Quarterly plan — 10% discount applied',
  weekly:   'Storefront — weekly service ($2 std / $3.50 large per side)',
  biweekly: 'Storefront — bi-weekly service ($2 std / $3.50 large per side)',
  monthly:  'Storefront — monthly service ($2 std / $3.50 large per side)',
};

export const planIntervalDays = { annual: 365, biannual: 182, quarterly: 91, weekly: 7, biweekly: 14, monthly: 30 };

export const planLabel = { annual: 'Annual', biannual: 'Twice/Year', quarterly: 'Quarterly' };

export const CRM_TAG_PRESETS = [
  'Annual Contract', 'Quarterly', 'Bi-Annual',
  'Referral Source', 'VIP', 'Hard to Reach',
  'Residential', 'Commercial', 'Storefront',
  'New Customer', 'Needs Follow-Up', 'Cash Only'
];
