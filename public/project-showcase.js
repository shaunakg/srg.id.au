(function () {
    "use strict";

    const showcase = document.querySelector("[data-project-showcase]");
    if (!showcase) return;

    const panel = showcase.querySelector("[data-project-panel]");
    const content = showcase.querySelector(".project-detail-content");
    const kickerEl = showcase.querySelector("[data-project-panel-kicker]");
    const titleEl = showcase.querySelector("[data-project-panel-title]");
    const summaryEl = showcase.querySelector("[data-project-panel-summary]");
    const gallery = showcase.querySelector(".project-gallery");
    const cards = Array.from(showcase.querySelectorAll(".project-card"));
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!panel || !content || !kickerEl || !titleEl || !summaryEl || !gallery || cards.length === 0) {
        return;
    }

    let activeCard = null;
    let swapTimeoutId = 0;

    function cancelSwap() {
        if (swapTimeoutId) {
            window.clearTimeout(swapTimeoutId);
            swapTimeoutId = 0;
        }

        panel.classList.remove("is-side-switching");
        content.classList.remove("is-swapping");
    }

    function updatePanelContent(card) {
        kickerEl.textContent = card.dataset.projectKicker || "";
        titleEl.textContent = card.dataset.projectTitle || "";
        summaryEl.textContent = card.dataset.projectSummary || "";
    }

    function updatePanelPosition(card) {
        const showcaseRect = showcase.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        panel.style.top = `${Math.round(cardRect.top - showcaseRect.top)}px`;
    }

    function currentSide() {
        if (panel.classList.contains("is-left")) return "left";
        if (panel.classList.contains("is-right")) return "right";
        return null;
    }

    function isSameRow(firstCard, secondCard) {
        if (!firstCard || !secondCard) return false;
        return Math.abs(firstCard.offsetTop - secondCard.offsetTop) < 2;
    }

    function preferredSide(clientX, card) {
        if (typeof clientX === "number") {
            return clientX < window.innerWidth / 2 ? "left" : "right";
        }

        const rect = card.getBoundingClientRect();
        return rect.left + (rect.width / 2) < window.innerWidth / 2 ? "left" : "right";
    }

    function setActiveCard(card, side) {
        const previousSide = currentSide();
        const previousCard = activeCard;
        const shouldAnimateBetweenCards = !prefersReducedMotion && activeCard && activeCard !== card && !panel.classList.contains("is-empty");
        const shouldChangeRows = shouldAnimateBetweenCards && !isSameRow(previousCard, card);
        const shouldFadeBetweenCards = shouldAnimateBetweenCards && previousSide === side && !shouldChangeRows;
        const shouldSwitchPlacement = shouldAnimateBetweenCards && ((previousSide && previousSide !== side) || shouldChangeRows);

        if (activeCard && activeCard !== card) {
            activeCard.classList.remove("is-active");
        }

        activeCard = card;
        activeCard.classList.add("is-active");
        gallery.classList.add("has-active-card");

        if (shouldSwitchPlacement) {
            cancelSwap();
            panel.classList.add("is-side-switching", "is-empty");
            swapTimeoutId = window.setTimeout(() => {
                updatePanelPosition(card);
                panel.classList.remove("is-left", "is-right");
                panel.classList.add(`is-${side}`);
                updatePanelContent(card);
                panel.classList.remove("is-empty");
                window.requestAnimationFrame(() => {
                    panel.classList.remove("is-side-switching");
                });
                swapTimeoutId = 0;
            }, 95);
            return;
        }

        if (!shouldFadeBetweenCards) {
            cancelSwap();
            updatePanelPosition(card);
            panel.classList.remove("is-empty", "is-left", "is-right");
            panel.classList.add(`is-${side}`);
            updatePanelContent(card);
            return;
        }

        cancelSwap();
        panel.classList.remove("is-empty", "is-left", "is-right");
        panel.classList.add(`is-${side}`);
        content.classList.add("is-swapping");
        swapTimeoutId = window.setTimeout(() => {
            updatePanelContent(card);
            content.classList.remove("is-swapping");
            swapTimeoutId = 0;
        }, 95);
    }

    function clearActiveCard() {
        if (showcase.contains(document.activeElement)) return;

        if (activeCard) {
            activeCard.classList.remove("is-active");
        }

        activeCard = null;
        gallery.classList.remove("has-active-card");
        cancelSwap();
        panel.classList.add("is-empty");
        panel.style.top = "";
        kickerEl.textContent = "";
        titleEl.textContent = "";
        summaryEl.textContent = "";
    }

    cards.forEach((card) => {
        card.addEventListener("pointerenter", (event) => {
            if (event.pointerType === "touch") return;
            setActiveCard(card, preferredSide(event.clientX, card));
        });

        card.addEventListener("pointermove", (event) => {
            if (event.pointerType === "touch") return;
            if (!activeCard) {
                setActiveCard(card, preferredSide(event.clientX, card));
            } else if (activeCard !== card) {
                setActiveCard(card, preferredSide(event.clientX, card));
            }
        });

        card.addEventListener("focus", () => {
            setActiveCard(card, preferredSide(undefined, card));
        });

        card.addEventListener("blur", () => {
            window.requestAnimationFrame(clearActiveCard);
        });
    });

    showcase.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "touch") return;
        clearActiveCard();
    });

    window.addEventListener("resize", () => {
        if (activeCard) {
            updatePanelPosition(activeCard);
        }
    });
})();
