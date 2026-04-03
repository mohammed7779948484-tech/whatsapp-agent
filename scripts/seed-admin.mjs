#!/usr/bin/env node

const appUrl = process.env.APP_URL || 'http://localhost:3000';
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment variables.');
  process.exit(1);
}

if (adminPassword.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters long.');
  process.exit(1);
}

const endpoint = new URL('/api/users/first-register', appUrl);

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : 'Unknown error';
    console.error(`Failed to seed admin user: ${String(message)}`);
    process.exit(1);
  }

  console.log(`Admin user ready: ${adminEmail}`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Unable to reach ${endpoint.toString()}: ${message}`);
  process.exit(1);
}
