;(function () {
    const GRAPH_PATH = "collaborations/data_graph.json"
    const COLLABORATORS_MANIFEST_PATH = "collaborations/collaborations_manifest.json"
    const ROOT_NAME = "Dominique Makowski"
    const NS = "http://www.w3.org/2000/svg"
    const VIEWBOX = { x: 0, y: 0, width: 2100, height: 1450 }
    const LAYOUT_PADDING = 120
    const LANDING_LABEL_IMPORTANCE = 0.48
    const MAX_ZOOM = 7
    const GROUP_COLORS = [
        "#ff2f70",
        "#ff5a36",
        "#2f80ed",
        "#8b5cf6",
        "#facc15",
        "#7ac943",
        "#06b6d4",
        "#f97316",
        "#ec4899",
        "#4361ee",
        "#7c3aed",
        "#14b8a6",
    ]

    const networkContainer = document.getElementById("collaboration-network")
    const closeCollaboratorsSection = document.getElementById("close-collaborators-section")
    const closeCollaboratorsContainer = document.getElementById("close-collaborators")
    const consultantsSection = document.getElementById("consultants-section")
    const consultantsContainer = document.getElementById("consultants")

    if (!networkContainer && !closeCollaboratorsContainer && !consultantsContainer) return

    function createSvgNode(tag) {
        return document.createElementNS(NS, tag)
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value))
    }

    function pairKey(a, b) {
        return a < b ? a + "-" + b : b + "-" + a
    }

    function deterministicUnit(seed) {
        const value = Math.sin(seed * 12.9898) * 43758.5453123
        return value - Math.floor(value)
    }

    function deterministicAngle(seed) {
        return deterministicUnit(seed) * Math.PI * 2
    }

    function getGroupColor(group) {
        const number = Number.parseInt(group, 10)
        if (Number.isFinite(number) && number > 0) {
            return GROUP_COLORS[(number - 1) % GROUP_COLORS.length]
        }
        return GROUP_COLORS[0]
    }

    function dedupeEdges(edges) {
        const unique = new Map()

        edges.forEach((edge) => {
            const from = Number(edge.from)
            const to = Number(edge.to)
            if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return

            const key = pairKey(from, to)
            const current = unique.get(key)
            const importance = Number(edge.importance) || 0

            if (!current || importance > current.importance) {
                unique.set(key, {
                    key,
                    from: Math.min(from, to),
                    to: Math.max(from, to),
                    importance,
                })
            }
        })

        return Array.from(unique.values())
    }

    function createGroupAnchors(groups, rootGroup, groupStats) {
        const anchors = new Map()
        const slots = [
            { x: -250, y: -230 },
            { x: 260, y: -170 },
            { x: -360, y: 200 },
            { x: 430, y: 120 },
            { x: -620, y: -170 },
            { x: 620, y: -250 },
            { x: -80, y: 370 },
            { x: 690, y: 330 },
            { x: -750, y: 150 },
            { x: 130, y: -410 },
            { x: -450, y: 430 },
            { x: 820, y: 20 },
        ]

        anchors.set(rootGroup, { x: 0, y: 0 })

        const sortedGroups = groups
            .filter((group) => group !== rootGroup)
            .sort((left, right) => {
                const leftStats = groupStats.get(left)
                const rightStats = groupStats.get(right)
                if ((rightStats?.directCount || 0) !== (leftStats?.directCount || 0)) {
                    return (rightStats?.directCount || 0) - (leftStats?.directCount || 0)
                }
                if ((rightStats?.totalDegree || 0) !== (leftStats?.totalDegree || 0)) {
                    return (rightStats?.totalDegree || 0) - (leftStats?.totalDegree || 0)
                }
                return (Number(left) || 0) - (Number(right) || 0)
            })

        sortedGroups.forEach((group, index) => {
            if (index < slots.length) {
                anchors.set(group, slots[index])
                return
            }

            const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(sortedGroups.length, 1)
            anchors.set(group, {
                x: Math.cos(angle) * 850,
                y: Math.sin(angle) * 520,
            })
        })

        return anchors
    }

    function initialisePositions(nodes, root, groupAnchors, directIds) {
        nodes.forEach((node) => {
            if (node.id === root.id) {
                node.x = 0
                node.y = 0
                node.vx = 0
                node.vy = 0
                return
            }

            const groupSeed = Number.parseInt(node.group, 10) || 0
            const anchor = groupAnchors.get(node.group) || { x: 0, y: 0 }
            const angle = deterministicAngle(node.id * 17 + groupSeed * 31)
            const baseSpread = node.group === root.group ? 110 : 70
            const randomSpread = 36 + deterministicUnit(node.id * 29 + groupSeed * 13) * 150
            const spread = baseSpread + randomSpread + (directIds.has(node.id) ? 18 : 0)

            node.x = anchor.x + Math.cos(angle) * spread
            node.y = anchor.y + Math.sin(angle) * spread * 0.78
            node.vx = 0
            node.vy = 0
        })
    }

    function runLayout(nodes, edges, root, groupAnchors, directIds, nodeById) {
        const repulsion = 18000
        const damping = 0.84
        const maxVelocity = 20

        for (let step = 0; step < 240; step += 1) {
            nodes.forEach((node) => {
                node.fx = 0
                node.fy = 0
            })

            for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
                const first = nodes[firstIndex]

                for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
                    const second = nodes[secondIndex]
                    const dx = second.x - first.x
                    const dy = second.y - first.y
                    const distanceSquared = dx * dx + dy * dy + 0.01
                    const distance = Math.sqrt(distanceSquared)
                    let force = repulsion / distanceSquared

                    if (first.group === second.group) {
                        force *= 0.62
                    }

                    if (first.id === root.id || second.id === root.id) {
                        force *= 1.16
                    }

                    const fx = (dx / distance) * force
                    const fy = (dy / distance) * force

                    first.fx -= fx
                    first.fy -= fy
                    second.fx += fx
                    second.fy += fy
                }
            }

            edges.forEach((edge) => {
                const from = nodeById.get(edge.from)
                const to = nodeById.get(edge.to)
                if (!from || !to) return

                const dx = to.x - from.x
                const dy = to.y - from.y
                const distance = Math.sqrt(dx * dx + dy * dy) || 0.001

                let desiredLength = edge.sameGroup ? 82 : 148
                let strength = edge.sameGroup ? 0.0105 : 0.0068

                if (edge.from === root.id || edge.to === root.id) {
                    desiredLength = 92 - edge.weight * 26
                    strength = 0.0165
                } else {
                    desiredLength -= edge.weight * (edge.sameGroup ? 18 : 26)
                    strength *= 0.55 + edge.weight
                }

                const stretch = distance - desiredLength
                const fx = (dx / distance) * stretch * strength
                const fy = (dy / distance) * stretch * strength

                from.fx += fx
                from.fy += fy
                to.fx -= fx
                to.fy -= fy
            })

            nodes.forEach((node) => {
                if (node.id === root.id) {
                    node.x = 0
                    node.y = 0
                    node.vx = 0
                    node.vy = 0
                    return
                }

                const anchor = groupAnchors.get(node.group) || { x: 0, y: 0 }
                const anchorStrength = node.group === root.group ? 0.0035 : 0.0065 + (directIds.has(node.id) ? 0.0025 : 0)

                node.fx += (anchor.x - node.x) * anchorStrength
                node.fy += (anchor.y - node.y) * anchorStrength
                node.fx += -node.x * 0.0012
                node.fy += -node.y * 0.0012

                node.vx = (node.vx + node.fx) * damping
                node.vy = (node.vy + node.fy) * damping
                node.x += clamp(node.vx, -maxVelocity, maxVelocity)
                node.y += clamp(node.vy, -maxVelocity, maxVelocity)
            })
        }
    }

    function normaliseLayout(nodes) {
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        nodes.forEach((node) => {
            minX = Math.min(minX, node.x)
            minY = Math.min(minY, node.y)
            maxX = Math.max(maxX, node.x)
            maxY = Math.max(maxY, node.y)
        })

        const width = Math.max(maxX - minX, 1)
        const height = Math.max(maxY - minY, 1)
        const scale = Math.min((VIEWBOX.width - LAYOUT_PADDING * 2) / width, (VIEWBOX.height - LAYOUT_PADDING * 2) / height)

        nodes.forEach((node) => {
            node.x = LAYOUT_PADDING + (node.x - minX) * scale
            node.y = LAYOUT_PADDING + (node.y - minY) * scale
        })
    }

    function styleNodesAndEdges(nodes, edges, root, directIds) {
        const minCloseness = Math.min(...nodes.map((node) => node.closeness), 0)
        const maxCloseness = Math.max(...nodes.map((node) => node.closeness), 0.001)
        const minDegree = Math.min(...nodes.map((node) => node.degree), 0)
        const maxDegree = Math.max(...nodes.map((node) => node.degree), 0.001)
        const minImportance = Math.min(...edges.map((edge) => edge.importance), 0)
        const maxImportance = Math.max(...edges.map((edge) => edge.importance), 1)
        const closenessRange = Math.max(maxCloseness - minCloseness, 0.001)
        const degreeRange = Math.max(maxDegree - minDegree, 0.001)

        edges.forEach((edge) => {
            const importanceRatio =
                maxImportance === minImportance ? 1 : (edge.importance - minImportance) / (maxImportance - minImportance)
            edge.weight = importanceRatio
            edge.strokeWidth = edge.from === root.id || edge.to === root.id ? 1.25 + importanceRatio * 2.6 : 0.45 + importanceRatio * 1.2
        })

        const rawImportanceById = new Map()

        nodes.forEach((node) => {
            const degreeRatio = (node.degree - minDegree) / degreeRange
            const closenessRatio = (node.closeness - minCloseness) / closenessRange
            const directBoost = directIds.has(node.id) ? 0.14 : 0

            if (node.id === root.id) {
                rawImportanceById.set(node.id, 1)
            } else {
                rawImportanceById.set(node.id, degreeRatio * 0.72 + closenessRatio * 0.18 + directBoost)
            }
        })

        const nonRootRawValues = nodes.filter((node) => node.id !== root.id).map((node) => rawImportanceById.get(node.id) || 0)
        const minRawImportance = Math.min(...nonRootRawValues, 0)
        const maxRawImportance = Math.max(...nonRootRawValues, 1)
        const rawImportanceRange = Math.max(maxRawImportance - minRawImportance, 0.001)

        nodes.forEach((node) => {
            if (node.id === root.id) {
                node.importance = 1
            } else {
                const normalisedImportance = ((rawImportanceById.get(node.id) || 0) - minRawImportance) / rawImportanceRange
                node.importance = 0.035 + normalisedImportance * 0.925
            }

            const baseRadius = node.id === root.id ? 18 : 2.6 + node.importance * 9.2

            node.radius = node.id === root.id ? 18 : clamp(baseRadius, 2.6, 11.8)
            node.color = node.id === root.id ? "#f72568" : getGroupColor(node.group)
            node.isDirect = directIds.has(node.id)
            node.isProminent = node.isDirect || node.importance >= 0.55
            node.labelAnchor = node.x >= root.x ? "start" : "end"
            node.labelOffset = node.radius + (node.isDirect ? 7 : 4)
            node.labelDx = node.labelAnchor === "start" ? node.labelOffset : -node.labelOffset
            node.labelDy = 4
            node.labelSize = clamp(7.8 + node.importance * 10.8, 8.2, 18.2)
        })
    }

    function buildNetwork(graph) {
        const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : []
        const nodes = rawNodes.map((node, index) => ({
            id: index + 1,
            name: String(node?.name || "Collaborator"),
            group: String(node?.group || "1"),
            closeness: Number(node?.closeness) || 0,
            degree: Number(node?.degree) || 0,
        }))

        if (!nodes.length) return null

        const nodeById = new Map(nodes.map((node) => [node.id, node]))
        const edges = dedupeEdges(Array.isArray(graph.edges) ? graph.edges : []).filter(
            (edge) => nodeById.has(edge.from) && nodeById.has(edge.to),
        )

        if (!edges.length) return null

        const root = nodes.find((node) => node.name === ROOT_NAME) || nodes[0]
        const groups = Array.from(new Set(nodes.map((node) => node.group)))
        const directIds = new Set()
        const groupStats = new Map(groups.map((group) => [group, { count: 0, totalDegree: 0, directCount: 0 }]))

        nodes.forEach((node) => {
            const stats = groupStats.get(node.group)
            if (!stats) return
            stats.count += 1
            stats.totalDegree += node.degree
        })

        edges.forEach((edge) => {
            const from = nodeById.get(edge.from)
            const to = nodeById.get(edge.to)
            edge.sameGroup = Boolean(from && to && from.group === to.group)

            if (edge.from === root.id || edge.to === root.id) {
                directIds.add(edge.from === root.id ? edge.to : edge.from)
            }
        })

        directIds.forEach((id) => {
            const node = nodeById.get(id)
            if (!node) return
            const stats = groupStats.get(node.group)
            if (stats) {
                stats.directCount += 1
            }
        })

        const groupAnchors = createGroupAnchors(groups, root.group, groupStats)
        initialisePositions(nodes, root, groupAnchors, directIds)
        styleNodesAndEdges(nodes, edges, root, directIds)
        runLayout(nodes, edges, root, groupAnchors, directIds, nodeById)
        normaliseLayout(nodes)
        styleNodesAndEdges(nodes, edges, root, directIds)

        return {
            nodes,
            edges,
            root,
            directIds,
            groupCount: groups.length,
        }
    }

    function renderEmptyState(message) {
        networkContainer.innerHTML = ""

        const state = document.createElement("div")
        state.className = "collaboration-network__empty"
        state.textContent = message
        networkContainer.appendChild(state)
    }

    function normaliseCollaboratorEntries(entries, fallbackAffiliation) {
        return Array.isArray(entries)
            ? entries
                  .map((entry) => ({
                      name: String(entry?.name || "").trim(),
                      image: String(entry?.image || "").trim(),
                      affiliation: String(entry?.affiliation || fallbackAffiliation || "").trim(),
                      interests: Array.isArray(entry?.interests) ? entry.interests : [],
                      education: Array.isArray(entry?.education) ? entry.education : [],
                  }))
                  .filter((entry) => entry.name && entry.image)
            : []
    }

    function stripAffiliationMarkup(value) {
        return String(value || "")
            .replace(/<br\s*\/?>/gi, ", ")
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim()
    }

    function formatAffiliationMarkup(value) {
        return String(value || "")
            .split(/<br\s*\/?>/gi)
            .map((part) => part.trim())
            .filter(Boolean)
            .join("<br>")
    }

    function renderPeopleSection(section, container, entries) {
        if (!container) return

        container.innerHTML = ""

        if (!entries.length) {
            if (section) {
                section.hidden = true
            }
            return
        }

        entries.forEach((entry) => {
            const card = document.createElement("article")
            card.className = "collaboration-person"
            card.tabIndex = 0
            if (entry.affiliation) {
                card.setAttribute("aria-label", entry.name + ", " + stripAffiliationMarkup(entry.affiliation))
            } else {
                card.setAttribute("aria-label", entry.name)
            }

            // Open minimal profile panel on click/Enter (shared with people.js)
            const openMinimal = () => {
                if (window._labProfile?.openMinimal) {
                    window._labProfile.openMinimal({
                        name: entry.name,
                        avatar: entry.image,
                        details: stripAffiliationMarkup(entry.affiliation || ""),
                        interests: entry.interests || [],
                        education: entry.education || [],
                    })
                }
            }
            card.addEventListener("click", openMinimal)
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openMinimal()
                }
            })
            card.style.cursor = "pointer"

            const photoWrap = document.createElement("div")
            photoWrap.className = "collaboration-person__photo-wrap"

            const photo = document.createElement("img")
            photo.className = "collaboration-person__photo"
            photo.src = entry.image
            photo.alt = entry.name
            photo.loading = "lazy"
            photo.decoding = "async"
            photoWrap.appendChild(photo)

            const body = document.createElement("div")
            body.className = "collaboration-person__body"

            const name = document.createElement("h4")
            name.className = "collaboration-person__name"
            name.textContent = entry.name

            const meta = document.createElement("p")
            meta.className = "collaboration-person__meta"
            meta.innerHTML = formatAffiliationMarkup(entry.affiliation || "Affiliation coming soon")

            body.append(name, meta)
            card.append(photoWrap, body)
            container.appendChild(card)
        })

        if (section) {
            section.hidden = false
        }
    }

    function renderCollaborationsManifest(manifest) {
        renderPeopleSection(
            closeCollaboratorsSection,
            closeCollaboratorsContainer,
            normaliseCollaboratorEntries(manifest?.close_collaborators, "Affiliation coming soon"),
        )
        renderPeopleSection(consultantsSection, consultantsContainer, normaliseCollaboratorEntries(manifest?.consultants, "Consultant"))
    }

    function enablePanZoom(svg, onInteractionStart, onViewChange) {
        const baseViewBox = { ...VIEWBOX }
        const camera = { ...baseViewBox }
        const aspectRatio = baseViewBox.height / baseViewBox.width
        let dragState = null

        function applyViewBox() {
            svg.setAttribute("viewBox", [camera.x, camera.y, camera.width, camera.height].map((value) => value.toFixed(2)).join(" "))
            if (onViewChange) {
                onViewChange(baseViewBox.width / camera.width)
            }
        }

        function clampCamera() {
            camera.width = clamp(camera.width, baseViewBox.width / MAX_ZOOM, baseViewBox.width)
            camera.height = camera.width * aspectRatio

            const maxX = baseViewBox.x + baseViewBox.width - camera.width
            const maxY = baseViewBox.y + baseViewBox.height - camera.height

            camera.x = clamp(camera.x, baseViewBox.x, maxX)
            camera.y = clamp(camera.y, baseViewBox.y, maxY)
        }

        svg.addEventListener(
            "wheel",
            (event) => {
                event.preventDefault()

                const rect = svg.getBoundingClientRect()
                const pointerX = camera.x + ((event.clientX - rect.left) / rect.width) * camera.width
                const pointerY = camera.y + ((event.clientY - rect.top) / rect.height) * camera.height
                const nextWidth = clamp(camera.width * (event.deltaY < 0 ? 0.88 : 1.12), baseViewBox.width / MAX_ZOOM, baseViewBox.width)
                const nextHeight = nextWidth * aspectRatio
                const ratioX = (pointerX - camera.x) / camera.width
                const ratioY = (pointerY - camera.y) / camera.height

                camera.x = pointerX - ratioX * nextWidth
                camera.y = pointerY - ratioY * nextHeight
                camera.width = nextWidth
                camera.height = nextHeight

                clampCamera()
                applyViewBox()
            },
            { passive: false },
        )

        svg.addEventListener("pointerdown", (event) => {
            if (event.target instanceof Element && event.target.closest(".collaboration-network__node")) {
                return
            }

            if (onInteractionStart) {
                onInteractionStart()
            }
            dragState = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: camera.x,
                startY: camera.y,
            }
            svg.setPointerCapture(event.pointerId)
            networkContainer.classList.add("is-dragging")
        })

        svg.addEventListener("pointermove", (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return

            const rect = svg.getBoundingClientRect()
            const deltaX = ((event.clientX - dragState.startClientX) / rect.width) * camera.width
            const deltaY = ((event.clientY - dragState.startClientY) / rect.height) * camera.height

            camera.x = dragState.startX - deltaX
            camera.y = dragState.startY - deltaY

            clampCamera()
            applyViewBox()
        })

        function endDrag(event) {
            if (!dragState || dragState.pointerId !== event.pointerId) return

            dragState = null
            networkContainer.classList.remove("is-dragging")
            if (svg.hasPointerCapture(event.pointerId)) {
                svg.releasePointerCapture(event.pointerId)
            }
        }

        svg.addEventListener("pointerup", endDrag)
        svg.addEventListener("pointercancel", endDrag)
        applyViewBox()
    }

    function renderNetwork(network) {
        networkContainer.innerHTML = ""

        const svg = createSvgNode("svg")
        svg.classList.add("collaboration-network__svg")
        svg.setAttribute("role", "img")
        svg.setAttribute("aria-label", "Full collaboration network graph")

        const edgeLayer = createSvgNode("g")
        const nodeLayer = createSvgNode("g")
        const labelLayer = createSvgNode("g")

        svg.appendChild(edgeLayer)
        svg.appendChild(nodeLayer)
        svg.appendChild(labelLayer)

        const nodeById = new Map(network.nodes.map((node) => [node.id, node]))
        const adjacency = new Map(network.nodes.map((node) => [node.id, new Set()]))
        const rendered = new Map()
        const renderedEdges = []
        let hoveredId = null
        let selectedId = null
        let connectedNodeIds = new Set()

        network.edges.forEach((edge) => {
            adjacency.get(edge.from)?.add(edge.to)
            adjacency.get(edge.to)?.add(edge.from)
        })

        const nonRootNodes = network.nodes.filter((node) => node.id !== network.root.id)
        const minNodeImportance = Math.min(...nonRootNodes.map((node) => node.importance), 0)
        const landingLabelImportance = Math.max(LANDING_LABEL_IMPORTANCE, minNodeImportance)

        function getImportanceThreshold(zoomLevel) {
            const zoomProgress = clamp((zoomLevel - 1) / (MAX_ZOOM - 1), 0, 1)
            return minNodeImportance + Math.pow(1 - zoomProgress, 2.2) * (landingLabelImportance - minNodeImportance)
        }

        function updateLabelVisibility(zoomLevel) {
            const importanceThreshold = getImportanceThreshold(zoomLevel)

            rendered.forEach((item) => {
                if (!item.label) return

                const shouldShow = item.node.importance >= importanceThreshold
                item.label.classList.toggle("is-visible", shouldShow)
            })
        }

        function syncNodeState(item) {
            if (!item) return

            const isHovered = item.node.id === hoveredId
            const isSelected = item.node.id === selectedId
            const isConnected = connectedNodeIds.has(item.node.id)
            const isDimmed = selectedId !== null && !isHovered && !isSelected && !isConnected

            item.group.classList.toggle("is-hovered", isHovered)
            item.group.classList.toggle("is-selected", isSelected)
            item.group.classList.toggle("is-connected", !isSelected && isConnected)
            item.group.classList.toggle("is-dimmed", isDimmed)
            item.group.setAttribute("aria-pressed", isSelected ? "true" : "false")

            if (item.label) {
                item.label.classList.toggle("is-revealed", isHovered || isSelected || isConnected)
                item.label.classList.toggle("is-emphasized", isHovered || isSelected)
                item.label.classList.toggle("is-dimmed", isDimmed)
            }
        }

        function syncEdgeState(item) {
            const isSelectedEdge = selectedId !== null && (item.edge.from === selectedId || item.edge.to === selectedId)

            item.line.classList.toggle("is-selected", isSelectedEdge)
            item.line.classList.toggle("is-dimmed", selectedId !== null && !isSelectedEdge)
        }

        function syncInteractionState() {
            rendered.forEach((item) => {
                syncNodeState(item)
            })

            renderedEdges.forEach((item) => {
                syncEdgeState(item)
            })
        }

        function setHoveredNode(nextId) {
            if (hoveredId === nextId) return

            hoveredId = nextId
            syncInteractionState()
        }

        function setSelectedNode(nextId) {
            selectedId = selectedId === nextId ? null : nextId
            connectedNodeIds = selectedId === null ? new Set() : new Set(adjacency.get(selectedId) || [])
            syncInteractionState()
        }

        network.edges.forEach((edge) => {
            const from = nodeById.get(edge.from)
            const to = nodeById.get(edge.to)
            if (!from || !to) return

            const line = createSvgNode("line")
            line.classList.add("collaboration-network__edge")
            if (edge.sameGroup) {
                line.classList.add("collaboration-network__edge--intra")
            }
            if (edge.from === network.root.id || edge.to === network.root.id) {
                line.classList.add("collaboration-network__edge--root")
            }
            line.setAttribute("x1", from.x.toFixed(2))
            line.setAttribute("y1", from.y.toFixed(2))
            line.setAttribute("x2", to.x.toFixed(2))
            line.setAttribute("y2", to.y.toFixed(2))
            line.setAttribute("stroke-width", edge.strokeWidth.toFixed(2))
            edgeLayer.appendChild(line)
            renderedEdges.push({ edge, line })
        })

        const sortedNodes = network.nodes.slice().sort((left, right) => {
            if (left.id === network.root.id) return 1
            if (right.id === network.root.id) return -1
            return left.radius - right.radius
        })

        sortedNodes.forEach((node) => {
            const group = createSvgNode("g")
            group.classList.add("collaboration-network__node")
            group.setAttribute("role", "button")
            group.setAttribute("aria-label", node.name)
            group.setAttribute("aria-pressed", "false")
            group.setAttribute("tabindex", "0")

            const title = createSvgNode("title")
            title.textContent = node.name
            group.appendChild(title)

            const halo = createSvgNode("circle")
            halo.classList.add("collaboration-network__node-halo")
            halo.setAttribute("cx", node.x.toFixed(2))
            halo.setAttribute("cy", node.y.toFixed(2))
            halo.setAttribute("r", (node.radius + 10).toFixed(2))
            group.appendChild(halo)

            const circle = createSvgNode("circle")
            circle.classList.add("collaboration-network__node-core")
            if (node.id === network.root.id) {
                circle.classList.add("collaboration-network__node-core--root")
            }
            circle.setAttribute("cx", node.x.toFixed(2))
            circle.setAttribute("cy", node.y.toFixed(2))
            circle.setAttribute("r", node.radius.toFixed(2))
            circle.setAttribute("fill", node.color)
            group.appendChild(circle)
            nodeLayer.appendChild(group)

            group.addEventListener("pointerenter", () => {
                setHoveredNode(node.id)
            })

            group.addEventListener("pointerleave", () => {
                if (hoveredId === node.id) {
                    setHoveredNode(null)
                }
            })

            group.addEventListener("click", (event) => {
                event.stopPropagation()
                setSelectedNode(node.id)
            })

            group.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") return

                event.preventDefault()
                setSelectedNode(node.id)
            })

            const label = createSvgNode("text")
            label.classList.add("collaboration-network__label")
            if (node.isDirect) {
                label.classList.add("collaboration-network__label--direct")
            } else if (node.isProminent) {
                label.classList.add("collaboration-network__label--prominent")
            }
            label.setAttribute("x", (node.x + node.labelDx).toFixed(2))
            label.setAttribute("y", (node.y + node.labelDy).toFixed(2))
            label.setAttribute("text-anchor", node.labelAnchor)
            label.setAttribute("font-size", node.labelSize.toFixed(1))
            label.textContent = node.name
            labelLayer.appendChild(label)

            rendered.set(node.id, { node, group, label })
        })

        svg.addEventListener("click", (event) => {
            if (event.target === svg) {
                setSelectedNode(null)
            }
        })

        svg.addEventListener("pointerleave", () => {
            setHoveredNode(null)
        })

        networkContainer.appendChild(svg)
        syncInteractionState()
        enablePanZoom(
            svg,
            () => {
                setHoveredNode(null)
            },
            (zoomLevel) => {
                updateLabelVisibility(zoomLevel)
            },
        )
    }

    if (closeCollaboratorsContainer || consultantsContainer) {
        fetch(COLLABORATORS_MANIFEST_PATH, { cache: "no-store" })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Could not load close collaborators.")
                }

                return response.json()
            })
            .then((manifest) => {
                renderCollaborationsManifest(manifest)
            })
            .catch(() => {
                if (closeCollaboratorsSection) {
                    closeCollaboratorsSection.hidden = true
                }
                if (consultantsSection) {
                    consultantsSection.hidden = true
                }
            })
    }

    if (!networkContainer) return

    fetch(GRAPH_PATH, { cache: "no-store" })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Could not load collaboration graph data.")
            }

            return response.json()
        })
        .then((graph) => {
            const network = buildNetwork(graph)
            if (!network) {
                renderEmptyState("No collaboration graph could be built from the current data.")
                return
            }

            renderNetwork(network)
        })
        .catch(() => {
            renderEmptyState("The collaboration graph could not be loaded from the current data.")
        })
})()
