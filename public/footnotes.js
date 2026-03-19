(() => {
  const layout = document.querySelector(".post-layout");
  if (!layout) {
    return;
  }

  const article = layout.querySelector(".post-article");
  if (!article) {
    return;
  }

  let references = Array.from(
    article.querySelectorAll("sup.footnote-reference a[href^='#'], sup a[data-footnote-ref][href^='#']")
  );

  if (references.length === 0) {
    references = Array.from(
      article.querySelectorAll("a.footnote-reference[href^='#'], a[data-footnote-ref][href^='#']")
    );
  }

  if (references.length === 0) {
    return;
  }

  const leftRail = layout.querySelector(".footnote-rail.left");
  const rightRail = layout.querySelector(".footnote-rail.right");
  const modal = document.getElementById("footnote-modal");
  const modalContent = modal ? modal.querySelector("[data-footnote-content]") : null;
  const modalNumber = modal ? modal.querySelector("[data-footnote-number]") : null;
  const modalCloseButtons = modal
    ? Array.from(modal.querySelectorAll("[data-footnote-close]"))
    : [];

  const footnoteMap = new Map();
  const definitionNodes = Array.from(
    article.querySelectorAll(".footnote-definition[id]")
  );

  if (definitionNodes.length > 0) {
    definitionNodes.forEach((item) => {
      const clone = item.cloneNode(true);
      const label = clone.querySelector(".footnote-definition-label");
      if (label) {
        label.remove();
      }
      footnoteMap.set(item.id, clone.innerHTML.trim());
    });
  } else {
    const footnotesSection = article.querySelector(
      ".footnotes, section.footnotes, div.footnotes"
    );
    if (!footnotesSection) {
      return;
    }
    Array.from(footnotesSection.querySelectorAll("li[id]")).forEach((item) => {
      const clone = item.cloneNode(true);
      const backref = clone.querySelector("a.footnote-backref, a[data-footnote-backref], a.data-footnote-backref");
      if (backref) {
        backref.remove();
      }
      footnoteMap.set(item.id, clone.innerHTML.trim());
    });
  }

  const notes = [];

  const numberToWord = (value) => {
    const words = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
    ];
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < words.length) {
      return words[parsed];
    }
    return value;
  };

  references.forEach((ref, index) => {
    const href = ref.getAttribute("href") || "";
    const id = href.startsWith("#") ? href.slice(1) : href;
    const content = footnoteMap.get(id);
    if (!content) {
      return;
    }

    const side = "right";
    const note = document.createElement("aside");
    note.className = "sidenote";
    note.dataset.footnoteId = id;
    note.dataset.side = side;
    const number = ref.textContent.trim();
    const numberWord = numberToWord(number);

    note.innerHTML =
      '<div class="sidenote-inner">' +
      '<div class="sidenote-header">Note <span class="sidenote-number">' +
      numberWord +
      "</span></div>" +
      '<div class="sidenote-body">' +
      content +
      "</div>" +
      "</div>";

    if (side === "left" && leftRail) {
      leftRail.appendChild(note);
    } else if (rightRail) {
      rightRail.appendChild(note);
    }

    notes.push({ ref, note, side, id, number, numberWord });
  });

  document.body.classList.add("footnotes-enhanced");

  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  const clearActive = () => {
    notes.forEach(({ ref, note }) => {
      ref.classList.remove("is-active");
      note.classList.remove("is-active");
    });
  };

  const activate = (id) => {
    clearActive();
    notes.forEach(({ ref, note, id: noteId }) => {
      if (noteId === id) {
        ref.classList.add("is-active");
        note.classList.add("is-active");
      }
    });
  };

  const positionNotes = () => {
    if (!leftRail && !rightRail) {
      return;
    }

    const layoutRect = layout.getBoundingClientRect();
    const minGap = 14;
    const railState = { left: 0, right: 0 };
    const leftRailRect = leftRail ? leftRail.getBoundingClientRect() : null;
    const rightRailRect = rightRail ? rightRail.getBoundingClientRect() : null;

    notes.forEach((entry) => {
      const { ref, note } = entry;
      const refRect = ref.getBoundingClientRect();
      const anchorTop = refRect.top - layoutRect.top + refRect.height * 0.5;
      const anchorX = refRect.left + refRect.width * 0.5;
      let side = entry.side;

      if (leftRailRect && rightRailRect) {
        const distanceLeft = Math.abs(anchorX - leftRailRect.right);
        const distanceRight = Math.abs(rightRailRect.left - anchorX);
        side = distanceLeft <= distanceRight ? "left" : "right";
      } else if (leftRailRect) {
        side = "left";
      } else if (rightRailRect) {
        side = "right";
      }

      if (side !== entry.side) {
        entry.side = side;
        if (side === "left" && leftRail) {
          leftRail.appendChild(note);
        } else if (rightRail) {
          rightRail.appendChild(note);
        }
      }
      const noteHeight = note.offsetHeight || 0;
      let top = anchorTop - noteHeight * 0.5;

      const minTop = railState[side] || 0;
      if (top < minTop) {
        top = minTop;
      }

      note.style.top = `${top}px`;
      railState[side] = top + note.offsetHeight + minGap;
    });
  };

  let resizeTimer = null;
  const schedulePosition = () => {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(positionNotes, 80);
  };

  window.addEventListener("resize", schedulePosition);
  window.addEventListener("load", positionNotes);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(positionNotes).catch(() => {});
  }

  requestAnimationFrame(positionNotes);

  const openModal = (id, number) => {
    if (!modal || !modalContent) {
      return;
    }
    const content = footnoteMap.get(id) || "";
    modalContent.innerHTML = content;
    if (modalNumber) {
      modalNumber.textContent = number || "";
    }
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("footnote-modal-open");
  };

  const closeModal = () => {
    if (!modal) {
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("footnote-modal-open");
  };

  if (modal) {
    modalCloseButtons.forEach((button) => {
      button.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.matches("[data-footnote-close]")) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });
  }

  notes.forEach(({ ref, note, id, number }) => {
    ref.addEventListener("mouseenter", () => {
      if (!isMobile()) {
        activate(id);
      }
    });

    ref.addEventListener("mouseleave", () => {
      if (!isMobile()) {
        clearActive();
      }
    });

    ref.addEventListener("click", (event) => {
      if (isMobile()) {
        event.preventDefault();
        openModal(id, number);
        return;
      }
      event.preventDefault();
      activate(id);
    });

    note.addEventListener("mouseenter", () => {
      if (!isMobile()) {
        activate(id);
      }
    });

    note.addEventListener("mouseleave", () => {
      if (!isMobile()) {
        clearActive();
      }
    });
  });

  const handleHash = () => {
    const hash = window.location.hash || "";
    if (!hash.startsWith("#fn")) {
      return;
    }
    const id = hash.slice(1);
    const matching = notes.find((item) => item.id === id);
    if (!matching) {
      return;
    }

    if (isMobile()) {
      openModal(id, matching.number);
      return;
    }

    matching.ref.scrollIntoView({ block: "center", behavior: "smooth" });
    activate(id);
  };

  window.addEventListener("hashchange", handleHash);
  handleHash();
})();
