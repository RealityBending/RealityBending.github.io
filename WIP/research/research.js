import { RESEARCH_CONTENT } from "./research-content.js"
import { initMarginTabNav, swapTabPanels } from "../shared/tab-slide.js"
;(function () {
    const root = document.getElementById("research-root")
    if (!root) return

    const tabs = Array.isArray(RESEARCH_CONTENT.tabs) ? RESEARCH_CONTENT.tabs.filter((tab) => tab && tab.id && tab.label) : []
    if (!tabs.length) return

    function createCard(card) {
        const article = document.createElement("article")
        article.className = "research-card"

        if (card.meta) {
            const meta = document.createElement("div")
            meta.className = "research-card__meta"
            meta.textContent = card.meta
            article.appendChild(meta)
        }

        if (card.title) {
            const title = document.createElement("h3")
            title.className = "research-card__title"
            title.textContent = card.title
            article.appendChild(title)
        }

        if (card.text) {
            const text = document.createElement("p")
            text.className = "research-card__text"
            text.textContent = card.text
            article.appendChild(text)
        }

        if (Array.isArray(card.bullets) && card.bullets.length) {
            const list = document.createElement("ul")
            list.className = "research-card__list"
            card.bullets.filter(Boolean).forEach((bullet) => {
                const item = document.createElement("li")
                item.textContent = bullet
                list.appendChild(item)
            })
            article.appendChild(list)
        }

        return article
    }

    function createPanel(tab, index) {
        const panel = document.createElement("div")
        panel.className = "research-tab-panel"
        panel.id = "research-tab-" + tab.id
        panel.setAttribute("role", "tabpanel")
        panel.setAttribute("aria-labelledby", "research-tab-btn-" + tab.id)
        panel.hidden = index !== 0

        const header = document.createElement("div")
        header.className = "research-tab-header"

        if (tab.eyebrow) {
            const eyebrow = document.createElement("div")
            eyebrow.className = "research-tab-eyebrow"
            eyebrow.textContent = tab.eyebrow
            header.appendChild(eyebrow)
        }

        if (tab.heading) {
            const heading = document.createElement("h3")
            heading.className = "research-tab-heading"
            heading.textContent = tab.heading
            header.appendChild(heading)
        }

        if (tab.lede) {
            const lede = document.createElement("p")
            lede.className = "research-tab-lede"
            lede.textContent = tab.lede
            header.appendChild(lede)
        }

        panel.appendChild(header)

        if (Array.isArray(tab.paragraphs) && tab.paragraphs.length) {
            const copy = document.createElement("div")
            copy.className = "research-tab-copy"
            tab.paragraphs.filter(Boolean).forEach((paragraph) => {
                const p = document.createElement("p")
                p.textContent = paragraph
                copy.appendChild(p)
            })
            panel.appendChild(copy)
        }

        if (Array.isArray(tab.cards) && tab.cards.length) {
            const grid = document.createElement("div")
            grid.className = "research-card-grid"
            tab.cards.forEach((card) => grid.appendChild(createCard(card)))
            panel.appendChild(grid)
        }

        return panel
    }

    const shell = document.createElement("div")
    shell.className = "research-shell"

    const title = document.createElement("h2")
    title.className = "research-full__title"
    title.textContent = RESEARCH_CONTENT.title || "Research"
    shell.appendChild(title)

    if (RESEARCH_CONTENT.intro) {
        const intro = document.createElement("p")
        intro.className = "research-full__intro"
        intro.textContent = RESEARCH_CONTENT.intro
        shell.appendChild(intro)
    }

    const nav = document.createElement("div")
    nav.className = "research-tabs-nav"
    nav.setAttribute("role", "tablist")
    nav.setAttribute("aria-label", "Research views")

    const panelHost = document.createElement("div")
    panelHost.className = "research-panels"

    const buttons = []
    const panels = []

    function activateTab(tabId) {
        buttons.forEach((button) => {
            const isActive = button.dataset.tab === tabId
            button.classList.toggle("research-tab-btn--active", isActive)
            button.setAttribute("aria-selected", isActive ? "true" : "false")
        })
        swapTabPanels(panels, "research-tab-" + tabId)
    }

    tabs.forEach((tab, index) => {
        const button = document.createElement("button")
        button.type = "button"
        button.id = "research-tab-btn-" + tab.id
        button.className = "research-tab-btn" + (index === 0 ? " research-tab-btn--active" : "")
        button.dataset.tab = tab.id
        button.setAttribute("role", "tab")
        button.setAttribute("aria-selected", index === 0 ? "true" : "false")
        button.setAttribute("aria-controls", "research-tab-" + tab.id)
        button.textContent = tab.label
        button.addEventListener("click", () => activateTab(tab.id))
        nav.appendChild(button)
        buttons.push(button)

        const panel = createPanel(tab, index)
        panelHost.appendChild(panel)
        panels.push(panel)
    })

    shell.appendChild(nav)
    shell.appendChild(panelHost)
    root.replaceChildren(shell)

    initMarginTabNav(document.querySelector(".research-full"), ".research-tab-btn")
})()
