// Future deployment only. No deployment was performed during local implementation.
// Cloudflare Cron: "0 0 * * *" = 09:00 Asia/Seoul. Secrets: APP_URL, CRON_SECRET.
export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      const response = await fetch(new URL('/api/jobs/reminders', env.APP_URL), {
        method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      if (!response.ok) throw new Error(`Reminder delivery failed: HTTP ${response.status}`);
    })());
  },
};
