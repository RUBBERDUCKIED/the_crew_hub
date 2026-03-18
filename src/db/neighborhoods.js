import { _sb } from './supabaseClient.js';

export async function dbSaveNeighborhoodsBatch(nbhdArray, businessId) {
  const rows = nbhdArray.map(n => ({
    business_id: businessId,
    name:        n.name,
    city:        n.city  || null,
    score:       n.score || null,
    data:        n.data  || null,
  }));
  const { data, error } = await _sb
    .from('neighborhoods').upsert(rows, { onConflict: 'id' }).select();
  if (error) { console.error('[CrewHub] dbSaveNeighborhoodsBatch error:', error); throw error; }
  return (data || []).map(r => ({ id: r.id, name: r.name, city: r.city, score: r.score, data: r.data }));
}

export async function dbLoadAllNeighborhoods() {
  const { data, error } = await _sb.from('neighborhoods').select('*');
  if (error) { console.error('[CrewHub] dbLoadAllNeighborhoods error:', error); return []; }
  return (data || []).map(r => ({ id: r.id, name: r.name, city: r.city, score: r.score, data: r.data }));
}
