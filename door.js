// Private doorways (/hub, /radar). Browsers now refuse to let a public website probe private
// network addresses, so instead of checking, the page remembers Jess's own devices:
//   ?me      remember this browser as Jess's, then go straight in (do it once per device;
//            the private apps also do it by themselves on a device's first visit: ?me&back=...)
//   ?stay    show the doorway instead of jumping (and a button to forget this device)
//   ?forget  forget this browser, then go home
// A remembered device goes straight to the private app (Tailscale plus a login check on the app
// itself are the real lock). Everyone else goes straight to the home page. The flag lives only
// in this browser's storage for jsspec.uk; nothing is sent anywhere.
(function () {
    const KEY = "jsspec-door-device";
    const HOME = "../index.html";
    const target = document.body.dataset.doorTarget;
    const name = document.body.dataset.doorName || "it";
    const params = new URLSearchParams(location.search);

    const store = {
        get() { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } },
        set(on) { try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); return true; } catch { return false; } },
    };

    if (params.has("forget")) { store.set(false); location.replace(HOME); return; }
    if (params.has("me")) store.set(true);
    const mine = store.get();

    // ?me&back=<url>: the private apps send a device here once by themselves, so it gets
    // remembered without anyone typing anything, then come straight back. Only the private
    // apps' own addresses are accepted as "back", so this can't be used to send people elsewhere.
    if (params.has("me") && params.has("back")) {
        const back = safeBack(params.get("back"));
        location.replace(back || target);
        return;
    }

    if (params.has("stay")) {
        document.getElementById("doorPage").hidden = false;
        const open = document.getElementById("doorOpen");
        open.href = target;
        open.textContent = `Open ${name} →`;
        document.getElementById("doorNote").textContent = mine
            ? "This device is remembered: jsspec.uk goes straight in from here. It only connects while Tailscale is on."
            : "This device isn't remembered. Add ?me to the address once to go straight in from now on.";
        const forget = document.getElementById("doorForget");
        forget.hidden = !mine;
        forget.addEventListener("click", () => { store.set(false); location.replace(HOME); });
        return;
    }

    if (params.has("me") && !mine) {
        // Storage is blocked (e.g. private browsing): go in this once, it just won't be remembered.
        location.replace(target);
        return;
    }
    location.replace(mine ? target : HOME);

    // The return address must be https, on the same private host as this doorway's own target,
    // and on one of the JS Spec app ports. Anything else is ignored.
    function safeBack(raw) {
        try {
            const url = new URL(raw);
            const home = new URL(target);
            const port = Number(url.port);
            if (url.protocol !== "https:" || url.hostname !== home.hostname || !(port >= 4174 && port <= 4199)) return null;
            if (url.username || url.password) return null;
            return url.href;
        } catch {
            return null;
        }
    }
})();
