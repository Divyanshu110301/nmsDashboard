# C++ Free Functions Review Dashboard (Supabase)

This is a static GitHub Pages frontend with Supabase Auth + Postgres. The dashboard has been adapted from the supplied `index.html` and retains its core fields, filters, metrics, status updates, edit/delete, and JSON/CSV exports.

## Security and company-data warning

The original file contains employee names, function signatures, and review observations. These may be company-confidential. **Do not create a personal Supabase project or upload the seed records unless your company has approved Supabase and this data classification.** A free tier is not a security or compliance approval. Use dummy data until approval if needed.

Security controls in this prototype:

- Email/password login through Supabase Auth. No public sign-up UI.
- Database allowlist: only enabled email addresses in `dashboard_allowed_users` can access records.
- Row Level Security (RLS) on both tables.
- Anonymous access revoked from the data tables.
- Browser uses only the Supabase **publishable key**. It does not use a secret/service-role key.
- Optimistic concurrency check on edits/status changes using `updated_at`.
- Realtime notifications plus a 15-second polling fallback.

The publishable key and project URL are public client configuration, not secrets. RLS and the allowlist are the actual data access controls. Never put a Supabase secret key, legacy `service_role` key, database password, or personal access token in `config.js` or any frontend file.

## Files

- `index.html` - dashboard and login UI
- `styles.css` - styling
- `app.js` - Supabase Auth, database CRUD, filtering, exports, realtime/polling
- `config.js` - project URL + publishable key placeholders only
- `supabase/setup.sql` - tables, grants, RLS policies, and allowlist function (schema only; no company records)

## Setup

### 0. Get company approval first

Before using real records, confirm that your organization permits storing this data in Supabase's hosted cloud, including its region, retention, access, and account ownership. If not approved, do not run the seed section or upload real data. Ask IT for an approved backend instead.

### 1. Create a Supabase project

1. Sign in to Supabase and create a project. The Free plan may be sufficient for a small prototype, but review current limits and inactivity pausing before relying on it.
2. Choose a region only after checking company policy/data residency requirements.
3. Open **SQL Editor** and run `supabase/setup.sql` as the project owner.
4. The initial records from your supplied HTML are provided separately as `seed-initial-data-private.sql`. Keep that file outside the Git repository. Run it in SQL Editor only after company approval. Do not add it to GitHub.
4. In **Authentication → Providers → Email**, keep email/password enabled. Disable public sign-ups if the setting is available for your project. Do not let users self-register into the dashboard.

### 2. Provision users

For each team member:

1. In Supabase **Authentication → Users**, use the dashboard's invite/create-user flow to provision their company email. Do not share passwords.
2. After the user exists, run this SQL in SQL Editor, replacing the example address:

```sql
insert into public.dashboard_allowed_users (email, enabled)
values ('person@company.example', true)
on conflict (email) do update set enabled = excluded.enabled;
```

3. Repeat for each approved teammate. To revoke access:

```sql
update public.dashboard_allowed_users
set enabled = false
where email = 'person@company.example';
```

Do not give ordinary users access to the Supabase project dashboard or SQL Editor. They should only receive the app URL and their own login credentials.

### 3. Configure the frontend

1. In Supabase, open **Project Settings → API Keys** (or the project's Connect/API panel).
2. Copy the **Project URL** and the **Publishable key** (`sb_publishable_...`). The older `anon` key also works, but prefer the publishable key for new projects.
3. Edit `config.js`:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "sb_publishable_..."
};
```

This key is intended for browser use. Never copy a Secret key (`sb_secret_...`) or `service_role` key into this file.

### 4. Test before sharing

Use two separate browser profiles (or two approved test accounts):

1. Sign in as allowlisted User A and add a clearly non-confidential test record.
2. Sign in as allowlisted User B and verify the record appears.
3. Change its status in User B and verify it appears in User A within a few seconds (or at most the 15-second fallback interval).
4. Try a non-allowlisted account. It must not be able to read or change any records.
5. Sign out and verify the login screen returns.
6. Verify edit conflicts show a warning instead of silently overwriting a newer update.

Do not proceed to real records until the unauthorized-user test passes.

### 5. Deploy to GitHub Pages

1. Put `index.html`, `styles.css`, `app.js`, and `config.js` in the repository root (or update the Pages source folder accordingly).
2. Commit and push. Enable GitHub Pages for the intended branch/folder.
3. Share the Pages URL only with users authorized by company policy. **GitHub Pages is public static hosting by default**, even if the source repository is private. Login protects database reads/writes, not the visibility of frontend source or the site URL.
4. Consider a company-approved private hosting option if the page itself must be inaccessible to the public.

## Keep data out of GitHub

The schema migration contains no employee/function records. The separate private seed SQL contains the five records from the supplied HTML. Keep it outside the repository and do not commit it. GitHub Pages serves frontend files publicly by default, and a private source repository does not make the published site private.

## Operational notes / limitations

- This prototype lets every allowlisted user add, edit, change status, and delete shared records. There are no separate admin/editor roles yet.
- Realtime depends on the `supabase_realtime` publication. The SQL attempts to add the table. Polling every 15 seconds remains as a fallback.
- Free Supabase projects can be paused after inactivity and have quotas/limits. Check the current pricing/plan page before using it for team operations.
- The app depends on the Supabase JavaScript CDN and Supabase hosted service, so internet access and company endpoint/security policy must permit them.
- No formal security review, penetration test, SSO, audit log, automated backup, or SLA is included. This is a prototype, not a company-approved production deployment.
- Do not use this as the only copy of review data. Export JSON/CSV periodically, subject to company policy.

## Troubleshooting

- **Invalid login credentials:** verify the Auth user exists, has completed any required email confirmation, and is using the right password.
- **Login works but data query fails/returns no rows:** verify the exact lowercase email is in `dashboard_allowed_users` with `enabled = true`; inspect SQL policies and table grants.
- **Realtime does not update:** confirm `review_functions` is in `supabase_realtime`; the 15-second refresh should still update the table.
- **Failed to fetch:** verify Project URL, publishable key, internet access, and any company proxy restrictions.
- **Permission denied:** do not weaken RLS to fix it. Check the allowlist, grants, and policies.

## References

- Supabase Auth password login: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Supabase secure data: https://supabase.com/docs/guides/database/secure-data
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase pricing: https://supabase.com/pricing
