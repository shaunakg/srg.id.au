
const msg = `
           ******* hi there ******

    this site is built using the Zola SSG
    framework. feel free to explore the
    pages and functionality.

    if you have any questions, feel free
    to reach out to me at <hi@srg.id.au>

    thanks for visiting!

           ***********************

`;

console.log(msg);

// Unique identifier for the user
// Changes every time the user refreshes the page
const clientId = "client-" + btoa(Math.random() * 1e5).replace(/=/g, "");

const format = Intl.NumberFormat().format;

const noc = (document.getElementById("number-of-cursors") || {});
const br_message = (document.getElementById("br-message") || {});
// const ping = (document.getElementById("ping") || {});

function roundTo(n, digits) {
    if (digits === undefined) {
        digits = 0;
    }

    var multiplicator = Math.pow(10, digits);
    n = parseFloat((n * multiplicator).toFixed(11));
    return Math.round(n) / multiplicator;
}

function isTouchDevice() {
    return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0
    );
}

let drawing_colors = {
    lighter: "#D3D3D3", // shown on mouse movement
    darker: "#9c9c9c", // shown on click-and-drag
};

// if (
//     window.matchMedia &&
//     window.matchMedia("(prefers-color-scheme: dark)").matches
// ) {
//     // dark mode
//     document.body.classList.add("dark");
//     drawing_colors = {
//         lighter: "#014242",
//         darker: "#007a7a",
//     };
// }

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let mouseDown = false;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Causes issues on mobile devices where the window can be resized very quickly
// window.onresize = () => {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
// }

// const endpoint = "wss://portfolio-backend.x.srg.id.au/ws";
// const endpoint = "wss://mural.fly.dev/ws";
const endpoint = "wss://public-mural.a.srg.id.au/ws"

let socket;

if (!localStorage.getItem("no-interaction")) {
    socket = new WebSocket(endpoint);
} else {
    console.info("[INFO] Interactive mode disabled.");
    socket = {};
    br_message.innerHTML =
        "Interactivity disabled. <a href='#' onclick='localStorage.removeItem(`no-interaction`);location.reload()'>Re-enable?</a>";
    document.getElementById("canvas-overlay").remove();
}

socket.onopen = function (event) {
    console.info(`[INFO] Client "${clientId}" connected to server`);
}

socket.onerror = function (error) {
    console.error(`[ERROR] ${error.message}`);
    console.error(error);
    document.getElementById("main-footer").innerHTML +=
        " · <span>failed to connect [<a href='.'>retry</a>]</span>";
};

socket.onclose = function (event) {
    console.info("[INFO] Websocket connection closed. Re-open by reloading this page.");
    document.getElementById("main-footer").innerHTML +=
        " · <span>connection closed [<a href='.'>re-open</a>]</span>";
};

// Send a message over the socket every n events
// Prevents the browser from sending too many messages and causing
// the server to lag. There is a transition on the cursor element that
// "smoothly" moves the cursor to the new position.
//
// Decreasing this number will make the transition smoother, but will
// also increase the amount of messages sent to the server.
const sendEvery = {
    draw: 1, // When click-and-dragging, send every event
    move: 2, // When moving the mouse, send every other event. Reduces load, but might make lines more "blocky"
};

// Keep track of the number of clients and sent events.
let events = 0;
let registeredClients = {};

// Track local position for optimistic drawing
let myLastPosition = null;

let totalMessagesReceived = 0;

// Latency tracking (rolling average of last 10 round-trip times)
let latencyHistory = [];
const LATENCY_WINDOW_SIZE = 10;

const latencyStats = document.getElementById("latency-stats");
const latencyValue = document.getElementById("latency-value");

function updateLatencyDisplay(newLatency) {
    // Add to rolling window
    latencyHistory.push(newLatency);
    if (latencyHistory.length > LATENCY_WINDOW_SIZE) {
        latencyHistory.shift();
    }
    
    // Calculate average of recent latencies
    const avgLatency = Math.round(
        latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
    );
    
    if (latencyStats && latencyValue) {
        latencyStats.style.display = "inline";
        latencyValue.innerText = avgLatency;
    }
}

