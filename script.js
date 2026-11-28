// All four pages share this file. The HTML's data-mode identifies the current interface.
const activeMode = document.body.dataset.mode || "eco";
const settingsButton = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const modeWrap = document.querySelector(".mode-wrap");

// Pages in a subfolder (e.g. hub/) set window.JS_SPEC_BASE = "../" so these still point at the root.
const routeBase = window.JS_SPEC_BASE || "";
const modeRoutes = {
    eco: `${routeBase}index.html`,
    sport: `${routeBase}sport.html`,
    race: `${routeBase}race.html`
};

// The label follows the page, so navigating to Race never leaves it saying ECO MODE.
if (settingsButton && settingsPanel) {
    settingsButton.textContent = `● ${activeMode.toUpperCase()} MODE`;

    function showSettings(isOpen) {
        settingsPanel.classList.toggle("open", isOpen);
        settingsButton.classList.toggle("active", isOpen);
        settingsButton.setAttribute("aria-expanded", String(isOpen));
    }

    settingsButton.addEventListener("click", () => {
        showSettings(!settingsPanel.classList.contains("open"));
    });

    for (const mode of ["eco", "sport", "race"]) {
        const button = document.getElementById(`${mode}Btn`);
        if (!button) continue;

        button.setAttribute("aria-pressed", String(mode === activeMode));
        button.addEventListener("click", () => {
            showSettings(false);
            if (mode !== activeMode) {
                window.location.assign(modeRoutes[mode]);
            }
        });
    }

    document.addEventListener("click", (event) => {
        if (modeWrap && !modeWrap.contains(event.target)) showSettings(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") showSettings(false);
    });
}

// Keep footer dates current without manually editing each page in January.
document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
});
const existingYear = document.getElementById("year");
if (existingYear) existingYear.textContent = new Date().getFullYear();

// Race Mode: build the leaderboard from the spreadsheet snapshot, including notes.
// Counts, class buttons, gaps and featured times are all worked out from the data,
// so regenerating leaderboard-data.js is the only step needed after new runs.
const leaderboardData = window.JS_LEADERBOARD || [];
const boardBody = document.querySelector("#raceLeaderboard tbody");
const classOrder = ["X", "R", "S2", "S1", "A", "B", "C", "D"];
const carKey = (car) => car.trim().toLocaleLowerCase().replace(/\s+/g, " ");

