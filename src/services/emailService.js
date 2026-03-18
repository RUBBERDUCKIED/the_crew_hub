// EmailJS wrapper — sends email using the configured service + template

import { CONFIG } from '../config.js';
import { esc } from '../helpers/formatting.js';

export async function sendEmail({ toEmail, subject, htmlContent, fromName, fromEmail }) {
  if (typeof emailjs === 'undefined') throw new Error('EmailJS not loaded');
  return emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, {
    to_email:     toEmail,
    subject:      subject,
    html_content: htmlContent,
    name:         fromName  || '',
    email:        fromEmail || '',
  });
}

export async function sendInviteEmail(toEmail, memberName, memberRole, inviteId, businessInfo) {
  const bizName   = businessInfo?.name  || 'Crew Hub';
  const bizEmail  = businessInfo?.email || '';
  const roleLabel = { owner: 'Owner', dispatcher: 'Dispatcher', crew: 'Crew Member' }[memberRole] || memberRole;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteId}`;
  const inviteHtml = `<!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Montserrat:wght@700;900&display=swap" rel="stylesheet">
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0;padding:20px;background:#f0f4f8;font-family:'Nunito',sans-serif;} .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.08);}</style>
  </head><body><div class="wrap">
    <div style="font-size:32px;margin-bottom:8px;">🪟</div>
    <h2 style="font-family:'Montserrat',sans-serif;font-size:20px;font-weight:900;color:#1a3a4a;margin:0 0 8px;">You're invited to join ${esc(bizName)}</h2>
    <p style="color:#4a7a8a;font-size:14px;font-weight:600;line-height:1.6;margin-bottom:24px;">Hi ${esc(memberName)}, you've been added as <strong>${esc(roleLabel)}</strong>. Click the button below to create your account and join the team.</p>
    <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#2a9db5,#1a6ea8);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-family:'Montserrat',sans-serif;font-weight:900;font-size:15px;">Accept Invite &amp; Join Team →</a>
    <p style="margin-top:24px;font-size:12px;color:#9ab4bc;font-weight:600;">Or copy this link: <a href="${inviteUrl}" style="color:#2a9db5;">${inviteUrl}</a></p>
    <p style="margin-top:8px;font-size:12px;color:#9ab4bc;font-weight:600;">This invite was sent by ${esc(bizName)} via Crew Hub.</p>
  </div></body></html>`;
  return sendEmail({
    toEmail,
    subject:     `You've been invited to join ${bizName}`,
    htmlContent: inviteHtml,
    fromName:    bizName,
    fromEmail:   bizEmail,
  });
}