// Draw a line locally (for optimistic updates)
function drawLineLocal(fromX, fromY, toX, toY, isMouseDown) {
    ctx.beginPath();
    ctx.strokeStyle = isMouseDown ? drawing_colors.darker : drawing_colors.lighter;
    ctx.moveTo(fromX * window.innerWidth, fromY * window.innerHeight);
    ctx.lineTo(toX * window.innerWidth, toY * window.innerHeight);
    ctx.stroke();
}

// ============================================
// Smooth cursor/line interpolation with Catmull-Rom splines
// ============================================

// Interpolation settings
const LERP_FACTOR = 0.2;  // How fast cursor moves toward target (0-1, higher = faster)
const POSITION_THRESHOLD = 0.0005; // Stop animating when close enough
const SPLINE_SEGMENTS = 12; // Number of line segments per spline curve

// Store interpolation state for each client
let clientInterp = {};

function initClientInterp(cid, x, y, isMouseDown) {
    clientInterp[cid] = {
        currentX: x,
        currentY: y,
        isMouseDown: isMouseDown,
        // Store recent points for spline interpolation
        // [0]=oldest, [1], [2]=previous, [3]=latest
        pointHistory: [
            { x, y, md: isMouseDown },
            { x, y, md: isMouseDown },
            { x, y, md: isMouseDown },
            { x, y, md: isMouseDown }
        ],
        // Track the last position we drew TO (for continuous lines)
        lastDrawnX: x,
        lastDrawnY: y,
        // Pending segments to draw (queue of {from, to, md} point pairs)
        pendingSegments: []
    };
}

function updateClientTarget(cid, x, y, isMouseDown) {
    if (!clientInterp[cid]) {
        initClientInterp(cid, x, y, isMouseDown);
        return;
    }
    
    const interp = clientInterp[cid];
    const points = interp.pointHistory;
    
    // Queue a segment from previous latest point to new point
    // We'll draw this with smooth interpolation
    interp.pendingSegments.push({
        // For Catmull-Rom: p0, p1, p2, p3 where we draw p1→p2
        // Here p1=previous latest (points[3]), p2=new point
        // p0=points[2] for start tangent
        // p3=extrapolated point for end tangent
        p0: { x: points[2].x, y: points[2].y },
        p1: { x: points[3].x, y: points[3].y },
        p2: { x, y },
        p3: null, // Will extrapolate
        md: isMouseDown,
        progress: 0
    });
    
    // Extrapolate p3 for this segment based on velocity
    const seg = interp.pendingSegments[interp.pendingSegments.length - 1];
    const vx = seg.p2.x - seg.p1.x;
    const vy = seg.p2.y - seg.p1.y;
    seg.p3 = { x: seg.p2.x + vx, y: seg.p2.y + vy };
    
    // Update point history
    points.shift();
    points.push({ x, y, md: isMouseDown });
    interp.isMouseDown = isMouseDown;
}

function removeClientPhysics(cid) {
    delete clientInterp[cid];
}

// Catmull-Rom spline interpolation
// Given 4 points (p0, p1, p2, p3) and t (0-1), returns point on curve between p1 and p2
function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    return {
        x: 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        ),
        y: 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        )
    };
}

// Animation loop for smooth cursor movement and line drawing
let lastFrameTime = 0;
let animationRunning = false;

