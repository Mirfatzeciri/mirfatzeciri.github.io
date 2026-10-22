const required = ["ADZUNA_APP_ID", "ADZUNA_APP_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
    throw new Error(`Missing required GitHub Actions secrets/variables: ${missing.join(", ")}`);
}

const searches = [
    "digitaliseringskonsulent",
    "IT koordinator",
    "dataanalytiker",
    "UX designer",
    "informatik kommunikation",
    "IT projektkoordinator"
];

const ads = new Map();
for (const what of searches) {
    const url = new URL("https://api.adzuna.com/v1/api/jobs/dk/search/1");
    url.search = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        results_per_page: "20",
        what,
        where: "København",
        distance: "35",
        max_days_old: "14",
        "content-type": "application/json"
    });

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
        throw new Error(`Adzuna search "${what}" failed with HTTP ${response.status}.`);
    }
    const result = await response.json();
    if (!Array.isArray(result.results)) {
        throw new Error(`Adzuna returned an unexpected result for "${what}".`);
    }

    for (const ad of result.results) {
        if (!ad.id || !ad.title || !ad.redirect_url) continue;
        ads.set(String(ad.id), {
            source: "adzuna",
            external_id: String(ad.id),
            title: String(ad.title).slice(0, 500),
            company: ad.company?.display_name ? String(ad.company.display_name).slice(0, 300) : null,
            location: ad.location?.display_name ? String(ad.location.display_name).slice(0, 300) : null,
            description: ad.description ? String(ad.description).slice(0, 5000) : null,
            redirect_url: String(ad.redirect_url),
            posted_at: ad.created ? new Date(ad.created).toISOString() : null,
            fetched_at: new Date().toISOString()
        });
    }
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, "");
const response = await fetch(`${baseUrl}/rest/v1/job_listings?on_conflict=source%2Cexternal_id`, {
    method: "POST",
    headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([...ads.values()])
});

if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Supabase job import failed with HTTP ${response.status}: ${detail}`);
}

console.log(`Imported ${ads.size} unique job listings from Adzuna.`);
