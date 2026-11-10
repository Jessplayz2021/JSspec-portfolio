# JS Spec — Eco / Sport / Race / Support prototype

A standalone, multi-page preview for Jess's existing JS Spec portfolio. These are **local prototype files**, not changes made to the public `jsspec.uk` site.

## What's included

- `index.html` — the original Eco portfolio, with a working mode picker, Support link, and a linked OneNudge feature card.
- `sport.html` — an engineering-themed workbench, with featured programming projects.
- `race.html` — a motorsport dashboard and filterable personal Matsumi Climb leaderboard.
- `leaderboard-data.js` — a frozen copy of all 99 spreadsheet rows, including duplicate runs, JS status, and Jess's notes.
- `support.html` — contact form, technical help links, and FAQ.
- `style.css` — the original portfolio styling from the uploaded file.
- `modes.css` — additional shared controls, page-specific designs, and phone layouts.
- `script.js` — shared mode navigation, dropdown behaviour, race filters/search, build detail popups, and email form handling.

## How to try it

Open `index.html` in your browser, or run the folder using VS Code Live Server. Select **Eco**, **Sport**, or **Race** in the top-right menu. Use **Support** from the navigation or footer.

## Integrating with the live GitHub project

**Compare and merge files first — don't blindly overwrite your latest local copies.** The source for this prototype was the HTML, CSS, and JS you attached on 10 November; any newer edits on your PC should be preserved.

1. Keep `index.html`, `sport.html`, `race.html`, `support.html`, `style.css`, `modes.css`, `leaderboard-data.js`, and `script.js` together at your site's root.
2. Make sure every page loads `style.css` followed by `modes.css`, with `script.js` just before the closing `</body>`.
3. Each page has a `<body data-mode="eco">`, `sport`, or `race` value. The JavaScript uses this to label the mode button and determine which interface is active.
4. The mode picker navigates to separate pages; it no longer just recolours the current page. Change routes in the `modeRoutes` object near the top of `script.js` if you reorganise folders.
5. The Support form uses `mailto:`. It **opens an email draft** in the visitor's email application; it does not create a support ticket or submit data to a server. For real ticket submissions, a backend or third-party form service would be needed.

## Notes

- The Race leaderboard uses **all 99 rows** in `JS_Matsumi_Leaderboard_Updated(2).xlsx`. It is a static snapshot, not a global or dynamically synced leaderboard. To update new runs, replace the corresponding entries in `leaderboard-data.js` and keep the list sorted by time, or regenerate the file from the newest spreadsheet. The browser's table shows the first 25 matching results at a time; use **Show more** to see the rest.
- The spreadsheet has some different times from older conversation notes (for example Giulia S2 822: `2:18.066` in the workbook versus earlier `2:18.454`). This preview uses the workbook's data as supplied, without changing the spreadsheet.
- The OneNudge link points to the separately hosted site at `https://onenudge.jsspec.uk/`.
- The HTML/CSS/JS are plain files; there's no build process and no external front-end framework.