function formatGap(ms) {
    const seconds = ms / 1000;
    if (seconds < 60) return `+${seconds.toFixed(3)}`;
    return `+${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}

// Fastest first, then work out class ranks, class leaders and every car's runs in one pass.
const rankedRuns = [...leaderboardData].sort((a, b) => a.ms - b.ms || a.rank - b.rank);
const classTotals = new Map();
const classLeaderMs = new Map();
const classRank = new Map();
const runsByCar = new Map();
for (const build of rankedRuns) {
    const cls = build.class.toUpperCase();
    classTotals.set(cls, (classTotals.get(cls) || 0) + 1);
    classRank.set(build, classTotals.get(cls));
    if (!classLeaderMs.has(cls)) classLeaderMs.set(cls, build.ms);
    const key = carKey(build.car);
    if (!runsByCar.has(key)) runsByCar.set(key, []);
    runsByCar.get(key).push(build);
}
const overallBestMs = rankedRuns[0]?.ms ?? 0;

document.querySelectorAll("[data-board-total]").forEach((node) => {
    node.textContent = leaderboardData.length;
});

// Featured cards pick the fastest run matching their car (and status, when given).
document.querySelectorAll("[data-feature-car]").forEach((card) => {
    const wantedCar = carKey(card.dataset.featureCar);
    const wantedStatus = card.dataset.featureStatus;
    const match = rankedRuns.find((build) => carKey(build.car) === wantedCar
        && (!wantedStatus || build.status.trim() === wantedStatus));
    if (!match) return;
    const time = card.querySelector("strong");
    if (time) time.textContent = match.time;
    const bracket = card.querySelector("[data-feature-class]");
    if (bracket) bracket.textContent = `${match.class} ${match.pi}`;
});

if (boardBody) {
    const filterBar = document.getElementById("boardFilters");
    const search = document.getElementById("boardSearch");
    const bestOnly = document.getElementById("boardBestOnly");
    const count = document.getElementById("boardResultCount");
    const more = document.getElementById("boardMore");
    const gapHeading = document.getElementById("boardGapHeading");
    const details = document.getElementById("buildDetails");
    let selectedClass = "all";
    let visibleLimit = 25;

    // Known classes in Forza order; anything new goes on the end alphabetically.
    const orderOf = (cls) => (classOrder.includes(cls) ? classOrder.indexOf(cls) : classOrder.length);
    const classes = [...classTotals.keys()].sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b));
    if (filterBar) {
        for (const [value, label, total] of [["all", "All", leaderboardData.length], ...classes.map((cls) => [cls, cls, classTotals.get(cls)])]) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.boardFilter = value;
            button.setAttribute("aria-pressed", String(value === selectedClass));
            const number = document.createElement("span");
            number.textContent = total;
            button.append(`${label} `, number);
            filterBar.append(button);
        }
        filterBar.addEventListener("click", (event) => {
            const button = event.target.closest("[data-board-filter]");
            if (!button) return;
            selectedClass = button.dataset.boardFilter;
            visibleLimit = 25;
            filterBar.querySelectorAll("[data-board-filter]").forEach((other) => {
                other.setAttribute("aria-pressed", String(other === button));
            });
            renderLeaderboard();
        });
    }

    function openBuild(build) {
        if (!details) return;
        const cls = build.class.toUpperCase();
        const extras = [build.drive, build.date].filter(Boolean).map((value) => ` · ${value}`).join("");
        document.getElementById("buildDialogTitle").textContent = build.car;
        document.getElementById("buildDialogMeta").textContent =
            `#${build.rank} overall · #${classRank.get(build)} of ${classTotals.get(cls)} in ${cls} · ${build.class} ${build.pi}${extras} · Spreadsheet row ${build.sourceRow}`;
        document.getElementById("buildDialogTime").textContent = build.time;

        const overallGap = build.ms - overallBestMs;
        const classGap = build.ms - classLeaderMs.get(cls);
        const gapParts = [overallGap > 0 ? `${formatGap(overallGap)} to the overall leader` : "Fastest run on the board"];
        if (overallGap > 0) gapParts.push(classGap > 0 ? `${formatGap(classGap)} to the ${cls} leader` : `Fastest in ${cls}`);
        document.getElementById("buildDialogGap").textContent = gapParts.join(" · ");

        document.getElementById("buildDialogStatus").textContent = build.status || "Not recorded";
        document.getElementById("buildDialogNotes").textContent = build.notes || "No notes recorded for this run.";

        // Every other run of the same car, each one clickable to jump straight to it.
        const otherRuns = runsByCar.get(carKey(build.car)).filter((run) => run !== build);
        const runsBlock = document.getElementById("buildDialogRunsBlock");
        const runsList = document.getElementById("buildDialogRuns");
        runsBlock.hidden = otherRuns.length === 0;
        runsList.replaceChildren(...otherRuns.map((run) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            const time = document.createElement("strong");
            const delta = run.ms - build.ms;
            time.textContent = `${run.time} (${delta > 0 ? formatGap(delta) : `-${formatGap(-delta).slice(1)}`})`;
            const info = document.createElement("small");
            info.textContent = `#${run.rank} · ${run.class} ${run.pi} · ${run.status || "No status"}`;
            button.append(time, info);
            button.addEventListener("click", () => openBuild(run));
            item.append(button);
            return item;
        }));

        if (!details.open) details.showModal();
    }

    function renderLeaderboard() {
        const term = (search?.value || "").trim().toLocaleLowerCase();
        let matching = rankedRuns.filter((build) => {
            if (selectedClass !== "all" && build.class.toUpperCase() !== selectedClass) return false;
            const nickname = build.car.includes("Giulia Quadrifoglio") && build.status === "JS OG"
                ? "Grandpa Grandpa Alfa"
                : "";
            return `${build.car} ${build.status} ${build.notes} ${nickname}`.toLocaleLowerCase().includes(term);
        });
        if (bestOnly?.checked) {
            const seen = new Set();
            matching = matching.filter((build) => {
                const key = carKey(build.car);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        // Gaps are measured against the overall leader, or the class leader when a class is picked.
        const gapBase = selectedClass === "all" ? overallBestMs : classLeaderMs.get(selectedClass);
        if (gapHeading) gapHeading.textContent = selectedClass === "all" ? "Gap to leader" : `Gap to ${selectedClass} leader`;

        const fragment = document.createDocumentFragment();
        for (const build of matching.slice(0, visibleLimit)) {
            const row = document.createElement("tr");
            if (build.car.includes("Giulia Quadrifoglio") && build.status === "JS OG") {
                row.className = "hero-row";
            }

            const rank = document.createElement("td");
            rank.textContent = String(build.rank).padStart(2, "0");

            const car = document.createElement("td");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "board-entry";
            button.textContent = build.car;
            button.setAttribute("aria-label", `View details for ${build.car}, ${build.time}`);
            button.addEventListener("click", () => openBuild(build));
            car.append(button);
            const runTotal = runsByCar.get(carKey(build.car)).length;
            if (runTotal > 1) {
                const tag = document.createElement("span");
                tag.className = "board-runs";
                tag.textContent = `${runTotal} runs`;
                car.append(tag);
            }

            const bracket = document.createElement("td");
            bracket.textContent = `${build.class} ${build.pi}`;

            const time = document.createElement("td");
            time.textContent = build.time;

            const gap = document.createElement("td");
            const gapMs = build.ms - gapBase;
            gap.textContent = gapMs > 0 ? formatGap(gapMs) : "Leader";
            if (gapMs <= 0) gap.className = "is-leader";

            const status = document.createElement("td");
            status.textContent = build.status || "—";
            row.append(rank, car, bracket, time, gap, status);
            fragment.append(row);
        }
        boardBody.replaceChildren(fragment);
        const noun = bestOnly?.checked ? "cars (fastest run each)" : "matching runs";
        if (count) count.textContent = `Showing ${Math.min(visibleLimit, matching.length)} of ${matching.length} ${noun} · ${leaderboardData.length} total`;
        if (more) {
            const remaining = matching.length - visibleLimit;
            more.hidden = remaining <= 0;
            more.textContent = `Show ${Math.min(remaining, 25)} more ↓`;
        }
    }

    search?.addEventListener("input", () => { visibleLimit = 25; renderLeaderboard(); });
    bestOnly?.addEventListener("change", () => { visibleLimit = 25; renderLeaderboard(); });
    more?.addEventListener("click", () => { visibleLimit += 25; renderLeaderboard(); });
    document.getElementById("closeBuildDetails")?.addEventListener("click", () => details.close());
    details?.addEventListener("click", (event) => { if (event.target === details) details.close(); });
    renderLeaderboard();
}

// GitHub Pages is static; the support form opens the visitor's mail app.
// It never pretends to submit information to a server.
const supportForm = document.getElementById("supportForm");
if (supportForm) {
    supportForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!supportForm.reportValidity()) return;

        const details = new FormData(supportForm);
        const topic = String(details.get("topic") || "General question");
        const name = String(details.get("name") || "Visitor").trim();
        const replyTo = String(details.get("email") || "").trim();
        const message = String(details.get("message") || "").trim();

        const subject = encodeURIComponent(`[JS Spec Support] ${topic}`);
        const body = encodeURIComponent(`Name: ${name}\nReply-to: ${replyTo}\n\n${message}`);
        const feedback = document.getElementById("supportFeedback");
        if (feedback) feedback.textContent = "Your email app will open. Please review and send the message there.";
        window.location.href = `mailto:jsspec.contact@gmail.com?subject=${subject}&body=${body}`;
    });
}
