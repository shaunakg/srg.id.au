(function () {
    const roots = document.querySelectorAll("[data-subscribe-root]");
    if (!roots.length) return;

    const MIN_LOADING_MS = 420;
    const LOADING_EXIT_MS = 180;
    const ERROR_RESET_MS = 2600;

    function delay(ms) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, ms);
        });
    }

    function setTone(root, tone) {
        root.classList.remove("is-success", "is-error");
        if (tone === "success") root.classList.add("is-success");
        if (tone === "error") root.classList.add("is-error");
    }

    function readErrorMessage(payload) {
        if (payload && typeof payload.message === "string" && payload.message.trim() !== "") {
            return payload.message.trim();
        }
        return "sorry, that didn't work. please try again.";
    }

    for (const root of roots) {
        const form = root.querySelector("[data-subscribe-form]");
        const emailInput = root.querySelector(".newsletter-email");
        const statusNode = root.querySelector("[data-subscribe-status]");
        const loadingNode = root.querySelector("[data-subscribe-loading]");
        const submitButton = root.querySelector(".newsletter-submit");
        const endpoint = root.getAttribute("data-subscribe-endpoint") || "/api/subscribe";
        const source = root.getAttribute("data-subscribe-source") || "unknown";
        let errorResetTimer = null;

        if (!form || !emailInput || !statusNode || !loadingNode || !submitButton) continue;

        function setPhase(phase) {
            root.setAttribute("data-phase", phase);
            loadingNode.setAttribute("aria-hidden", phase === "submitting" ? "false" : "true");
            statusNode.setAttribute("aria-hidden", phase === "result" ? "false" : "true");
        }

        function clearErrorResetTimer() {
            if (errorResetTimer !== null) {
                window.clearTimeout(errorResetTimer);
                errorResetTimer = null;
            }
        }

        function resetToIdle() {
            clearVisualState();
            setPhase("idle");
            emailInput.focus();
        }

        function scheduleErrorReset() {
            clearErrorResetTimer();
            errorResetTimer = window.setTimeout(function () {
                errorResetTimer = null;
                if (root.getAttribute("data-phase") === "result" && root.classList.contains("is-error")) {
                    resetToIdle();
                }
            }, ERROR_RESET_MS);
        }

        function setBusy(isBusy) {
            emailInput.disabled = isBusy;
            submitButton.disabled = isBusy;
            if (isBusy) {
                submitButton.setAttribute("aria-busy", "true");
            } else {
                submitButton.removeAttribute("aria-busy");
            }
        }

        function clearVisualState() {
            root.classList.remove("is-loading-exit", "is-result");
            setTone(root, null);
            statusNode.textContent = "";
        }

        function showImmediateError(message) {
            clearVisualState();
            setTone(root, "error");
            statusNode.textContent = message;
            root.classList.add("is-result");
            setPhase("result");
            scheduleErrorReset();
        }

        setPhase(root.getAttribute("data-phase") || "idle");

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (root.getAttribute("data-phase") === "submitting") return;

            const email = emailInput.value.trim();
            if (!email) {
                showImmediateError("enter your email first.");
                return;
            }

            if (!emailInput.checkValidity()) {
                showImmediateError("please enter a valid email.");
                return;
            }

            clearVisualState();
            clearErrorResetTimer();
            setPhase("submitting");
            setBusy(true);

            const startedAt = performance.now();
            let tone = "success";
            let message = "you are in. thank you.";
            let shouldReset = true;

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        email,
                        source,
                        page_url: window.location.href,
                    }),
                });

                const payload = await response.json().catch(function () {
                    return {};
                });

                if (!response.ok) {
                    throw new Error(readErrorMessage(payload));
                }

                if (payload.already_subscribed) {
                    message = "already subscribed. thank you :)";
                } else {
                    message = "you are in. thank you.";
                }
            } catch (error) {
                tone = "error";
                shouldReset = false;
                message = error && error.message
                    ? error.message
                    : "sorry, something went wrong. please try again.";
            } finally {
                setBusy(false);
            }

            const elapsed = performance.now() - startedAt;
            if (elapsed < MIN_LOADING_MS) {
                await delay(MIN_LOADING_MS - elapsed);
            }

            root.classList.add("is-loading-exit");
            await delay(LOADING_EXIT_MS);
            root.classList.remove("is-loading-exit");

            if (shouldReset) {
                form.reset();
            }

            setTone(root, tone);
            statusNode.textContent = message;
            root.classList.add("is-result");
            setPhase("result");

            if (tone === "error") {
                scheduleErrorReset();
            } else {
                clearErrorResetTimer();
            }
        });

        root.addEventListener("click", function () {
            if (root.getAttribute("data-phase") === "result" && root.classList.contains("is-error")) {
                clearErrorResetTimer();
                resetToIdle();
            }
        });
    }
})();