function animationLoop(currentTime) {
    if (!animationRunning) return;
    
    const deltaTime = Math.min((currentTime - lastFrameTime) / 16.67, 3);
    lastFrameTime = currentTime;
    
    let hasActiveAnimations = false;
    
    for (const cid in clientInterp) {
        if (cid === clientId) continue;
        
        const interp = clientInterp[cid];
        const points = interp.pointHistory;
        const target = points[3]; // Cursor targets the latest point
        
        // Smooth cursor movement with lerp (no overshoot)
        const dx = target.x - interp.currentX;
        const dy = target.y - interp.currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > POSITION_THRESHOLD) {
            const lerpAmount = 1 - Math.pow(1 - LERP_FACTOR, deltaTime);
            interp.currentX += dx * lerpAmount;
            interp.currentY += dy * lerpAmount;
            hasActiveAnimations = true;
        } else {
            interp.currentX = target.x;
            interp.currentY = target.y;
        }
        
        // Update cursor element position
        const cursorEl = document.getElementById(cid);
        if (cursorEl) {
            cursorEl.style.left = interp.currentX * window.innerWidth + "px";
            cursorEl.style.top = interp.currentY * window.innerHeight + "px";
        }
        
        // Process pending line segments
        if (interp.pendingSegments.length > 0) {
            hasActiveAnimations = true;
            
            // Draw from where we left off
            ctx.beginPath();
            ctx.strokeStyle = interp.isMouseDown ? drawing_colors.darker : drawing_colors.lighter;
            ctx.moveTo(interp.lastDrawnX * window.innerWidth, interp.lastDrawnY * window.innerHeight);
            
            // Process segments, potentially completing multiple per frame if we're behind
            let segmentsToRemove = 0;
            
            for (let i = 0; i < interp.pendingSegments.length; i++) {
                const seg = interp.pendingSegments[i];
                const prevProgress = seg.progress;
                
                // Advance progress (faster for older segments to catch up)
                const speedMultiplier = i === 0 ? 1.5 : 1.0;
                seg.progress = Math.min(1.0, seg.progress + 0.25 * deltaTime * speedMultiplier);
                
                // Draw spline points from prevProgress to seg.progress
                const steps = Math.max(1, Math.ceil((seg.progress - prevProgress) * SPLINE_SEGMENTS));
                for (let s = 1; s <= steps; s++) {
                    const t = prevProgress + (seg.progress - prevProgress) * (s / steps);
                    const pt = catmullRom(seg.p0, seg.p1, seg.p2, seg.p3, t);
                    ctx.lineTo(pt.x * window.innerWidth, pt.y * window.innerHeight);
                    interp.lastDrawnX = pt.x;
                    interp.lastDrawnY = pt.y;
                }
                
                if (seg.progress >= 1.0) {
                    segmentsToRemove++;
                } else {
                    // Don't process further segments until this one is done
                    break;
                }
            }
            
            ctx.stroke();
            
            // Remove completed segments
            if (segmentsToRemove > 0) {
                interp.pendingSegments.splice(0, segmentsToRemove);
            }
        }
    }
    
    if (hasActiveAnimations) {
        requestAnimationFrame(animationLoop);
    } else {
        animationRunning = false;
    }
}

function startAnimation() {
    if (!animationRunning) {
        animationRunning = true;
        lastFrameTime = performance.now();
        requestAnimationFrame(animationLoop);
    }
}

const people = () => Object.keys(registeredClients).length;

document.body.onmousemove = (e) => {
    events++;

    let x = e.clientX / window.innerWidth;
    let y = e.clientY / window.innerHeight;

    // Optimistic local drawing - draw immediately
    if (myLastPosition) {
        drawLineLocal(myLastPosition.x, myLastPosition.y, x, y, mouseDown);
    }
    myLastPosition = { x, y };

    if (
        socket.readyState === 1 &&
        events % sendEvery[mouseDown ? "draw" : "move"] === 0
    ) {
        socket.send(
            JSON.stringify({
                x: x,
                y: y,
                cid: clientId,
                type: "mousemove",
                md: mouseDown,
                t: Date.now(),
            })
        );
    }
};

document.body.onmousedown = (e) => {
    mouseDown = true;

    let x = e.clientX / window.innerWidth;
    let y = e.clientY / window.innerHeight;

    // Optimistic local drawing - draw a point immediately
    if (myLastPosition) {
        drawLineLocal(myLastPosition.x, myLastPosition.y, x, y, mouseDown);
    }
    myLastPosition = { x, y };

    if (socket.readyState === 1) {
        socket.send(
            JSON.stringify({
                x: x,
                y: y,
                cid: clientId,
                type: "mousedown",
                md: mouseDown,
                t: Date.now(),
            })
        );
    }
};

document.body.onmouseup = (e) => {
    mouseDown = false;

    let x = e.clientX / window.innerWidth;
    let y = e.clientY / window.innerHeight;

    if (socket.readyState === 1) {
        socket.send(
            JSON.stringify({
                x: x,
                y: y,
                cid: clientId,
                type: "mouseup",
                md: mouseDown,
                t: Date.now(),
            })
        );
    }
};

