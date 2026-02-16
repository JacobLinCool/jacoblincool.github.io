<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import type { BackgroundEventType } from '$lib/types/background';

    type NeuralNode = {
        x: number;
        y: number;
        energy: number;
        displayEnergy: number;
        speed: number;
        velocityX: number;
        velocityY: number;
        turnSpeed: number;
        turnPhase: number;
        neighbors: number[];
    };

    type NeuralEdge = {
        a: number;
        b: number;
    };

    type NeuralGraph = {
        width: number;
        height: number;
        overscanX: number;
        overscanY: number;
        worldWidth: number;
        worldHeight: number;
        nodes: NeuralNode[];
        edges: NeuralEdge[];
    };

    const DESKTOP_NODE_COUNT = 200;
    const MOBILE_MIN_NODE_COUNT = 140;
    const MOBILE_STEP_NODE_COUNT = 20;
    const EDGE_NEIGHBOR_COUNT = 4;
    const PROPAGATION_HOP_DELAY_MS = 90;
    const PROPAGATION_HOP_DECAY = 0.62;
    const PROPAGATION_MAX_HOPS = 4;
    const ENERGY_DECAY_MS = 500;
    const DISPLAY_SMOOTHING_MS = 120;
    const EDGE_DISTANCE_RATIO = 0.18;
    const EDGE_REBUILD_INTERVAL_MS = 900;
    const NODE_SPEED_MIN = 0.002;
    const NODE_SPEED_MAX = 0.006;
    const OVERSCAN_RATIO = 0.08;
    const OVERSCAN_MIN = 32;
    const OVERSCAN_MAX = 120;

    const EDGE_BASE_ALPHA = 0.04;
    const EDGE_ACTIVE_ALPHA = 0.28;
    const EDGE_BASE_WIDTH = 0.72;
    const EDGE_ACTIVE_WIDTH = 1.1;
    const NODE_BASE_RADIUS = 1.0;
    const NODE_ACTIVE_RADIUS = 2.0;
    const NODE_BASE_ALPHA = 0.14;
    const NODE_BASE_GLOW = 0.9;
    const NODE_ACTIVE_GLOW = 12;
    const MIN_ENERGY_EPSILON = 0.0006;

    let {
        backgroundEventId = 0,
        backgroundEventType = 'idle',
        backgroundEventStrength = 0,
        isStreaming = false
    }: {
        backgroundEventId?: number;
        backgroundEventType?: BackgroundEventType;
        backgroundEventStrength?: number;
        isStreaming?: boolean;
    } = $props();

    let containerEl = $state<HTMLDivElement | null>(null);
    let canvasEl = $state<HTMLCanvasElement | null>(null);

    let context: CanvasRenderingContext2D | null = null;
    let graph: NeuralGraph | null = null;
    let animationFrameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let pendingResizeFrame: number | null = null;
    let propagationTimers: ReturnType<typeof setTimeout>[] = [];
    let reduceMotionMedia: MediaQueryList | null = null;
    let prefersReducedMotion = false;

    let isMobileDevice = false;
    let dynamicNodeCount = DESKTOP_NODE_COUNT;
    let fpsSamples: Array<{ time: number; fps: number }> = [];
    let lastAdaptiveCheck = 0;
    let lastEdgeRebuildTime = 0;

    let lastFrameTime = 0;
    let smoothedStreaming = 0;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const clearPropagationTimers = () => {
        for (const timer of propagationTimers) {
            clearTimeout(timer);
        }
        propagationTimers = [];
    };

    const detectMobileDevice = () => {
        if (!browser) {
            return false;
        }

        return (
            window.matchMedia('(max-width: 768px)').matches ||
            window.matchMedia('(pointer: coarse)').matches
        );
    };

    const toroidalDelta = (from: number, to: number, span: number) => {
        let delta = to - from;
        if (delta > span * 0.5) {
            delta -= span;
        } else if (delta < -span * 0.5) {
            delta += span;
        }
        return delta;
    };

    const toroidalDistance = (
        leftX: number,
        leftY: number,
        rightX: number,
        rightY: number,
        width: number,
        height: number
    ) => {
        const dx = toroidalDelta(leftX, rightX, width);
        const dy = toroidalDelta(leftY, rightY, height);
        return Math.hypot(dx, dy);
    };

    const calculateResidualEnergy = (source: NeuralGraph | null) => {
        if (!source || source.nodes.length === 0) {
            return 0;
        }

        const total = source.nodes.reduce((sum, node) => sum + node.displayEnergy, 0);
        const average = total / source.nodes.length;
        return clamp(average * 0.45, 0, 0.18);
    };

    const buildNodes = (
        count: number,
        width: number,
        height: number,
        overscanX: number,
        overscanY: number,
        residualEnergy: number
    ) => {
        const minVisibleX = -overscanX;
        const maxVisibleX = width + overscanX;
        const minVisibleY = -overscanY;
        const maxVisibleY = height + overscanY;
        const usableWidth = Math.max(1, maxVisibleX - minVisibleX);
        const usableHeight = Math.max(1, maxVisibleY - minVisibleY);
        const columns = Math.max(1, Math.ceil(Math.sqrt((count * usableWidth) / usableHeight)));
        const rows = Math.max(1, Math.ceil(count / columns));
        const cellWidth = usableWidth / columns;
        const cellHeight = usableHeight / rows;

        const nodes: NeuralNode[] = [];

        for (let index = 0; index < count; index += 1) {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const jitterX = (Math.random() - 0.5) * cellWidth * 0.62;
            const jitterY = (Math.random() - 0.5) * cellHeight * 0.62;
            const xVisible = clamp(
                minVisibleX + (col + 0.5) * cellWidth + jitterX,
                minVisibleX,
                maxVisibleX
            );
            const yVisible = clamp(
                minVisibleY + (row + 0.5) * cellHeight + jitterY,
                minVisibleY,
                maxVisibleY
            );
            const direction = Math.random() * Math.PI * 2;
            const speed = prefersReducedMotion
                ? 0
                : NODE_SPEED_MIN + Math.random() * (NODE_SPEED_MAX - NODE_SPEED_MIN);
            const baseEnergy = residualEnergy * (0.65 + Math.random() * 0.7);

            nodes.push({
                // Store positions in world coordinates to support seamless overscan wrapping.
                x: xVisible + overscanX,
                y: yVisible + overscanY,
                energy: baseEnergy,
                displayEnergy: baseEnergy,
                speed,
                velocityX: Math.cos(direction),
                velocityY: Math.sin(direction),
                turnSpeed: prefersReducedMotion ? 0 : 0.0013 + Math.random() * 0.0014,
                turnPhase: Math.random() * Math.PI * 2,
                neighbors: []
            });
        }

        return nodes;
    };

    const buildEdges = (
        nodes: NeuralNode[],
        worldWidth: number,
        worldHeight: number,
        viewportWidth: number,
        viewportHeight: number
    ) => {
        const maxDistance = Math.min(viewportWidth, viewportHeight) * EDGE_DISTANCE_RATIO;
        const edges: NeuralEdge[] = [];
        const seenPairs: Record<string, true> = {};

        for (let i = 0; i < nodes.length; i += 1) {
            const distances: Array<{ index: number; distance: number }> = [];
            for (let j = 0; j < nodes.length; j += 1) {
                if (i === j) {
                    continue;
                }

                const distance = toroidalDistance(
                    nodes[i].x,
                    nodes[i].y,
                    nodes[j].x,
                    nodes[j].y,
                    worldWidth,
                    worldHeight
                );
                distances.push({ index: j, distance });
            }

            distances.sort((left, right) => left.distance - right.distance);

            let linked = 0;
            for (const candidate of distances) {
                if (candidate.distance > maxDistance) {
                    break;
                }

                const a = Math.min(i, candidate.index);
                const b = Math.max(i, candidate.index);
                const key = `${a}-${b}`;
                if (!seenPairs[key]) {
                    seenPairs[key] = true;
                    edges.push({ a, b });
                }

                linked += 1;
                if (linked >= EDGE_NEIGHBOR_COUNT) {
                    break;
                }
            }
        }

        for (const node of nodes) {
            node.neighbors = [];
        }

        for (const edge of edges) {
            nodes[edge.a].neighbors.push(edge.b);
            nodes[edge.b].neighbors.push(edge.a);
        }

        return edges;
    };

    const rebuildGraph = (count: number, residualEnergy = 0) => {
        if (!containerEl || !context) {
            return;
        }

        const width = Math.max(1, Math.floor(containerEl.clientWidth));
        const height = Math.max(1, Math.floor(containerEl.clientHeight));
        const overscan = clamp(
            Math.min(width, height) * OVERSCAN_RATIO,
            OVERSCAN_MIN,
            OVERSCAN_MAX
        );
        const overscanX = overscan;
        const overscanY = overscan;
        const worldWidth = width + overscanX * 2;
        const worldHeight = height + overscanY * 2;
        const nodes = buildNodes(count, width, height, overscanX, overscanY, residualEnergy);
        const edges = buildEdges(nodes, worldWidth, worldHeight, width, height);
        graph = { width, height, overscanX, overscanY, worldWidth, worldHeight, nodes, edges };
        lastEdgeRebuildTime = 0;
    };

    const syncEnvironment = () => {
        isMobileDevice = detectMobileDevice();
        if (!isMobileDevice) {
            dynamicNodeCount = DESKTOP_NODE_COUNT;
        }
    };

    const syncCanvasSize = () => {
        if (!containerEl || !canvasEl) {
            return;
        }

        const width = Math.max(1, Math.floor(containerEl.clientWidth));
        const height = Math.max(1, Math.floor(containerEl.clientHeight));
        const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

        const nextPixelWidth = Math.floor(width * dpr);
        const nextPixelHeight = Math.floor(height * dpr);
        if (canvasEl.width !== nextPixelWidth || canvasEl.height !== nextPixelHeight) {
            canvasEl.width = nextPixelWidth;
            canvasEl.height = nextPixelHeight;
        }

        if (!context) {
            context = canvasEl.getContext('2d');
        }

        if (!context) {
            return;
        }

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const targetCount = isMobileDevice ? dynamicNodeCount : DESKTOP_NODE_COUNT;
        const needsGraphReset =
            !graph ||
            graph.width !== width ||
            graph.height !== height ||
            graph.nodes.length !== targetCount;
        if (needsGraphReset) {
            const residualEnergy = calculateResidualEnergy(graph);
            clearPropagationTimers();
            rebuildGraph(targetCount, residualEnergy);
        }
    };

    const energizeNode = (index: number, power: number) => {
        if (!graph || index < 0 || index >= graph.nodes.length) {
            return;
        }

        const nextEnergy = clamp(power, 0, 1);
        const node = graph.nodes[index];
        node.energy = Math.max(node.energy, nextEnergy);
        node.displayEnergy = Math.max(node.displayEnergy, nextEnergy * 0.55);
    };

    const propagateFromSeed = (seedIndex: number) => {
        if (!graph) {
            return;
        }

        energizeNode(seedIndex, 1);
        if (prefersReducedMotion) {
            return;
        }

        const visited = new Uint8Array(graph.nodes.length);
        visited[seedIndex] = 1;
        let frontier = [seedIndex];

        for (let hop = 1; hop <= PROPAGATION_MAX_HOPS; hop += 1) {
            const nextFrontier: number[] = [];
            for (const sourceIndex of frontier) {
                for (const neighborIndex of graph.nodes[sourceIndex].neighbors) {
                    if (visited[neighborIndex]) {
                        continue;
                    }

                    visited[neighborIndex] = 1;
                    nextFrontier.push(neighborIndex);
                }
            }

            if (nextFrontier.length === 0) {
                break;
            }

            const hopEnergy = Math.pow(PROPAGATION_HOP_DECAY, hop);
            const delayMs = hop * PROPAGATION_HOP_DELAY_MS;
            const timer = setTimeout(() => {
                for (const targetIndex of nextFrontier) {
                    const variance = 0.85 + Math.random() * 0.3;
                    energizeNode(targetIndex, hopEnergy * variance);
                }
            }, delayMs);

            propagationTimers = [...propagationTimers, timer];
            frontier = nextFrontier;
        }
    };

    const activateByRatio = (ratio: number) => {
        if (!graph) {
            return;
        }

        const clampedRatio = clamp(ratio, 0, 1);
        if (clampedRatio <= 0) {
            return;
        }

        const nodeCount = graph.nodes.length;
        const seedCount = clamp(Math.round(nodeCount * clampedRatio), 1, nodeCount);
        const picked = new Uint8Array(nodeCount);
        let activated = 0;

        while (activated < seedCount) {
            const candidate = Math.floor(Math.random() * nodeCount);
            if (picked[candidate]) {
                continue;
            }

            picked[candidate] = 1;
            activated += 1;
            propagateFromSeed(candidate);
        }
    };

    const drawWrappedEdge = (
        ctx: CanvasRenderingContext2D,
        sourceGraph: NeuralGraph,
        leftX: number,
        leftY: number,
        rightX: number,
        rightY: number
    ) => {
        const dx = toroidalDelta(leftX, rightX, sourceGraph.worldWidth);
        const dy = toroidalDelta(leftY, rightY, sourceGraph.worldHeight);
        const targetX = leftX + dx;
        const targetY = leftY + dy;
        const drawFromX = leftX - sourceGraph.overscanX;
        const drawFromY = leftY - sourceGraph.overscanY;
        const drawToX = targetX - sourceGraph.overscanX;
        const drawToY = targetY - sourceGraph.overscanY;

        ctx.beginPath();
        ctx.moveTo(drawFromX, drawFromY);
        ctx.lineTo(drawToX, drawToY);
        ctx.stroke();

        const wrapOffsetX =
            targetX < 0
                ? sourceGraph.worldWidth
                : targetX > sourceGraph.worldWidth
                  ? -sourceGraph.worldWidth
                  : 0;
        const wrapOffsetY =
            targetY < 0
                ? sourceGraph.worldHeight
                : targetY > sourceGraph.worldHeight
                  ? -sourceGraph.worldHeight
                  : 0;
        if (wrapOffsetX === 0 && wrapOffsetY === 0) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(drawFromX + wrapOffsetX, drawFromY + wrapOffsetY);
        ctx.lineTo(drawToX + wrapOffsetX, drawToY + wrapOffsetY);
        ctx.stroke();
    };

    const renderGraph = () => {
        if (!graph || !context || !canvasEl) {
            return;
        }

        context.clearRect(0, 0, graph.width, graph.height);

        for (const edge of graph.edges) {
            const left = graph.nodes[edge.a];
            const right = graph.nodes[edge.b];
            const activity = (left.displayEnergy + right.displayEnergy) * 0.5;
            const alpha = clamp(
                EDGE_BASE_ALPHA + activity * EDGE_ACTIVE_ALPHA + smoothedStreaming * 0.03,
                0,
                0.8
            );
            const width = EDGE_BASE_WIDTH + activity * EDGE_ACTIVE_WIDTH;

            context.strokeStyle = `rgba(125, 211, 252, ${alpha.toFixed(3)})`;
            context.lineWidth = width;
            drawWrappedEdge(context, graph, left.x, left.y, right.x, right.y);
        }

        for (const node of graph.nodes) {
            const activity = node.displayEnergy;
            const radius =
                NODE_BASE_RADIUS + activity * NODE_ACTIVE_RADIUS + smoothedStreaming * 0.22;
            const alpha = clamp(
                NODE_BASE_ALPHA + activity * 0.58 + smoothedStreaming * 0.04,
                0.08,
                1
            );
            const glow = NODE_BASE_GLOW + activity * NODE_ACTIVE_GLOW + smoothedStreaming * 2.6;
            const drawX = node.x - graph.overscanX;
            const drawY = node.y - graph.overscanY;

            context.beginPath();
            context.arc(drawX, drawY, radius, 0, Math.PI * 2);
            context.fillStyle = `rgba(186, 230, 253, ${alpha.toFixed(3)})`;
            context.shadowColor = 'rgba(56, 189, 248, 0.8)';
            context.shadowBlur = glow;
            context.fill();
        }

        context.shadowBlur = 0;
    };

    const updateNodeStates = (now: number, dt: number) => {
        if (!graph) {
            return;
        }

        const decayFactor = Math.exp(-dt / ENERGY_DECAY_MS);
        const blend = 1 - Math.exp(-dt / DISPLAY_SMOOTHING_MS);
        const streamTarget = isStreaming ? 1 : 0;
        smoothedStreaming += (streamTarget - smoothedStreaming) * (1 - Math.exp(-dt / 220));

        for (const node of graph.nodes) {
            node.energy *= decayFactor;
            if (node.energy < MIN_ENERGY_EPSILON) {
                node.energy = 0;
            }

            node.displayEnergy += (node.energy - node.displayEnergy) * blend;
            if (Math.abs(node.displayEnergy) < MIN_ENERGY_EPSILON) {
                node.displayEnergy = 0;
            }

            if (prefersReducedMotion || node.speed === 0) {
                continue;
            }

            const turnAmount = Math.sin(now * node.turnSpeed + node.turnPhase) * 0.00038 * dt;
            const cosTurn = Math.cos(turnAmount);
            const sinTurn = Math.sin(turnAmount);
            const rotatedX = node.velocityX * cosTurn - node.velocityY * sinTurn;
            const rotatedY = node.velocityX * sinTurn + node.velocityY * cosTurn;
            const magnitude = Math.hypot(rotatedX, rotatedY) || 1;
            node.velocityX = rotatedX / magnitude;
            node.velocityY = rotatedY / magnitude;

            const speedScale = 1 + smoothedStreaming * 0.16;
            const distance = node.speed * dt * speedScale;
            node.x += node.velocityX * distance;
            node.y += node.velocityY * distance;

            if (node.x < 0) {
                node.x += graph.worldWidth;
            } else if (node.x >= graph.worldWidth) {
                node.x -= graph.worldWidth;
            }

            if (node.y < 0) {
                node.y += graph.worldHeight;
            } else if (node.y >= graph.worldHeight) {
                node.y -= graph.worldHeight;
            }
        }
    };

    const maybeRebuildEdges = (now: number) => {
        if (!graph || prefersReducedMotion) {
            return;
        }

        if (now - lastEdgeRebuildTime < EDGE_REBUILD_INTERVAL_MS) {
            return;
        }

        graph.edges = buildEdges(
            graph.nodes,
            graph.worldWidth,
            graph.worldHeight,
            graph.width,
            graph.height
        );
        lastEdgeRebuildTime = now;
    };

    const updateAdaptiveDensity = (now: number, dt: number) => {
        if (!graph || !isMobileDevice || prefersReducedMotion) {
            return;
        }

        const fps = 1000 / Math.max(dt, 1);
        fpsSamples = [...fpsSamples, { time: now, fps }].filter(
            (sample) => sample.time >= now - 2000
        );

        if (now - lastAdaptiveCheck < 2000 || fpsSamples.length < 12) {
            return;
        }

        lastAdaptiveCheck = now;
        const averageFps =
            fpsSamples.reduce((sum, sample) => sum + sample.fps, 0) / fpsSamples.length;
        let nextCount = dynamicNodeCount;

        if (averageFps < 45 && dynamicNodeCount > MOBILE_MIN_NODE_COUNT) {
            nextCount = Math.max(MOBILE_MIN_NODE_COUNT, dynamicNodeCount - MOBILE_STEP_NODE_COUNT);
        } else if (averageFps > 56 && dynamicNodeCount < DESKTOP_NODE_COUNT) {
            nextCount = Math.min(DESKTOP_NODE_COUNT, dynamicNodeCount + MOBILE_STEP_NODE_COUNT);
        }

        if (nextCount === dynamicNodeCount) {
            return;
        }

        dynamicNodeCount = nextCount;
        const residualEnergy = calculateResidualEnergy(graph);
        clearPropagationTimers();
        rebuildGraph(dynamicNodeCount, residualEnergy);
    };

    const animationLoop = (timestamp: number) => {
        if (!context || !graph) {
            animationFrameId = requestAnimationFrame(animationLoop);
            return;
        }

        if (lastFrameTime === 0) {
            lastFrameTime = timestamp;
        }

        const dt = clamp(timestamp - lastFrameTime, 1, 64);
        lastFrameTime = timestamp;

        updateAdaptiveDensity(timestamp, dt);
        updateNodeStates(timestamp, dt);
        maybeRebuildEdges(timestamp);
        renderGraph();
        animationFrameId = requestAnimationFrame(animationLoop);
    };

    const handleResize = () => {
        syncEnvironment();
        syncCanvasSize();
    };

    $effect(() => {
        const eventToken = backgroundEventId;
        if (!browser || eventToken <= 0) {
            return;
        }

        if (backgroundEventType === 'idle') {
            return;
        }

        activateByRatio(backgroundEventStrength);
    });

    onMount(() => {
        if (!browser || !canvasEl || !containerEl) {
            return;
        }

        context = canvasEl.getContext('2d');
        if (!context) {
            return;
        }

        reduceMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
        prefersReducedMotion = reduceMotionMedia.matches;
        const onReducedMotionChange = (event: MediaQueryListEvent) => {
            prefersReducedMotion = event.matches;
            const residualEnergy = calculateResidualEnergy(graph);
            rebuildGraph(isMobileDevice ? dynamicNodeCount : DESKTOP_NODE_COUNT, residualEnergy);
        };
        reduceMotionMedia.addEventListener('change', onReducedMotionChange);

        syncEnvironment();
        syncCanvasSize();
        animationFrameId = requestAnimationFrame(animationLoop);

        resizeObserver = new ResizeObserver(() => {
            if (pendingResizeFrame !== null) {
                cancelAnimationFrame(pendingResizeFrame);
            }

            pendingResizeFrame = requestAnimationFrame(() => {
                pendingResizeFrame = null;
                handleResize();
            });
        });
        resizeObserver.observe(containerEl);
        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            reduceMotionMedia?.removeEventListener('change', onReducedMotionChange);
            window.removeEventListener('resize', handleResize);
            resizeObserver?.disconnect();
            if (pendingResizeFrame !== null) {
                cancelAnimationFrame(pendingResizeFrame);
                pendingResizeFrame = null;
            }
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            clearPropagationTimers();
        };
    });
</script>

<div bind:this={containerEl} aria-hidden="true" class="neural-root">
    <div class="neural-fallback"></div>
    <canvas bind:this={canvasEl} class="neural-canvas"></canvas>
</div>

<style>
    .neural-root {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
    }

    .neural-fallback {
        position: absolute;
        inset: 0;
        background: radial-gradient(100% 85% at 50% 50%, #05060a 0%, #020306 70%, #010204 100%);
    }

    .neural-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }
</style>
