/* ═══════════════════════════════════
   CURSOR SCRIPT
═══════════════════════════════════ */

// desativa em mobile (essencial)
if (window.innerWidth > 768) {

    const cursor = document.getElementById("cursor");
    const follower = document.getElementById("cursor-follower");

    let mouseX = 0, mouseY = 0;
    let posX = 0, posY = 0;

    document.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        cursor.style.left = mouseX + "px";
        cursor.style.top = mouseY + "px";
    });

    function animate() {
        posX += (mouseX - posX) * 0.12;
        posY += (mouseY - posY) * 0.12;

        follower.style.left = posX + "px";
        follower.style.top = posY + "px";

        requestAnimationFrame(animate);
    }

    animate();

    // hover inteligente
    document.querySelectorAll("a, button, input").forEach(el => {
        el.addEventListener("mouseenter", () => {
            document.body.classList.add("cursor-hover");
        });

        el.addEventListener("mouseleave", () => {
            document.body.classList.remove("cursor-hover");
        });
    });

    // clique
    document.addEventListener("mousedown", () => {
        document.body.classList.add("cursor-click");
    });

    document.addEventListener("mouseup", () => {
        document.body.classList.remove("cursor-click");
    });

}