socket.onmessage = ({ data }) => {
    totalMessagesReceived++;
    // recieved_count.innerText = format(
    //     totalMessagesReceived
    // );

    try {
        data = JSON.parse(data);
    } catch (e) {
        data = JSON.parse(data.split("\n")[0]);
    }

    let txtime = Date.now() - data.t;

    // Track latency for our own messages (round-trip time)
    if (data.cid === clientId && txtime >= 0) {
        updateLatencyDisplay(txtime);
    }

    if (!(data.cid in registeredClients)) {
        registeredClients[data.cid] = {};

        const cursor = document.createElement("img");
        cursor.src = "/cursor.png";
        cursor.classList.add("cursor");
        cursor.id = data.cid;

        document.getElementById("cursors-overlay").appendChild(cursor);
        
        // Initialize interpolation for new client
        initClientInterp(data.cid, data.x, data.y, data.md);
    }

    noc.innerText =
        people() + " " + (people() === 1 ? "person" : "people");

    const cursor = document.getElementById(data.cid);

    if (data.cid === clientId) {
        cursor.style.display = "none";
        // Skip drawing for our own messages - we already drew locally (optimistic update)
        // Just update the last position tracking for server state
        registeredClients[data.cid].time = Date.now();
        registeredClients[data.cid].lastPosition = {
            x: data.x,
            y: data.y,
        };
        return;
    }

    // Update physics target for smooth interpolation (other clients only)
    updateClientTarget(data.cid, data.x, data.y, data.md);
    startAnimation();

    switch (data.type) {
        case "mousemove":
            cursor.classList.add("move");
            break;
        case "mousedown":
            cursor.classList.add("down");
            break;
        case "mouseup":
            cursor.classList.remove("down");
            break;
    }

    registeredClients[data.cid].time = Date.now();
    registeredClients[data.cid].lastPosition = {
        x: data.x,
        y: data.y,
    };
};

const removeInactiveClients = setInterval(() => {
    for (let cid in registeredClients) {
        if (Date.now() - registeredClients[cid].time > 5000) {
            document.getElementById(cid).remove();
            delete registeredClients[cid];
            removeClientPhysics(cid); // Clean up physics state
        }
    }

    noc.innerText =
        people() + " " + (people() === 1 ? "person" : "people");
}, 500);

localStorage.getItem("no-interaction") && clearInterval(removeInactiveClients);

// If shift + esc is pressed, clear the canvas and disconnect from the server
document.body.onkeydown = (e) => {
    if (e.shiftKey && e.key == "Escape") {
        if (document.getElementById("canvas-overlay")) {
            console.info("[INFO] User requested to end interactive mode.");
            socket.close();
            document.getElementById("canvas-overlay").remove();
            clearInterval(removeInactiveClients);
        } else {
            localStorage.setItem("no-interaction", true);
        }
        e.preventDefault();
    }
};

// document.querySelectorAll("a").forEach((e) => {
//     if (e.href && e.href != "#") {
//         e.outerHTML = `${e.outerHTML}<span class="location"> (${e.href})</span>`;
//     }
// });

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\-\-+/g, "-") // Replace multiple - with single -
        .replace(/^-+/, "") // Trim - from start of text
        .replace(/-+$/, ""); // Trim - from end of text
}

// if (document.getElementById("toc")) {
//     document.getElementById("toc").style.paddingInlineStart = "16px";
//     document.getElementById("toc").style.fontSize = "0.9em";

//     document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((x, i) => {

//         x.id = x.id || slugify(x.innerText);
//         let title = x.innerText;
//         let link = "#" + x.id;

//         let li = document.createElement("li");
//         li.innerText = title;

//         let a = document.createElement("a");
//         a.innerText = " #";
//         a.href = link;
//         a.style.textDecoration = "none";

//         li.appendChild(a.cloneNode(true));
//         x.appendChild(a.cloneNode(true));

//         document.getElementById("toc").appendChild(li);

//         li.style.margin = "0 0";
//         li.style.marginLeft = ((parseInt(x.tagName[1]) - 1) * 15).toString() + "px";

//     });
// }