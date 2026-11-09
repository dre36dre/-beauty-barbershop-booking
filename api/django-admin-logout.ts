import { withErrors } from './_lib/core';

export default withErrors(async (request) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const secure = process.env.VERCEL || new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/django-admin/',
      'Set-Cookie': `admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
      'Cache-Control': 'no-store',
    },
  });
});
