# JS Spec

The source of **[jsspec.uk](https://jsspec.uk)**, my personal portfolio. GitHub Pages serves the site straight from this repository, so what's on `main` is what's live.

## What's on the site

The site has three modes, picked from the menu in the top-right corner like the drive modes on a car. Each mode is its own page.

| Page | What it is |
| --- | --- |
| **Eco** (`index.html`) | The main portfolio: who I am, selected projects, an about section and contact links. |
| **Sport** (`sport.html`) | A developer workbench: the projects I'm working on now and how I approach them. |
| **Race** (`race.html`) | A personal Forza archive: a leaderboard of my recorded Matsumi Climb runs. |
| **Support** (`support.html`) | A contact form, useful links and a short FAQ. |

**The Race leaderboard** is built in the browser from a snapshot of my lap-time spreadsheet (99 runs at the moment). You can search by car, status or notes, filter by class, show only the fastest run per car, and see the gap to the overall or class leader. Clicking a build opens its details, notes and any other runs of the same car. It's a personal archive, not an official or global leaderboard.

**The Support form** doesn't send anything to a server. The site is static, so the form opens a pre-filled email draft in the visitor's own email app.

## How it's built

Plain HTML, CSS and JavaScript. No framework, no build step and no dependencies.

- `style.css` holds the base styles; `modes.css` adds the mode-specific designs and phone layouts.
- `script.js` is shared by every page. It runs the mode picker (each page sets `data-mode` on `<body>`, and the picker moves between pages), the leaderboard and the Support form.
- `leaderboard-data.js` is the leaderboard snapshot. It's generated, not edited by hand (see below).

## Run it locally

Clone the repo and open `index.html` in a browser. To serve it the way GitHub Pages does, run a small static server from the project folder:

```sh
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Updating the leaderboard

`tools/Update-Leaderboard.ps1` reads the Matsumi `.xlsx` workbook directly (Excel isn't needed), sorts and ranks every run, and rewrites `leaderboard-data.js`:

```powershell
powershell -ExecutionPolicy Bypass -File tools\Update-Leaderboard.ps1 -Workbook "path\to\JS_Matsumi_Leaderboard.xlsx"
```

The page works everything else out from the data (run totals, class filters, gaps and the featured times), so no HTML changes are needed after an update. `Get-Help tools\Update-Leaderboard.ps1 -Full` lists the column headers it recognises.

## Deployment

The site is hosted on GitHub Pages from the root of the `main` branch. The `CNAME` file points it at the custom domain `jsspec.uk`, with HTTPS enforced. Pushing to `main` publishes the site.

## Other JS Spec projects

- **[JS SPEC // TUNE](https://github.com/Jessplayz2021/js-spec-tune)**: a tuning calculator for Forza-style racing games. Live at [tune.jsspec.uk](https://tune.jsspec.uk).
- **[JS SPEC // GARAGE DRAFT](https://github.com/Jessplayz2021/js-spec-garage)**: a car-building draft game that predicts a build's Matsumi time from real runs.
- **[OneNudge](https://github.com/Jessplayz2021/OneNudge)**: message templates for apprenticeship tutors. Live at [onenudge.jsspec.uk](https://onenudge.jsspec.uk).
- **[JS SPEC // DAILY LOG](https://github.com/Jessplayz2021/js-spec-log)**: an automated, honest log of my GitHub work.
