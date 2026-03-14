# Hosting Guide: Ledger Sub 7 on Railway

## Context

The project was designed from the start for Railway deployment (ADR-008): two separate services — one Node.js (frontend SSR), one Python (FastAPI backend) — plus Railway's managed PostgreSQL. Both services have Dockerfiles already written and ready to use.

This plan covers: prerequisites, the one compatibility issue to resolve first, step-by-step setup, and references.

---

## ⚠️ Compatibility Issue: Railway Subdomains + SameSite=Lax Cookies

This is a real blocker that must be understood before deploying.

**The problem:** By default Railway gives each service a subdomain like `frontend.up.railway.app` and `api.up.railway.app`. The `up.railway.app` domain is on the [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat), which means browsers treat each subdomain as a completely separate registrable domain — like `google.com` and `microsoft.com` are separate. The auth cookie set by the backend will NOT be sent back by the browser when the frontend SSR loader calls the API, breaking authentication entirely.

**Two solutions:**

|                          | Option A: Custom Domains (Recommended)                                     | Option B: Stay on Railway Subdomains                  |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| **How**                  | Point e.g. `app.yourdomain.com` → frontend, `api.yourdomain.com` → backend | Use Railway's default `*.up.railway.app` domains      |
| **Cookie change needed** | No — current `SameSite=Lax` works fine                                     | Yes — must change to `SameSite=None` in auth.py       |
| **Cost**                 | ~$10–15/year for a domain                                                  | Free                                                  |
| **Tradeoff**             | Clean URLs, no code change needed                                          | Slight security trade-off (`SameSite=None` is weaker) |

The current code is already written for Option A. Option B requires a small code change in `backend/app/routers/auth.py`.

**Recommendation: Option A (custom domains).** The code already supports it, and `SameSite=Lax` is meaningfully better for security.

---

## Prerequisites

