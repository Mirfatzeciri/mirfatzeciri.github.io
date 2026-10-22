import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.JOBS_CONFIG;
const setupNotice = document.querySelector("#setup-notice");
const errorNotice = document.querySelector("#error-notice");
const authPanel = document.querySelector("#auth-panel");
const dashboard = document.querySelector("#dashboard");
const signOutButton = document.querySelector("#sign-out");
const list = document.querySelector("#jobs-list");
const emptyState = document.querySelector("#empty-state");
const statusLabels = {
    new: "Nyt",
    interested: "Interessant",
    applied: "Søgt",
    interview: "Samtale",
    rejected: "Afslag",
    not_relevant: "Ikke relevant"
};

let client;
let jobs = [];
let applications = new Map();
let currentUser;
let searchRequest = 0;

function showError(message) {
    errorNotice.textContent = message;
    errorNotice.hidden = false;
}

function clearError() {
    errorNotice.textContent = "";
    errorNotice.hidden = true;
}

function setSignedIn(isSignedIn) {
    authPanel.hidden = isSignedIn;
    dashboard.hidden = !isSignedIn;
    signOutButton.hidden = !isSignedIn;
}

function formatDate(value) {
    if (!value) return "Dato ikke oplyst";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Dato ikke oplyst";
    return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(date);
}

function escapeText(value) {
    return String(value ?? "");
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderStats() {
    const counts = {
        new: jobs.filter(job => (applications.get(job.id)?.status ?? "new") === "new").length,
        interested: jobs.filter(job => applications.get(job.id)?.status === "interested").length,
        applied: jobs.filter(job => applications.get(job.id)?.status === "applied").length,
        interview: jobs.filter(job => applications.get(job.id)?.status === "interview").length
    };
    const stats = document.querySelector("#stats");
    stats.replaceChildren();
    [
        ["Nye opslag", counts.new],
        ["Interessante", counts.interested],
        ["Søgt", counts.applied],
        ["Samtaler", counts.interview]
    ].forEach(([label, count]) => {
        const card = makeElement("div", "jobs-stat");
        card.append(makeElement("strong", "", count), makeElement("span", "", label));
        stats.append(card);
    });
}

function renderJobs() {
    const search = document.querySelector("#job-search").value.trim().toLocaleLowerCase("da");
    const selectedStatus = document.querySelector("#status-filter").value;
    const filteredJobs = jobs.filter(job => {
        const application = applications.get(job.id);
        const status = application?.status ?? "new";
        const searchText = `${job.title} ${job.company} ${job.location}`.toLocaleLowerCase("da");
        return (selectedStatus === "all" || status === selectedStatus) && searchText.includes(search);
    });

    list.replaceChildren();
    filteredJobs.forEach(job => {
        const application = applications.get(job.id);
        const status = application?.status ?? "new";
        const card = makeElement("article", "job-card");
        const top = makeElement("div", "job-card-top");
        const heading = makeElement("div");
        heading.append(
            makeElement("h2", "", escapeText(job.title)),
            makeElement("p", "job-card-company", escapeText(job.company || "Arbejdsgiver ikke oplyst"))
        );
        top.append(heading, makeElement("span", "job-status-label", statusLabels[status] ?? statusLabels.new));
        card.append(top);

        const meta = makeElement("div", "job-card-meta");
        meta.append(
            makeElement("span", "", escapeText(job.location || "Sted ikke oplyst")),
            makeElement("span", "", `Opslået ${formatDate(job.posted_at)}`),
            makeElement("span", "", "Adzuna")
        );
        card.append(meta);

        if (job.description) {
            const description = makeElement("p", "job-card-description");
            description.textContent = escapeText(job.description).replace(/\s+/g, " ").slice(0, 360);
            card.append(description);
        }

        const controls = makeElement("div", "job-card-controls");
        const statusLabel = makeElement("label", "", "Min status");
        const statusSelect = document.createElement("select");
        statusSelect.setAttribute("aria-label", `Status for ${job.title}`);
        Object.entries(statusLabels).forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = value === status;
            statusSelect.append(option);
        });
        statusSelect.addEventListener("change", () => saveApplication(job.id, { status: statusSelect.value }));
        statusLabel.append(statusSelect);

        const notesLabel = makeElement("label", "", "Mine noter");
        const notes = document.createElement("textarea");
        notes.value = escapeText(application?.notes);
        notes.placeholder = "Fx kontaktperson eller næste skridt…";
        notes.setAttribute("aria-label", `Noter til ${job.title}`);
        notes.addEventListener("blur", () => saveApplication(job.id, { notes: notes.value }));
        notesLabel.append(notes);
        controls.append(statusLabel, notesLabel);

        if (job.redirect_url) {
            const externalLink = makeElement("a", "job-original-link", "Se originalt opslag ↗");
            externalLink.href = job.redirect_url;
            externalLink.target = "_blank";
            externalLink.rel = "noopener noreferrer";
            controls.append(externalLink);
        }

        card.append(controls);
        list.append(card);
    });

    emptyState.hidden = filteredJobs.length !== 0;
    renderStats();
}

