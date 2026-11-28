// Private doorways (/hub, /radar). Browsers refuse to let a public website probe private network
// addresses, so the page remembers Jess's own devices instead. There are exactly two ways in:
//   /hub?me        (only on /hub) remember this browser as Jess's, then go into the hub
//   /hub, /radar   a remembered browser goes straight into the private app
// Everyone else goes straight to the home page. There is no other option, page or parameter.
// The real lock is elsewhere: Tailscale, plus a login check on each private app. The flag lives
// only in this browser's storage for jsspec.uk; nothing is sent anywhere. To forget a device,
// clear jsspec.uk's site data in that browser.
(function () {
    const KEY = "jsspec-door-device";
    const HOME = "../index.html";
    const target = document.body.dataset.doorTarget;
    const canMark = document.body.dataset.doorMark === "yes";

    let mine = false;
    try {
        if (canMark && new URLSearchParams(location.search).has("me")) localStorage.setItem(KEY, "1");
        mine = localStorage.getItem(KEY) === "1";
    } catch {
        mine = false;
    }
    location.replace(mine ? target : HOME);
})();
