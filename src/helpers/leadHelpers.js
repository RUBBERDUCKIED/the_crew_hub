// Lead display helpers — pure functions

export function scoreClass(score) {
  if (!score && score !== 0) return 'score-low';
  if (score >= 8) return 'score-high';
  if (score >= 5) return 'score-mid';
  return 'score-low';
}

export function statusStyle(status) {
  const map = {
    new:       'background:#e0f2fe; color:#0369a1;',
    contacted: 'background:#fef3c7; color:#92400e;',
    quoted:    'background:#ede9fe; color:#5b21b6;',
    won:       'background:#d1fae5; color:#065f46;',
    lost:      'background:#fee2e2; color:#991b1b;',
  };
  return map[status] || map.new;
}
