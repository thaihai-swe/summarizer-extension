(function () {
    let observer = null;
    let activeLinks = [];

    function clearObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        activeLinks = [];
    }

    function setActive(targetId) {
        activeLinks.forEach((link) => {
            const isActive = link.dataset.target === targetId;
            link.classList.toggle("is-active", isActive);
            if (isActive) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        });
    }

    function revealDestination(target) {
        if (!target) return;
        const body = target.querySelector(".section-body");
        const toggle = target.querySelector(".section-toggle");
        if (body && body.hidden) {
            body.hidden = false;
            if (toggle) {
                toggle.setAttribute("aria-expanded", "true");
                toggle.setAttribute("aria-label", "Collapse " + (toggle.querySelector(".toggle-label")?.textContent || "section"));
                const icon = toggle.querySelector(".toggle-icon");
                if (icon) icon.textContent = "\u25bc";
            }
        }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function build(elements, result) {
        clearObserver();
        const host = elements && elements.resultToc;
        const list = elements && elements.resultTocList;
        if (!host || !list) return;

        list.innerHTML = "";
        const isLong = String(result?.expansionMode || "").toLowerCase() === "deep"
            || String(result?.summarySize || "").toLowerCase() === "deep"
            || String(result?.summaryLength || "").toLowerCase() === "long";
        const destinations = Array.from(document.querySelectorAll("[data-toc-label][id]"));
        if (!result || !isLong || destinations.length < 4) {
            host.hidden = true;
            return;
        }

        destinations.forEach((target) => {
            const item = document.createElement("li");
            const link = document.createElement("button");
            link.type = "button";
            link.className = "result-toc-link";
            link.dataset.target = target.id;
            link.setAttribute("aria-controls", target.id);
            link.textContent = target.dataset.tocLabel;
            link.addEventListener("click", () => revealDestination(target));
            item.appendChild(link);
            list.appendChild(item);
            activeLinks.push(link);
        });

        host.hidden = false;
        const shell = elements.shell || document.querySelector(".panel-shell");
        observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
            if (visible[0]) setActive(visible[0].target.id);
        }, {
            root: shell || null,
            rootMargin: "-96px 0px -62% 0px",
            threshold: [0, 0.1, 0.5]
        });
        destinations.forEach((target) => observer.observe(target));
        setActive(destinations[0].id);
    }

    function reset(elements) {
        clearObserver();
        if (elements?.resultToc) elements.resultToc.hidden = true;
        if (elements?.resultTocList) elements.resultTocList.innerHTML = "";
    }

    globalThis.SummarizerSidepanelToc = { build, reset };
})();
