/* ═══════════════════════════════════
   PRELOADER SCRIPT
═══════════════════════════════════ */

document.body.classList.add("loading");

window.addEventListener("load", () => {
    const preloader = document.getElementById("preloader");
    const fill = document.querySelector(".preloader-fill");
    const counter = document.querySelector(".preloader-counter");

    let progress = 0;

    const fakeLoad = setInterval(() => {
        progress += Math.random() * 12;

        if (progress >= 100) {
            progress = 100;
            clearInterval(fakeLoad);

            setTimeout(() => {
                preloader.classList.add("hidden");
                document.body.classList.remove("loading");
            }, 300);
        }

        fill.style.width = progress + "%";
        counter.textContent = Math.floor(progress) + "%";
    }, 100);
});