- [ ] [Railway account](https://railway.app) (free tier is fine to start)
- [ ] A Google Cloud project with OAuth 2.0 credentials ([console.cloud.google.com](https://console.cloud.google.com))
- [ ] A domain name (if using Option A — recommended)
- [ ] Git repository accessible to Railway (GitHub/GitLab)

---

## Step 1: Create the Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Empty Project**

You'll add three services: PostgreSQL, backend, frontend.

---

## Step 2: Add PostgreSQL

1. In your project → **Add Service** → **Database** → **PostgreSQL**
2. Railway provisions a PostgreSQL 16 instance and automatically sets `DATABASE_URL` in its environment
3. Note the `DATABASE_URL` value — you'll need it to run migrations manually once

Railway docs: [railway.app/docs/databases/postgresql](https://docs.railway.app/databases/postgresql)

---

## Step 3: Deploy the Backend

1. **Add Service** → **GitHub Repo** → select your repository
2. Set the **Root Directory** to `backend/`
3. Railway will detect the `Dockerfile` automatically and use it
4. Set these environment variables on the backend service:

```
DATABASE_URL=          # auto-set by Railway if you link the Postgres service
GOOGLE_CLIENT_ID=      # from Google Cloud Console
GOOGLE_CLIENT_SECRET=  # from Google Cloud Console
GOOGLE_REDIRECT_URI=   # https://api.yourdomain.com/api/v1/auth/callback
JWT_SECRET=            # generate with: openssl rand -hex 32
JWT_EXPIRE_DAYS=14
FRONTEND_URL=          # https://app.yourdomain.com
ENVIRONMENT=production
```

To generate JWT_SECRET locally:

```bash
openssl rand -hex 32
```

Railway docs: [railway.app/docs/deploy/deployments](https://docs.railway.app/deploy/deployments)

---

## Step 4: Run Migrations

After the backend service is deployed and the database is up, run the initial migration via Railway's shell:

1. In Railway dashboard → backend service → **Shell** tab
2. Run:

```bash
alembic upgrade head
```

This must be done before the app handles any requests.

Railway shell docs: [railway.app/docs/guides/cli](https://docs.railway.app/guides/cli) (can also use the Railway CLI locally: `railway run alembic upgrade head`)

---

## Step 5: Deploy the Frontend

1. **Add Service** → **GitHub Repo** → same repository
2. Set the **Root Directory** to `frontend/`
3. Railway will detect the `Dockerfile` automatically
4. Set these environment variables:

```
BACKEND_URL=https://api.yourdomain.com
```

---

## Step 6: Add Custom Domains (Option A)

For each service in Railway:

1. Go to service → **Settings** → **Networking** → **Custom Domain**
2. Add your domain (e.g. `app.yourdomain.com` for frontend, `api.yourdomain.com` for backend)
3. Railway shows you a CNAME record to add in your DNS provider
4. Add the CNAME in your domain registrar's DNS settings
5. Railway auto-provisions TLS (Let's Encrypt)

Then update the backend environment variable:

```
FRONTEND_URL=https://app.yourdomain.com
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/v1/auth/callback
```

Railway docs: [railway.app/docs/deploy/exposing-your-app#custom-domains](https://docs.railway.app/deploy/exposing-your-app#custom-domains)

---

## Step 6 (Alternative): Option B — No Custom Domains

If skipping custom domains, you need a small code change in `backend/app/routers/auth.py`. The `_set_auth_cookie()` function must use `samesite="none"` instead of `samesite="lax"` for the `access_token` and `oauth_state` cookies. `SameSite=None` requires `Secure=True` (already set in production). This would be a separate task/plan.

---

## Step 7: Configure Google OAuth

In [Google Cloud Console](https://console.cloud.google.com):

1. APIs & Services → Credentials → your OAuth 2.0 Client ID → **Edit**
2. Under **Authorized redirect URIs**, add:
   ```
   https://api.yourdomain.com/api/v1/auth/callback
   ```
3. Under **Authorized JavaScript origins**, add:
   ```
   https://app.yourdomain.com
   ```

Google OAuth docs: [developers.google.com/identity/protocols/oauth2/web-server](https://developers.google.com/identity/protocols/oauth2/web-server)

---

## Step 8: Verify

1. Visit `https://app.yourdomain.com` — should load the login screen
2. Click "Sign in with Google" — should complete OAuth and land on the home screen
3. Check `https://api.yourdomain.com/docs` — FastAPI OpenAPI UI should be accessible
4. Check `https://api.yourdomain.com/api/v1/health` — should return `{"status": "ok"}`

---

## Reference Links

| Topic                         | Link                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| Railway getting started       | https://docs.railway.app/getting-started                           |
| Railway PostgreSQL            | https://docs.railway.app/databases/postgresql                      |
| Railway custom domains        | https://docs.railway.app/deploy/exposing-your-app                  |
| Railway environment variables | https://docs.railway.app/develop/variables                         |
| Railway CLI                   | https://docs.railway.app/guides/cli                                |
| React Router v7 deployment    | https://reactrouter.com/start/framework/deploying                  |
| FastAPI deployment            | https://fastapi.tiangolo.com/deployment/docker/                    |
| Alembic migrations            | https://alembic.sqlalchemy.org/en/latest/tutorial.html             |
| Google OAuth web server       | https://developers.google.com/identity/protocols/oauth2/web-server |
| Public Suffix List (context)  | https://publicsuffix.org                                           |

---

## Notes

- The `PLANNING.md` file has an incorrect mention of `Authorization: Bearer` header auth at line 266. The actual implementation uses httpOnly cookies only. This doesn't affect deployment but is misleading — worth correcting.
- Railway auto-deploys on every push to your configured branch. You'll want to run `alembic upgrade head` manually after any migration-adding commits (Railway doesn't run it automatically).
- There's no CI/CD pipeline yet. Running tests before deploy is currently a manual step.
