(() => {
  const article = document.querySelector(".post-layout .post-article");
  const tocNavs = Array.from(document.querySelectorAll("[data-toc-nav]"));
  if (!article || tocNavs.length === 0) {
    return;
  }

  const entries = [];
  const entriesById = new Map();

  const normalizeText = (value) => value.replace(/\s+/g, " ").trim();

  tocNavs.forEach((nav) => {
    const links = Array.from(nav.querySelectorAll("a[href*='#']"));
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) {
        return;
      }

      let id = "";
      try {
        const parsed = new URL(href, window.location.href);
        id = decodeURIComponent(parsed.hash.replace(/^#/, ""));
      } catch (_error) {
        return;
      }

      if (!id) {
        return;
      }

      const heading = article.querySelector(`#${CSS.escape(id)}`);
      if (!heading) {
        return;
      }

      let entry = entriesById.get(id);
      if (!entry) {
        entry = {
          id,
          heading,
          label: normalizeText(link.textContent || heading.textContent || ""),
          links: [],
        };
        entries.push(entry);
        entriesById.set(id, entry);
      }

      entry.links.push(link);
    });
  });

  if (entries.length === 0) {
    return;
  }

  const mobileToc = document.querySelector("[data-mobile-toc]");
  const mobileToggle = document.querySelector("[data-mobile-toc-toggle]");
  const mobilePanel = document.querySelector("[data-mobile-toc-panel]");
  const mobileLabel = document.querySelector(".mobile-toc-label");
  const mobileCurrentWindow = document.querySelector("[data-toc-current-window]");
  const mobileNav = mobilePanel
    ? mobilePanel.querySelector("[data-toc-nav='mobile']")
    : null;
  const mobileCollapsedLabel =
    mobileToc?.dataset.mobileCollapsedLabel || "In this post";
  const mobileExpandedLabel =
    mobileToc?.dataset.mobileExpandedLabel || "Table of contents";
  const mobilePostTitle = mobileToc?.dataset.mobilePostTitle || "";
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };
  const mobileBreakpoint = window.matchMedia
    ? window.matchMedia("(max-width: 900px)")
    : null;

  let currentIndex = -1;
  let isMobileOpen = false;

  const createMobileCurrentText = (text) => {
    const span = document.createElement("span");
    span.className = "mobile-toc-current-text";
    span.textContent = text;
    return span;
  };

  const setMobileNavInteractive = (interactive) => {
    if (!mobilePanel || !mobileNav) {
      return;
    }

    mobilePanel.setAttribute("aria-hidden", interactive ? "false" : "true");
    if (interactive) {
      mobileNav.removeAttribute("inert");
    } else {
      mobileNav.setAttribute("inert", "");
    }
  };

  const setMobileCurrentLabel = (text, options = {}) => {
    if (!mobileCurrentWindow || !text) {
      return;
    }

    const { direction = 1, mode = "slide" } = options;

    const existingNodes = Array.from(
      mobileCurrentWindow.querySelectorAll(".mobile-toc-current-text")
    );
    const currentNode = existingNodes[existingNodes.length - 1] || null;
    existingNodes.slice(0, -1).forEach((node) => node.remove());

    if (!currentNode) {
      mobileCurrentWindow.appendChild(createMobileCurrentText(text));
      return;
    }

    if (normalizeText(currentNode.textContent || "") === text) {
      return;
    }

    if (prefersReducedMotion.matches || typeof currentNode.animate !== "function") {
      currentNode.remove();
      mobileCurrentWindow.appendChild(createMobileCurrentText(text));
      return;
    }

    const incomingNode = createMobileCurrentText(text);
    mobileCurrentWindow.appendChild(incomingNode);

    const incomingAnimation =
      mode === "fade"
        ? {
            keyframes: [
              { opacity: 0, transform: "scale(0.985)", filter: "blur(3px)" },
              { opacity: 1, transform: "scale(1)", filter: "blur(0)" },
            ],
            timing: {
              duration: 180,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "forwards",
            },
          }
        : {
            keyframes: [
              {
                opacity: 0,
                transform: `translateY(${direction < 0 ? -12 : 12}px)`,
                filter: "blur(0)",
              },
              { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
            ],
            timing: {
              duration: 220,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "forwards",
            },
          };

    incomingNode.animate(incomingAnimation.keyframes, incomingAnimation.timing);

    const outgoingAnimation =
      mode === "fade"
        ? {
            keyframes: [
              { opacity: 1, transform: "scale(1)", filter: "blur(0)" },
              { opacity: 0, transform: "scale(1.015)", filter: "blur(3px)" },
            ],
            timing: {
              duration: 150,
              easing: "cubic-bezier(0.55, 0, 1, 0.45)",
              fill: "forwards",
            },
          }
        : {
            keyframes: [
              { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
              {
                opacity: 0,
                transform: `translateY(${direction < 0 ? 12 : -12}px)`,
                filter: "blur(0)",
              },
            ],
            timing: {
              duration: 180,
              easing: "cubic-bezier(0.55, 0, 1, 0.45)",
              fill: "forwards",
            },
          };

    currentNode
      .animate(outgoingAnimation.keyframes, outgoingAnimation.timing)
      .finished.finally(() => {
        if (currentNode.isConnected) {
          currentNode.remove();
        }
      });
  };

  const scrollCurrentMobileLinkIntoView = () => {
    if (!mobileNav) {
      return;
    }

    const currentLink = mobileNav.querySelector("a.is-current");
    if (!currentLink || typeof currentLink.scrollIntoView !== "function") {
      return;
    }

    currentLink.scrollIntoView({ block: "nearest" });
  };

  const getCurrentMobileText = () => {
    if (isMobileOpen) {
      return mobilePostTitle;
    }

    if (currentIndex >= 0 && entries[currentIndex]) {
      return entries[currentIndex].label;
    }

    return entries[0].label;
  };

  const renderMobileBar = (options = {}) => {
    if (mobileLabel) {
      mobileLabel.textContent = isMobileOpen
        ? mobileExpandedLabel
        : mobileCollapsedLabel;
    }

    setMobileCurrentLabel(getCurrentMobileText(), options);
  };

  const setMobileOpen = (nextState) => {
    if (!mobileToc || !mobileToggle || !mobilePanel) {
      return;
    }

    isMobileOpen = nextState;
    mobileToc.classList.toggle("is-open", nextState);
    mobileToggle.setAttribute("aria-expanded", nextState ? "true" : "false");
    setMobileNavInteractive(nextState);
    renderMobileBar({ direction: nextState ? 1 : -1, mode: "fade" });

    if (nextState) {
      window.requestAnimationFrame(scrollCurrentMobileLinkIntoView);
    }
  };

  const setCurrent = (id) => {
    const nextIndex = entries.findIndex((entry) => entry.id === id);
    if (nextIndex === -1) {
      return;
    }

    const direction =
      currentIndex === -1 || nextIndex === currentIndex
        ? 1
        : nextIndex > currentIndex
          ? 1
          : -1;

    currentIndex = nextIndex;

    entries.forEach((entry) => {
      const isCurrent = entry.id === id;
      entry.links.forEach((link) => {
        link.classList.toggle("is-current", isCurrent);
        if (isCurrent) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    });

    if (!isMobileOpen) {
      renderMobileBar({ direction, mode: "slide" });
    }
  };

  const getCurrentId = () => {
    const triggerY = window.scrollY + window.innerHeight * 0.3;
    let current = entries[0];

    entries.forEach((entry) => {
      const headingTop = entry.heading.getBoundingClientRect().top + window.scrollY;
      if (headingTop <= triggerY) {
        current = entry;
      }
    });

    return current.id;
  };

  let ticking = false;
  const updateCurrent = () => {
    ticking = false;
    setCurrent(getCurrentId());
  };

  const scheduleUpdate = () => {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(updateCurrent);
  };

  setMobileNavInteractive(false);
  renderMobileBar({ direction: 1, mode: "fade" });

  if (mobileToggle) {
    mobileToggle.addEventListener("click", () => {
      setMobileOpen(!isMobileOpen);
    });
  }

  if (mobileNav) {
    mobileNav.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target ? target.closest("a[href*='#']") : null;
      if (!link) {
        return;
      }

      setMobileOpen(false);
    });
  }

  if (mobileToc) {
    document.addEventListener("click", (event) => {
      if (!isMobileOpen || mobileToc.contains(event.target)) {
        return;
      }

      setMobileOpen(false);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isMobileOpen) {
      return;
    }

    setMobileOpen(false);
    mobileToggle?.focus();
  });

  if (mobileBreakpoint) {
    const handleMobileBreakpoint = (event) => {
      if (!event.matches) {
        setMobileOpen(false);
      }
    };

    if (typeof mobileBreakpoint.addEventListener === "function") {
      mobileBreakpoint.addEventListener("change", handleMobileBreakpoint);
    } else if (typeof mobileBreakpoint.addListener === "function") {
      mobileBreakpoint.addListener(handleMobileBreakpoint);
    }
  }

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleUpdate).catch(() => {});
  }

  scheduleUpdate();
})();
