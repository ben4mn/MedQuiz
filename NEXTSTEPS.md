# Next Steps

Things to do after the V2 (persistence + auth) push. Roughly in order of importance.

## 1. Email delivery (blocker for real users)

Right now magic links print to the server log instead of sending an email. Fine for Ben because he has terminal access; useless for anyone else.

### Option A — use Resend's shared domain (fastest)

1. Sign up at https://resend.com (free tier: 3,000 emails/month, 100/day)
2. Create an API key in the dashboard
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_...
   ```
4. Leave `RESEND_FROM` on the default `MedQuiz <onboarding@resend.dev>`
5. Rebuild and restart: `npm run build && npm run start`

Tradeoff: emails from `onboarding@resend.dev` sometimes land in spam/promotions — especially on Gmail and corporate inboxes. Workable for personal use; not great for a classroom.

### Option B — verify `4mn.org` in Resend (5 min, better deliverability)

1. In Resend → Domains → Add Domain → `4mn.org`
2. Resend gives you 3 DNS records (one TXT for SPF, one CNAME for DKIM, one MX for return-path)
3. Add them via Cloudflare (the PAT we already have has zone edit permissions on `4mn.org`)
4. Click "Verify" in Resend — takes about 60 seconds after DNS propagates
5. Update `.env.local`:
   ```
   RESEND_API_KEY=re_...
   RESEND_FROM=MedQuiz <no-reply@4mn.org>
   ```

After this, emails arrive in the inbox reliably, on any provider.

## 2. Rotate the credentials that were pasted into chat

All of these landed in the conversation log and should be assumed compromised:

- **Anthropic API key** — rotate at https://console.anthropic.com/settings/keys
- **ElevenLabs API key** — rotate at https://elevenlabs.io/app/settings/api-keys
- **GitHub PAT** (starts with `ghp_U14w4...`) — revoke at https://github.com/settings/tokens
- **Cloudflare PAT** (starts with `X-bHJdtoT...`) — revoke at https://dash.cloudflare.com/profile/api-tokens

For each: generate a fresh one, paste into `.env.local` (or your shell env for the CF/GH tokens), restart the app if applicable.

The `SESSION_SECRET` in `.env.local` was generated locally and never pasted — safe to keep. But if you want to rotate it, run `openssl rand -hex 32` and replace the value. All users will be logged out on restart.

## 3. Add more users (when you're ready)

V2 is whitelist-only — only emails in `ALLOWED_EMAILS` can log in. To add her:

```
ALLOWED_EMAILS=ben4mn@gmail.com,her.email@example.com
```

Comma-separated, no spaces. Restart the server after editing.

## 4. Durability of the tunnel setup

The current stack runs locally on your Mac and is exposed via a Cloudflare named tunnel at `tat.4mn.org`. If:

- **Your Mac sleeps** — the tunnel reports "up" but actual requests time out. Set "Prevent sleep" in `caffeinate` or System Settings → Battery.
- **Your Mac reboots** — both the prod server and `cloudflared` need to restart. The SQLite DB persists (at `data/medquiz.db`), so no data is lost, but the app is down until you re-run `npm run start` and `cloudflared tunnel run ...`.

### Quick fix: launchd agents

Write two `~/Library/LaunchAgents/` plist files — one that runs `npm run start` in the medquiz directory, one that runs `cloudflared tunnel run b9d96adf-6593-4d1f-ac76-d6e47ba56a33`. Both start automatically on login and restart on crash.

### Better fix: move off your Mac

When she relies on this for actual studying, a dead Mac = a dead app. Options:

- **Fly.io** or **Railway** for the Next.js app (free tier covers this easily). SQLite file sits on the instance — fine for single-user.
- **Turso** if you want SQLite-compatible but properly hosted and replicated.
- **Supabase** if you'd rather swap SQLite for Postgres + use their managed auth instead of our magic link.

Each requires reworking the DB path and the `NODE_EXTRA_CA_CERTS` workaround (which only matters on your Mac — cloud Linux boxes have Anthropic's roots in their CA bundle).

## 5. Backup the SQLite database

Once she has real quiz history, losing the DB means losing her study profile. Options:

- **Manual snapshot**: `cp data/medquiz.db data/medquiz.backup.$(date +%Y-%m-%d).db`
- **Automated**: a cron job to run `sqlite3 data/medquiz.db ".backup data/medquiz.backup.db"` nightly and rsync to an iCloud Drive folder
- **Litestream**: real-time SQLite replication to S3 or any S3-compatible bucket. Roughly 15 min of setup; survives Mac failures entirely

## 6. Feature ideas worth considering

These came out of the brainstorm but aren't in V2 yet:

- **Spaced repetition scheduling** — surface questions she's weakest on AND hasn't seen recently, using a simple SM-2 algorithm or just a cold-start heuristic
- **Self-graded recall questions** — right now the text quiz marks "recall" questions correct if she writes more than 3 words; that's lenient. Let her click "I got it" / "I missed it" after revealing the expected points, and use that for mastery
- **Per-chapter progress** — the library could show a progress bar per document: "You've answered 23 of 40 questions, 78% correct"
- **Voice session export** — let her download a PDF of the transcript + struggles after a voice session, so she can review them offline
- **Weekly digest email** — Monday morning email summarizing what she studied last week, which topics are weakest, and a suggested focus for the coming week

## 7. Minor hygiene

- **`NEXTSTEPS.md`** (this file) should be deleted or moved to a `docs/` folder once done — it shouldn't live at the repo root forever
- **`AGENTS.md`** (from the create-next-app scaffold) is harmless but serves no purpose anymore; delete when convenient
- **`CLAUDE.md`** (also scaffold) — same
- **Marketing page at `docs/index.html`** still references the old V1 flow ("Paste a chapter") — works, but doesn't mention the library/profile/mastery features. Refresh when there's a spare hour

## 8. What V2 doesn't do yet

Worth calling out explicitly so there's no confusion:

- **No password reset or account recovery** — magic link only. If email is broken, she's locked out (you'd need to delete her row in `users` + `sessions` manually)
- **No rate limiting on `/api/auth/request`** — someone could spam magic link requests. Low risk since we only send to allowlist, but worth adding if the app ever opens up
- **No CSRF protection on state-changing routes** — relies on `SameSite=Lax` cookies. Good enough for a personal app; not good enough for anything shared

Nothing in this list is urgent. Priority order is 1 → 2 → 3, the rest when it matters.
