# Privat jobdashboard

`jobs.html` er en offentlig statisk side, men jobopslag vises kun efter login.
Ansøgningsstatus og noter ligger i Supabase og beskyttes med Row Level Security.
Læg aldrig Supabase service-role-nøglen i denne mappe eller i browserkonfigurationen.

## 1. Opret Supabase

1. Opret et projekt på [supabase.com](https://supabase.com/).
2. Åbn **SQL Editor**, og kør indholdet af [`supabase/schema.sql`](./supabase/schema.sql).
3. Find **Project URL** og **anon/public key** under projektets API-indstillinger.
4. Under **Authentication → URL Configuration** sættes Site URL til
   `https://mirfatzeciri.github.io/jobs.html`, og samme adresse tilføjes som Redirect URL.
5. Tilføj din konto under **Authentication → Users** som bruger, hvis Supabase-projektet
   er sat til kun at tillade inviterede brugere. Ellers kan du oprette den via loginlinket.

## 2. Tilføj GitHub-konfiguration

I repository **Settings → Secrets and variables → Actions** oprettes:

**Variables**

- `SUPABASE_URL`: Supabase Project URL.
- `SUPABASE_ANON_KEY`: Supabase anon/public key. Den er beregnet til browseren; databasepolitikkerne beskytter dataene.

**Secrets**

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Denne nøgle giver fuld databaseadgang og må kun ligge som GitHub Secret.
- `ADZUNA_APP_ID` og `ADZUNA_APP_KEY`: Opret en API-konto hos [Adzuna Developer](https://developer.adzuna.com/overview).

Den eksisterende Pages-workflow lægger kun webfilerne i Pages-artefaktet og genererer
`jobs-config.js` fra de offentlige Supabase-variables. Nøglerne deles ikke i kildekoden.
Kør derefter **Actions → Deploy portfolio to GitHub Pages → Run workflow** for at
udgive dashboardkonfigurationen. En efterfølgende ændring på `main` udgiver også sitet.

## 3. Daglig import

Workflowet [Refresh private job dashboard](./.github/workflows/job-search.yml) søger
dagligt omkring kl. 07 dansk tid (06 om vinteren) via Adzunas officielle API efter
relevante IT-, digitaliserings-, data- og UX-stillinger inden for 35 km af København.
Det kan også køres manuelt fra **Actions**. API-kontoens kvoter og adgang bestemmes af
Adzuna. Kontrollér resultatet i workflowloggen, hvis importen fejler.

Når dashboardet er sat op, logger du ind via et engangslink på e-mail. Stillinger åbnes
hos den oprindelige jobkilde; dashboardet sender ikke ansøgninger. Statusser og noter
er personlige for den indloggede Supabase-bruger.
