import { _sb } from './supabaseClient.js';

// ── Mappers ──

export function customerToRow(c, businessId) {
  const row = {
    business_id:       businessId,
    name:              c.name            || '',
    address:           c.address         || null,
    phone:             c.phone           || null,
    email:             c.email           || null,
    contact:           c.contact         || null,
    company:           c.company         || null,
    lead_source:       c.leadSource      || null,
    tags:              c.tags            || [],
    last_contact_date: c.lastContactDate || null,
    archived:          c.archived        || false,
    updated_at:        new Date().toISOString(),
  };
  if (c.customerId) row.id = c.customerId;
  if (c.createdAt)  row.created_at = c.createdAt;
  return row;
}

export function rowToCustomer(row) {
  return {
    customerId:      row.id,
    name:            row.name             || '',
    address:         row.address          || '',
    phone:           row.phone            || '',
    email:           row.email            || '',
    contact:         row.contact          || '',
    company:         row.company          || '',
    leadSource:      row.lead_source      || '',
    tags:            row.tags             || [],
    lastContactDate: row.last_contact_date || null,
    archived:        row.archived         || false,
    createdAt:       row.created_at       || null,
    updatedAt:       row.updated_at       || null,
    photos:          row.photos           || [],
  };
}

// ── Queries ──

export async function dbSaveCustomer(customerData, businessId) {
  const row = customerToRow(customerData, businessId);
  const { data, error } = await _sb
    .from('customers').upsert(row, { onConflict: 'id' }).select().single();
  if (error) { console.error('[CrewHub] dbSaveCustomer error:', error); throw error; }
  return rowToCustomer(data);
}

export async function dbDeleteCustomer(customerId) {
  const { error } = await _sb.from('customers').delete().eq('id', customerId);
  if (error) { console.error('[CrewHub] dbDeleteCustomer error:', error); throw error; }
}

export async function dbLoadAllCustomers(businessId) {
  let query = _sb.from('customers').select('*');
  if (businessId) query = query.eq('business_id', businessId);
  const { data, error } = await query;
  if (error) { console.error('[CrewHub] dbLoadAllCustomers error:', error); return []; }
  return (data || []).map(rowToCustomer);
}

// ── Photo Storage ─────────────────────────────────────────────────────────

/**
 * Compress an image file client-side using Canvas.
 * - Caps longest edge at maxPx (default 1200px)
 * - Exports as JPEG at the given quality (default 0.82 ≈ ~200–500 KB for phone shots)
 * - SVGs and GIFs are returned unchanged (can't meaningfully compress via canvas)
 * Returns a Blob ready for upload.
 */
function compressImage(file, { maxPx = 1200, quality = 0.82 } = {}) {
  // Skip compression for SVG / GIF — they don't benefit from canvas re-encode
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return Promise.resolve(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      // Downscale if either dimension exceeds maxPx
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                 { width  = Math.round(width  * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas compression failed')); return; }
        resolve(blob);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

export async function dbUploadCustomerPhoto(file, businessId, customerId) {
  // Compress before upload — keeps storage lean and uploads faster on mobile
  const compressed = await compressImage(file);
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') + '.jpg';
  const path       = `${businessId}/${customerId}/${Date.now()}-${safeName}`;
  const { error } = await _sb.storage
    .from('photos')
    .upload(path, compressed, { upsert: false, contentType: 'image/jpeg' });
  if (error) { console.error('[CrewHub] dbUploadCustomerPhoto error:', error); throw error; }
  const { data } = _sb.storage.from('photos').getPublicUrl(path);
  return {
    fileId:     path,
    url:        data.publicUrl,
    name:       file.name,
    uploadedAt: new Date().toISOString().slice(0, 10),
  };
}

export async function dbDeleteCustomerPhoto(path) {
  const { error } = await _sb.storage.from('photos').remove([path]);
  if (error) { console.error('[CrewHub] dbDeleteCustomerPhoto error:', error); throw error; }
}

export async function dbUpdateCustomerPhotos(customerId, photos) {
  // customerId here is the Supabase UUID (same as c.customerId in the app)
  const { error } = await _sb.from('customers')
    .update({ photos })
    .eq('id', customerId);
  if (error) { console.error('[CrewHub] dbUpdateCustomerPhotos error:', error); throw error; }
}
