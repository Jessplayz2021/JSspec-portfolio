let activeMode = "eco";

document.documentElement.style.setProperty(
    "--active-colour",
    "var(--"+activeMode+")"
);

const ecoButton = document.getElementById("ecoBtn");
const sportButton = document.getElementById("sportBtn");
const raceButton = document.getElementById("raceBtn");
console.log(activeMode);
ecoButton.addEventListener("click", function(){
    document.documentElement.style.setProperty(
        "--active-colour",
        "var(--eco)"
    )
    activeMode = "eco"
    console.log("Eco mode engaged!")
});

sportButton.addEventListener("click", function(){
    document.documentElement.style.setProperty(
        "--active-colour",
        "var(--sport)"
    )
    activeMode = "sport"
    console.log("Sport mode engaged!")
});

raceButton.addEventListener("click", function(){
    document.documentElement.style.setProperty(
        "--active-colour",
        "var(--race)"
    )
    activeMode = "race"
    console.log("Soo.. You chose violence... Welcome to Race mode!")
});

function changeMode(mode){
    console.log(mode);
}

const settingsButton = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");

settingsButton.addEventListener("click", function() {
    settingsPanel.classList.toggle("open");
});
