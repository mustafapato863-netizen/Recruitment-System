/**
 * P1 workflow notification integration checks.
 *
 * Proves that an interview workflow event creates a tenant-scoped in-app
 * notification and an email outbox row only when the recipient has enabled
 * the relevant preferences. The created interview and all test records are
 * removed before exit.
 */

const http = require('http');
const { PrismaClient } = require('./generated/client');

const API_PORT = Number(process.env.P1_API_PORT || 3000);
const prisma = new PrismaClient();

function request(options, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = { ...(options.headers || {}) };
    if (payload) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  const response = await request({
    hostname: 'localhost', port: API_PORT, path: '/api/v1/auth/login', method: 'POST',
  }, { email, password });
  const cookies = (response.headers['set-cookie'] || []).map((cookie) => cookie.split(';')[0]).join('; ');
  return { response, cookie: cookies };
}

async function main() {
  const admin = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  if (admin.response.status !== 200) throw new Error(`Admin login failed: ${admin.response.status}`);

  const user = await prisma.user.findFirst({ where: { emailNormalized: 'ahmed.mahmoud@recruitflow.local' } });
  if (!user) throw new Error('Seeded admin is unavailable');
  const application = await prisma.application.findFirst({
    where: { organizationId: user.organizationId },
    select: { id: true },
  });
  if (!application) throw new Error('Seeded application is unavailable');

  const originalPreferences = {
    emailNotifications: user.emailNotifications,
    interviewReminders: user.interviewReminders,
    inAppNotifications: user.inAppNotifications,
  };
  let interviewId;
  let notificationId;
  let emailId;
  try {
    const preferenceResponse = await request({
      hostname: 'localhost', port: API_PORT, path: '/api/v1/me/preferences', method: 'PATCH',
      headers: { Cookie: admin.cookie },
    }, { emailNotifications: true, interviewReminders: true, inAppNotifications: true });
    if (preferenceResponse.status !== 200) throw new Error(`Could not enable test preferences: ${preferenceResponse.status}`);

    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 45 * 60 * 1000);
    const interviewResponse = await request({
      hostname: 'localhost', port: API_PORT, path: '/api/v1/interviews', method: 'POST',
      headers: { Cookie: admin.cookie },
    }, {
      applicationId: application.id,
      title: 'P1 notification integration check',
      interviewType: 'Technical',
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
      timezone: 'Africa/Cairo',
      attendeeUserIds: [user.id],
    });
    if (![200, 201].includes(interviewResponse.status) || !interviewResponse.body?.id) {
      throw new Error(`Interview creation failed: ${interviewResponse.status} ${JSON.stringify(interviewResponse.body)}`);
    }
    interviewId = interviewResponse.body.id;

    const notification = await prisma.notification.findFirst({
      where: { organizationId: user.organizationId, recipientUserId: user.id, type: 'InterviewScheduled', entityId: interviewId },
      orderBy: { createdAt: 'desc' },
    });
    if (!notification) throw new Error('Interview did not create an in-app notification');
    notificationId = notification.id;

    const email = await prisma.emailOutbox.findFirst({
      where: { organizationId: user.organizationId, toEmail: user.email, template: 'notification', status: 'Pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (!email || email.subject !== notification.title || email.payload?.message !== notification.message) {
      throw new Error('Interview notification did not create a matching email outbox row');
    }
    emailId = email.id;
    console.log('P1 workflow notification checks: 5/5 PASS');
  } finally {
    if (emailId) await prisma.emailOutbox.deleteMany({ where: { id: emailId } });
    if (notificationId) await prisma.notification.deleteMany({ where: { id: notificationId } });
    if (interviewId) await prisma.interview.deleteMany({ where: { id: interviewId } });
    await prisma.user.update({ where: { id: user.id }, data: originalPreferences });
  }
}

main()
  .catch((error) => {
    console.error(`P1 workflow notification checks FAILED: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
