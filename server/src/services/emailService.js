const { Resend } = require('resend');
const nodemailer = require('nodemailer');

/**
 * Multi-Provider Email Service
 * 
 * Supports:
 * 1. Brevo (Sendinblue) API — Primary (300 free emails/day = 9,000/month)
 * 2. Resend API — Fallback 1 (100 free emails/day)
 * 3. Nodemailer (SMTP) — Fallback 2 (Emergency Gmail/Custom SMTP)
 */

// Resolve the public portal URL from CLIENT_URL env (take first entry if comma-separated)
function getPortalUrl() {
  const raw = process.env.CLIENT_URL || 'https://axonmedacademy.com';
  const urls = raw.split(',').map((u) => u.trim()).filter(Boolean);
  const prod = urls.find((u) => u.startsWith('https://'));
  return prod || urls[0];
}

// ─── Provider: Brevo (Sendinblue) HTTP API ────────────────────────────────────

async function sendViaBrevo({ to, toName, subject, html, fromEmail, fromName }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const senderEmail = fromEmail || process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'no-reply@axonmedacademy.com';
  const senderName = fromName || process.env.BREVO_SENDER_NAME || process.env.EMAIL_FROM_NAME || 'Axon Med Academy';

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent: html,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey.trim(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || `Brevo Error HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return { id: data.messageId || 'sent', provider: 'Brevo' };
}

// ─── Provider: Resend HTTP API ────────────────────────────────────────────────

async function sendViaResend({ to, subject, html, fromEmail, fromName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey.trim());
  const senderEmail = fromEmail || process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const senderName = fromName || process.env.EMAIL_FROM_NAME || 'Axon Med Academy';

  const { data, error } = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }

  return { id: data?.id || 'sent', provider: 'Resend' };
}

// ─── Provider: Nodemailer (SMTP) Fallback ────────────────────────────────────

async function sendViaNodemailer({ to, toName, subject, html, fromEmail, fromName }) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error('Nodemailer SMTP credentials (EMAIL_USER / EMAIL_PASS) not configured');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
  });

  const senderEmail = fromEmail || process.env.EMAIL_FROM || user;
  const senderName = fromName || process.env.EMAIL_FROM_NAME || 'Axon Med Academy';

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    html,
  });

  return { id: info.messageId, provider: 'Nodemailer (SMTP)' };
}

// ─── Universal Dispatcher with Automatic Fallbacks ────────────────────────────

async function dispatchEmail({ to, toName, subject, html, fromEmail, fromName }) {
  const errors = [];

  // 1. Primary: Brevo (300 free emails/day)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await sendViaBrevo({ to, toName, subject, html, fromEmail, fromName });
      console.log(`[Email] ✅ Sent via ${res.provider} to ${to} (ID: ${res.id})`);
      return res;
    } catch (err) {
      console.warn(`[Email Warning] Brevo failed for ${to} (${err.message}). Trying fallback...`);
      errors.push(`Brevo: ${err.message}`);
    }
  }

  // 2. Fallback 1: Resend (100 free emails/day)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await sendViaResend({ to, subject, html, fromEmail, fromName });
      console.log(`[Email] ✅ Sent via ${res.provider} to ${to} (ID: ${res.id})`);
      return res;
    } catch (err) {
      console.warn(`[Email Warning] Resend failed for ${to} (${err.message}). Trying fallback...`);
      errors.push(`Resend: ${err.message}`);
    }
  }

  // 3. Fallback 2: Nodemailer (SMTP)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const res = await sendViaNodemailer({ to, toName, subject, html, fromEmail, fromName });
      console.log(`[Email] ✅ Sent via ${res.provider} to ${to} (ID: ${res.id})`);
      return res;
    } catch (err) {
      console.warn(`[Email Warning] Nodemailer failed for ${to}: ${err.message}`);
      errors.push(`Nodemailer: ${err.message}`);
    }
  }

  const combinedError = errors.length > 0
    ? `All email services failed: [${errors.join(' | ')}]`
    : 'No email service configured. Please add BREVO_API_KEY or RESEND_API_KEY in environment variables.';
  console.error(`[Email Error] ❌ ${combinedError}`);
  throw new Error(combinedError);
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

exports.sendWelcomeEmail = async (user, password) => {
  const portalUrl = getPortalUrl();
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1A0F33 0%, #4C1D95 100%); color: #fff; padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Axon Med Academy</h1>
        <p style="margin: 8px 0 0 0; color: #c4b5fd; font-size: 14px;">Your learning journey starts now 🚀</p>
      </div>

      <!-- Body -->
      <div style="padding: 32px 28px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
        <p>You have been successfully registered as a student at <strong>Axon Med Academy</strong>. Your account is ready to access.</p>

        <!-- Credentials Box -->
        <div style="background: #f8f5ff; border: 1px solid #e9d5ff; border-left: 4px solid #7C3AED; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 700; color: #4C1D95; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">🔐 Your Login Credentials</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 100px;">Portal URL</td>
              <td style="padding: 6px 0;"><a href="${portalUrl}" style="color: #7C3AED; font-weight: 600;">${portalUrl}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">User ID</td>
              <td style="padding: 6px 0; font-weight: 600; font-family: monospace; font-size: 15px; color: #1A0F33;">${user.userId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Email</td>
              <td style="padding: 6px 0; font-weight: 600;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Password</td>
              <td style="padding: 6px 0; font-weight: 600; font-family: monospace; font-size: 15px; color: #1A0F33;">${password}</td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background: linear-gradient(135deg, #7C3AED, #4C1D95); color: #fff; text-decoration: none; padding: 14px 36px; font-weight: 700; border-radius: 50px; display: inline-block; font-size: 15px; box-shadow: 0 4px 14px rgba(124,58,237,0.4);">
            Login to Portal →
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">On the portal you can:</p>
        <ul style="font-size: 14px; color: #6b7280; padding-left: 20px; margin: 0 0 16px;">
          <li>Attend live classes and review recordings</li>
          <li>Take quizzes and track your progress</li>
          <li>Download certificates after course completion</li>
          <li>Communicate with faculty and admins</li>
        </ul>

        <p style="margin-bottom: 0;">Best Regards,<br><strong>Axon Med Academy Admin Team</strong></p>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        © ${new Date().getFullYear()} Axon Med Academy. All rights reserved.<br>
        If you did not expect this email, please contact <a href="mailto:${fromEmail}" style="color: #7C3AED;">${fromEmail}</a>.
      </div>
    </div>
  `;

  return dispatchEmail({
    to: user.email,
    toName: user.fullName,
    subject: '🎓 Welcome to Axon Med Academy — Your Login Credentials',
    html,
  });
};

// ─── Faculty Welcome Email ────────────────────────────────────────────────────

exports.sendFacultyWelcomeEmail = async (user, password) => {
  const portalUrl = getPortalUrl();
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #1A0F33 0%, #4C1D95 100%); color: #fff; padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700;">Axon Med Academy</h1>
        <p style="margin: 8px 0 0 0; color: #c4b5fd; font-size: 14px;">Your faculty portal access is ready</p>
      </div>

      <div style="padding: 32px 28px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
        <p>You have been registered as a faculty member at <strong>Axon Med Academy</strong>. You can now log in to manage classes and student learning activities.</p>

        <div style="background: #f8f5ff; border: 1px solid #e9d5ff; border-left: 4px solid #7C3AED; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 700; color: #4C1D95; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Credentials</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 100px;">Portal URL</td>
              <td style="padding: 6px 0;"><a href="${portalUrl}" style="color: #7C3AED; font-weight: 600;">${portalUrl}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Email</td>
              <td style="padding: 6px 0; font-weight: 600;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Password</td>
              <td style="padding: 6px 0; font-weight: 600; font-family: monospace; font-size: 15px; color: #1A0F33;">${password}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background: linear-gradient(135deg, #7C3AED, #4C1D95); color: #fff; text-decoration: none; padding: 14px 36px; font-weight: 700; border-radius: 50px; display: inline-block; font-size: 15px; box-shadow: 0 4px 14px rgba(124,58,237,0.4);">
            Login to Portal
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">On the portal you can manage classrooms, live sessions, recordings, quizzes, and student progress.</p>

        <p style="margin-bottom: 0;">Best Regards,<br><strong>Axon Med Academy Admin Team</strong></p>
      </div>

      <div style="background: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        &copy; ${new Date().getFullYear()} Axon Med Academy. All rights reserved.<br>
        If you did not expect this email, please contact <a href="mailto:${fromEmail}" style="color: #7C3AED;">${fromEmail}</a>.
      </div>
    </div>
  `;

  return dispatchEmail({
    to: user.email,
    toName: user.fullName,
    subject: 'Welcome to Axon Med Academy - Faculty Login Credentials',
    html,
  });
};

// ─── Account Approved Email ──────────────────────────────────────────────────

exports.sendApprovalEmail = async (user) => {
  const portalUrl = getPortalUrl();
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Account Approved</h1>
        <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 14px;">Welcome aboard! Your portal access is active. 🌟</p>
      </div>

      <!-- Body -->
      <div style="padding: 32px 28px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
        <p>We are excited to let you know that your registration request at <strong>Axon Med Academy</strong> has been reviewed and approved by our admissions team!</p>
        <p>Your account is now fully active, and you can access all features on our learning portal.</p>

        <!-- Account Details Box -->
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10B981; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; font-weight: 700; color: #065f46; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">🔑 Access Details</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #4b5563; font-size: 13px; width: 100px;">Portal URL</td>
              <td style="padding: 6px 0;"><a href="${portalUrl}" style="color: #059669; font-weight: 600;">${portalUrl}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #4b5563; font-size: 13px;">User ID</td>
              <td style="padding: 6px 0; font-weight: 600; font-family: monospace; font-size: 15px; color: #065f46;">${user.userId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #4b5563; font-size: 13px;">Login Email</td>
              <td style="padding: 6px 0; font-weight: 600;">${user.email}</td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: #fff; text-decoration: none; padding: 14px 36px; font-weight: 700; border-radius: 50px; display: inline-block; font-size: 15px; box-shadow: 0 4px 14px rgba(10,185,129,0.4);">
            Login to Portal →
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">On the portal you can:</p>
        <ul style="font-size: 14px; color: #6b7280; padding-left: 20px; margin: 0 0 16px;">
          <li>Attend live classes and review recordings</li>
          <li>Take quizzes and track your progress</li>
          <li>Download certificates after course completion</li>
          <li>Communicate with faculty and admins</li>
        </ul>

        <p style="margin-bottom: 0;">Best Regards,<br><strong>Axon Med Academy Admin Team</strong></p>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        © ${new Date().getFullYear()} Axon Med Academy. All rights reserved.<br>
        If you did not expect this email, please contact <a href="mailto:${fromEmail}" style="color: #10B981;">${fromEmail}</a>.
      </div>
    </div>
  `;

  return dispatchEmail({
    to: user.email,
    toName: user.fullName,
    subject: '🎉 Your Axon Med Academy Account Has Been Approved!',
    html,
  });
};

// ─── Meeting Scheduled Email ──────────────────────────────────────────────────

exports.sendMeetingScheduledEmail = async (student, meeting, classroomName) => {
  const clientUrl = getPortalUrl();

  const formattedTime = new Date(meeting.scheduledAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #1A0F33 0%, #4C1D95 100%); color: #fff; padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700;">New Live Class Scheduled</h1>
        <p style="margin: 6px 0 0 0; color: #c4b5fd; font-size: 14px;">${classroomName}</p>
      </div>
      <div style="padding: 32px 28px;">
        <p style="margin-top: 0;">Dear <strong>${student.fullName || 'Student'}</strong>,</p>
        <p>A new live class has been scheduled for your classroom <strong>${classroomName}</strong>.</p>

        <div style="background: #f8f5ff; border: 1px solid #e9d5ff; border-left: 4px solid #7C3AED; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 120px; color: #4C1D95; font-size: 13px;">Topic</td>
              <td style="padding: 6px 0; font-weight: 700; color: #1A0F33;">${meeting.title}</td>
            </tr>
            ${meeting.description ? `
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4C1D95; font-size: 13px;">Description</td>
              <td style="padding: 6px 0; color: #374151;">${meeting.description}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4C1D95; font-size: 13px;">Time</td>
              <td style="padding: 6px 0; font-weight: 700; color: #7C3AED;">${formattedTime} (IST)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #4C1D95; font-size: 13px;">Duration</td>
              <td style="padding: 6px 0;">${meeting.duration} minutes</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${clientUrl}/student/live" style="background: linear-gradient(135deg, #84CC16, #65a30d); color: #1A0F33; text-decoration: none; padding: 14px 36px; font-weight: 700; border-radius: 50px; display: inline-block; font-size: 15px; box-shadow: 0 4px 14px rgba(132,204,22,0.4);">
            View Schedule
          </a>
        </div>
      </div>
      <div style="background: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        © ${new Date().getFullYear()} Axon Med Academy. All rights reserved.
      </div>
    </div>
  `;

  return dispatchEmail({
    to: student.email,
    toName: student.fullName,
    subject: `📅 Live Class Scheduled: ${meeting.title}`,
    html,
  });
};

// ─── Password Reset Email ────────────────────────────────────────────────────

exports.sendPasswordResetEmail = async (user, otp) => {
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1A0F33 0%, #4C1D95 100%); color: #fff; padding: 32px 28px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Axon Med Academy</h1>
        <p style="margin: 8px 0 0 0; color: #c4b5fd; font-size: 14px;">Password Reset Request 🔑</p>
      </div>

      <!-- Body -->
      <div style="padding: 32px 28px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
        <p>We received a request to reset the password for your Axon Med Academy account.</p>
        <p>Please use the following 6-digit verification code to reset your password. This code will expire in 10 minutes.</p>

        <!-- OTP Box -->
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #7C3AED; border: 2px dashed #7C3AED; border-radius: 8px; padding: 12px 24px; background: #f8f5ff; font-family: monospace;">
            ${otp}
          </div>
        </div>

        <p style="font-size: 14px; color: #6b7280;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>

        <p style="margin-bottom: 0;">Best Regards,<br><strong>Axon Med Academy Support Team</strong></p>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        © ${new Date().getFullYear()} Axon Med Academy. All rights reserved.<br>
        If you did not expect this email, please contact <a href="mailto:${fromEmail}" style="color: #7C3AED;">${fromEmail}</a>.
      </div>
    </div>
  `;

  return dispatchEmail({
    to: user.email,
    toName: user.fullName,
    subject: '🔒 Reset Your Axon Med Academy Password',
    html,
  });
};
