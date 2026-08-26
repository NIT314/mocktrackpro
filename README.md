# Mock Tracker

Personal SSC **CGL / CHSL** tracker. Bottom tabs: Home · Full · Section · Quiz. Each tab shows only that type’s data and analysis.

## Run on phone (PWA)

On this PC:

```bash
cd C:\Users\Gupta\Projects\mock-tracker
python -m http.server 4173
```

Phone and PC same Wi‑Fi. Browser: `http://YOUR-PC-IP:4173`  
Chrome/Brave menu → **Add to Home screen**. HTTPS is needed for some install prompts; GitHub Pages / Netlify / Cloudflare Pages pe deploy karo for a proper Android install banner.

Without Supabase the app still works (**local mode**, data on that device).

## Supabase (optional)

1. New project → SQL Editor → run `sql/schema.sql`
2. Authentication → Email enabled
3. App → Settings → paste **Project URL** and **anon key**
4. Create account / sign in

Anon key is public; **RLS** keeps rows private to your login.
