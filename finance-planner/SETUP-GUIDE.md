# Setup guide (no coding needed)

You will create three free accounts and copy a few values between them. Take it one step at a time. Keep a notes file open to paste values into.

## Part 1: Supabase (the database)
1. Go to supabase.com and sign up (using your Google account is fine).
2. Click **New project**. Name it `finance-planner`. Choose a strong database password and save it in your notes. Pick the region closest to India (Mumbai if offered). Click **Create**. Wait about 2 minutes.
3. Left menu > **SQL Editor** > **New query**. Open the file `finance-planner/supabase/migrations/0001_init.sql` on GitHub, copy everything, paste it into Supabase and click **Run**. It should say "Success".
4. Do the same with `0002_goal_contribution.sql`.
5. Do the same with `supabase/seed.sql`. If you want a different admin email, edit it before running.
6. Left menu > **Project Settings** (gear) > **API**. Copy these into your notes: **Project URL**, **anon public key**, **service_role key**. Keep the service_role key private. Never post it anywhere.

## Part 2: Google sign-in
1. Go to console.cloud.google.com and sign in with your Google account.
2. Top bar > project picker > **New project**. Name it `finance-planner` and create it.
3. Menu > **APIs & Services** > **OAuth consent screen**. Choose **External**. Fill in the app name, your email as support email and developer email. Save through the screens.
4. Menu > **APIs & Services** > **Credentials** > **Create credentials** > **OAuth client ID**. Type: **Web application**.
5. Back in Supabase: **Authentication** > **Sign In / Providers** > **Google**. Turn it on. Copy the **Callback URL** shown there.
6. Back in Google, under **Authorized redirect URIs**, click **Add URI** and paste that Callback URL. Click **Create**.
7. Google shows a **Client ID** and **Client secret**. Paste both into the Supabase Google panel and click **Save**.
8. While the app is in "Testing" in Google, add your clients' emails under **OAuth consent screen > Test users**, or click **Publish app** to allow anyone.

## Part 3: Vercel (the website)
1. Go to vercel.com and sign up with your GitHub account.
2. **Add New** > **Project** > pick the repo `TEST-`. Choose the branch you want to publish.
3. Set **Root Directory** to `finance-planner`.
4. Under **Environment Variables** add three: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (values from Part 1, step 6). Click **Deploy**.
5. Copy your new site address (like `https://something.vercel.app`).
6. In Supabase: **Authentication** > **URL Configuration**. Set **Site URL** to your site address. Under **Redirect URLs** add your address followed by `/auth/callback`.

## Part 4: Try it
1. Open your site, click **Continue with Google**, accept the consent screen.
2. Add a goal, a budget entry and a net worth entry.
3. Sign in with the admin email. You should see **Clients** in the menu showing summary numbers only.
4. On your phone, open the site and choose **Add to Home Screen**.

If any screen looks different from this guide, send a screenshot to Jarvis and ask what to click.
