// All four pages share this file. The HTML's data-mode identifies the current interface.
const activeMode = document.body.dataset.mode || "eco";
const settingsButton = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const modeWrap = document.querySelector(".mode-wrap");

const modeRoutes = {
    eco: "index.html",
    sport: "sport.html",
    race: "race.html"
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
const leaderboardData = window.JS_LEADERBOARD || [];
const boardBody = document.querySelector("#raceLeaderboard tbody");

if (boardBody) {
    const filters = document.querySelectorAll("[data-board-filter]");
    const search = document.getElementById("boardSearch");
    const count = document.getElementById("boardResultCount");
    const more = document.getElementById("boardMore");
    const details = document.getElementById("buildDetails");
    let selectedClass = "all";
    let visibleLimit = 25;

    function openBuild(build) {
        if (!details) return;
        document.getElementById("buildDialogTitle").textContent = build.car;
        document.getElementById("buildDialogMeta").textContent = `#${build.rank} overall · ${build.class} ${build.pi} · Spreadsheet row ${build.sourceRow}`;
        document.getElementById("buildDialogTime").textContent = build.time;
        document.getElementById("buildDialogStatus").textContent = build.status || "Not recorded";
        document.getElementById("buildDialogNotes").textContent = build.notes || "No notes recorded for this run.";
        details.showModal();
    }

    function renderLeaderboard() {
        const term = (search?.value || "").trim().toLocaleLowerCase();
        const matching = leaderboardData.filter((build) => {
            if (selectedClass !== "all" && build.class.toLowerCase() !== selectedClass) return false;
            const nickname = build.car.includes("Giulia Quadrifoglio") && build.status === "JS OG"
                ? "Grandpa Grandpa Alfa"
                : "";
            return `${build.car} ${build.status} ${build.notes} ${nickname}`.toLocaleLowerCase().includes(term);
        });

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

            const bracket = document.createElement("td");
            bracket.textContent = `${build.class} ${build.pi}`;

            const time = document.createElement("td");
            time.textContent = build.time;

            const status = document.createElement("td");
            status.textContent = build.status || "—";
            row.append(rank, car, bracket, time, status);
            fragment.append(row);
        }
        boardBody.replaceChildren(fragment);
        if (count) count.textContent = `Showing ${Math.min(visibleLimit, matching.length)} of ${matching.length} matching runs · ${leaderboardData.length} total`;
        if (more) {
            const remaining = matching.length - visibleLimit;
            more.hidden = remaining <= 0;
            more.textContent = `Show ${Math.min(remaining, 25)} more runs ↓`;
        }
    }

    filters.forEach((button) => button.addEventListener("click", () => {
        selectedClass = button.dataset.boardFilter;
        visibleLimit = 25;
        filters.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        renderLeaderboard();
    }));
    search?.addEventListener("input", () => { visibleLimit = 25; renderLeaderboard(); });
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