async function saveApplication(jobId, changes) {
    if (!currentUser) return;
    clearError();
    const previous = applications.get(jobId) ?? { status: "new", notes: "" };
    const row = {
        user_id: currentUser.id,
        job_id: jobId,
        status: changes.status ?? previous.status,
        notes: changes.notes ?? previous.notes,
        updated_at: new Date().toISOString()
    };
    const { data, error } = await client
        .from("job_applications")
        .upsert(row, { onConflict: "user_id,job_id" })
        .select("job_id,status,notes,updated_at")
        .single();

    if (error) {
        showError(`Kunne ikke gemme din status eller note: ${error.message}`);
        return;
    }

    applications.set(jobId, data);
    renderJobs();
}

async function loadJobs() {
    const requestId = ++searchRequest;
    clearError();
    document.querySelector("#last-updated").textContent = "Henter opslag…";

    const applicationResult = await client
        .from("job_applications")
        .select("job_id,status,notes,updated_at");

    if (requestId !== searchRequest) return;
    if (applicationResult.error) {
        showError(`Kunne ikke hente dine ansøgningsnoter: ${applicationResult.error.message}`);
        document.querySelector("#last-updated").textContent = "";
        return;
    }

    const trackedJobIds = applicationResult.data.map(row => row.job_id);
    let query = client
        .from("job_listings")
        .select("id,title,company,location,description,redirect_url,posted_at,fetched_at");
    const recentlyFetched = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (trackedJobIds.length) {
        query = query.or(`fetched_at.gte.${recentlyFetched},id.in.(${trackedJobIds.join(",")})`);
    } else {
        query = query.gte("fetched_at", recentlyFetched);
    }
    const jobResult = await query.order("posted_at", { ascending: false, nullsFirst: false });

    if (requestId !== searchRequest) return;
    if (jobResult.error) {
        showError(`Kunne ikke hente jobopslag: ${jobResult.error.message}`);
        document.querySelector("#last-updated").textContent = "";
        return;
    }

    jobs = jobResult.data;
    applications = new Map(applicationResult.data.map(row => [row.job_id, row]));
    const mostRecent = jobs.reduce((latest, job) => {
        const time = Date.parse(job.fetched_at ?? "");
        return Number.isNaN(time) ? latest : Math.max(latest, time);
    }, 0);
    document.querySelector("#last-updated").textContent = mostRecent
        ? `Senest hentet ${formatDate(mostRecent)}`
        : "Der er endnu ikke hentet jobopslag.";
    renderJobs();
}

async function init() {
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
        setupNotice.hidden = false;
        return;
    }

    client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data, error } = await client.auth.getSession();
    if (error) {
        showError(`Kunne ikke kontrollere dit login: ${error.message}`);
        return;
    }

    currentUser = data.session?.user ?? null;
    setSignedIn(Boolean(currentUser));
    if (currentUser) await loadJobs();

    client.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user ?? null;
        setSignedIn(Boolean(currentUser));
        if (currentUser) void loadJobs();
        else {
            jobs = [];
            applications.clear();
            list.replaceChildren();
        }
    });
}

document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) return;
    clearError();
    const feedback = document.querySelector("#auth-feedback");
    feedback.textContent = "Sender loginlink…";
    const email = new FormData(event.currentTarget).get("email");
    const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href }
    });
    if (error) {
        feedback.textContent = "";
        showError(`Kunne ikke sende loginlink: ${error.message}`);
        return;
    }
    feedback.textContent = "Loginlink sendt. Tjek din indbakke.";
});

signOutButton.addEventListener("click", async () => {
    clearError();
    const { error } = await client.auth.signOut();
    if (error) showError(`Kunne ikke logge ud: ${error.message}`);
});

document.querySelector("#job-search").addEventListener("input", renderJobs);
document.querySelector("#status-filter").addEventListener("change", renderJobs);
document.querySelector("#refresh-jobs").addEventListener("click", () => void loadJobs());

void init().catch(error => {
    showError(`Dashboardet kunne ikke startes: ${error.message}`);
});
