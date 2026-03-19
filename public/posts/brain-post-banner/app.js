import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const banner = document.getElementById("banner");
const canvasRoot = document.getElementById("canvas");
const title = document.getElementById("title");
const overlay = document.getElementById("overlay");
const statusButton = document.getElementById("status");
const hint = document.getElementById("hint");
const labelLines = document.getElementById("labelLines");
const labelBoxes = document.getElementById("labelBoxes");

const SEQUENCE_DELAY_MS = 2000;
let sequenceDelayId = null;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
camera.position.set(0, -340, 160);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);
canvasRoot.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTexture;

const brainGroup = new THREE.Group();
scene.add(brainGroup);
brainGroup.visible = false;

let pointerDirty = false;
const controls = new TrackballControls(camera, renderer.domElement);
controls.noPan = true;
controls.staticMoving = false;
controls.dynamicDampingFactor = 0.06;
controls.rotateSpeed = 1.25;
controls.enabled = false;
controls.addEventListener("change", () => {
  pointerDirty = true;
  cameraMoving = true;
});
controls.addEventListener("start", () => {
  isInteracting = true;
});
controls.addEventListener("end", () => {
  isInteracting = false;
  pointerDirty = true;
});

const light1 = new THREE.DirectionalLight(0xffffff, 1.15);
light1.position.set(1, -2, 2);
scene.add(light1);
const light2 = new THREE.DirectionalLight(0xffffff, 0.55);
light2.position.set(-2, 1, 1);
scene.add(light2);
scene.add(new THREE.HemisphereLight(0xffffff, 0xf1e7e4, 0.4));

const loadingManager = new THREE.LoadingManager();
loadingManager.onStart = (_url, itemsLoaded, itemsTotal) => {
  updateLoading(itemsLoaded, itemsTotal);
};
loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  updateLoading(itemsLoaded, itemsTotal);
};
loadingManager.onLoad = () => {
  updateLoading(loadingManager.itemsLoaded, loadingManager.itemsTotal);
  handleLoaded();
};
const plyLoader = new PLYLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const meshes = [];
let globalCenter = new THREE.Vector3();
let selected = null;
let hoverSource = null;
let isInteracting = false;
let lastRaycast = 0;
let cameraMoving = false;

const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();

const MAX_LABELS = 3;
const EXPLODE_SPEED = 4.2;
const LABEL_EASE = 0.12;
const LABEL_MARGIN = 14;
const RAYCAST_INTERVAL = 16;
const EXPLODE_DISTANCE = 68;
const FLY_DURATION = 1600;
const SPIN_DURATION = 3000;
const EXPLODE_MIN_DURATION = 900;
const AUTO_ROTATE_SPEED = 0.2;
const BRAIN_SCALE = 1.3;
const ROTATE_EASE = 0.08;
const POINTER_IDLE_MS = 700;
const LABEL_GAP = 14;
const labelCandidates = [];
const visibleEntries = new Set();
const flyFrom = new THREE.Vector3();
const flyTo = new THREE.Vector3();
const FLYIN_OFFSET_MULT = 1.6;
const brainBounds = new THREE.Box3();
const brainSize = new THREE.Vector3();

brainGroup.scale.setScalar(BRAIN_SCALE);

let isExploded = false;
let interactivityEnabled = false;
let autoRotate = false;
let explodeTarget = 0;
let explodeMoving = false;
let sequencePhase = "loading";
let sequenceStart = performance.now();
let lastTime = performance.now();
let expectedMeshes = 0;
let loadedMeshes = 0;
let rotateBlend = 0;
let pointerActiveUntil = 0;
let wasUserActive = false;

const loadingState = {
  loaded: 0,
  total: 0,
  done: false,
};

function setEmissive(entry, color) {
  entry.meshes.forEach((m) => {
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    materials.forEach((mat) => {
      if (mat && "emissive" in mat) {
        mat.emissive = new THREE.Color(color);
      }
    });
  });
}

function setLabelActive(entry, active) {
  if (!entry || !entry.label) return;
  entry.label.box.classList.toggle("is-active", active);
}

function clearHighlight() {
  if (!selected) return;
  setEmissive(selected, 0x000000);
  setLabelActive(selected, false);
  selected = null;
}

function canHighlight() {
  return isExploded && interactivityEnabled;
}

function makeTissueColor(seed, baseHex) {
  const hash = [...seed].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const t = (hash % 1000) / 1000;
  const base = new THREE.Color(baseHex);
  const hsl = {};
  base.getHSL(hsl);
  hsl.h = THREE.MathUtils.clamp(hsl.h + (t - 0.5) * 0.015, 0, 1);
  hsl.s = THREE.MathUtils.clamp(hsl.s + (t - 0.5) * 0.05, 0, 1);
  hsl.l = THREE.MathUtils.clamp(hsl.l + (t - 0.5) * 0.08, 0, 1);
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

function materialBaseColor(entry) {
  const name = (entry.name || entry.id || "").toLowerCase();
  if (name.includes("ventricle")) return "#d6dbe6";
  if (name.includes("choroid")) return "#c56f62";
  if (name.includes("white matter")) return "#e6c8bf";
  if (name.includes("cortex")) return "#d88f86";
  if (name.includes("brainstem")) return "#cd857c";
  return "#d98f86";
}

function applyWetMaterial(mesh, color) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.05,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    sheen: 0.2,
    sheenRoughness: 0.7,
    envMapIntensity: 0.5,
    vertexColors: false,
  });
  mesh.material = material;
}

function smoothShading(meshList) {
  meshList.forEach((m) => {
    if (m.geometry) {
      m.geometry.computeVertexNormals();
    }
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    materials.forEach((mat) => {
      if (!mat) return;
      mat.flatShading = false;
      mat.needsUpdate = true;
    });
  });
}

function highlight(entry) {
  if (!canHighlight()) {
    clearHighlight();
    return;
  }
  if (entry === selected) return;
  if (selected && selected !== entry) {
    setEmissive(selected, 0x000000);
    setLabelActive(selected, false);
  }
  selected = entry;
  if (entry) {
    setEmissive(entry, 0x1d4f7a);
    setLabelActive(entry, true);
  }
}

function updateLoading(loaded, total) {
  if (loadingState.done) return;
  loadingState.loaded = loaded;
  loadingState.total = total;
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  statusButton.textContent = `LOADING ${pct}%`;
}

function updateHintMessage() {
  if (!hint) return;
  const isCoarse = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  hint.textContent = isCoarse
    ? "Swipe to rotate / Pinch to zoom"
    : "Drag to rotate / Scroll to zoom";
}

function updateBrainBounds() {
  brainBounds.setFromObject(brainGroup);
  brainBounds.getSize(brainSize);
}

function updateZoomLimits() {
  updateBrainBounds();
  const size = brainSize.length();
  controls.maxDistance = Math.max(520, size * 3.2);
}

function prepareFlyPositions() {
  updateBrainBounds();
  flyTo.set(0, 0, 0);
  const distance = Math.max(brainSize.length(), 240);
  flyFrom.copy(flyTo).addScaledVector(camera.up, -distance * FLYIN_OFFSET_MULT);
}

function startSequence() {
  prepareFlyPositions();
  brainGroup.visible = true;
  brainGroup.position.copy(flyFrom);
  brainGroup.rotation.set(0, 0, 0);
  rotateBlend = 0;
  sequencePhase = "flyin";
  sequenceStart = performance.now();
  autoRotate = true;
  isExploded = false;
  interactivityEnabled = false;
  controls.enabled = false;
  controls.reset();
  setExplodeTarget(0);
  pointerDirty = true;
  updateHintMessage();
  if (hint) hint.classList.add("is-visible");
}

function handleLoaded() {
  if (loadingState.done) return;
  if (expectedMeshes && loadedMeshes < expectedMeshes) return;
  loadingState.done = true;
  statusButton.textContent = "RESET";
  statusButton.disabled = false;
  statusButton.classList.add("is-ready");
  controls.target.copy(globalCenter);
  updateZoomLimits();
  controls.update();
  if ("target0" in controls && "position0" in controls && "up0" in controls) {
    controls.target0.copy(controls.target);
    controls.position0.copy(camera.position);
    controls.up0.copy(camera.up);
  }
  scheduleSequenceStart();
}

function onPointer(event) {
  if (!interactivityEnabled) return;
  pointerActiveUntil = performance.now() + POINTER_IDLE_MS;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointerDirty = true;
}

function runRaycast() {
  if (!canHighlight()) return;
  if (isInteracting || cameraMoving) return;
  if (hoverSource === "label") return;
  if (!pointerDirty) return;
  const now = performance.now();
  if (now - lastRaycast < RAYCAST_INTERVAL) return;
  lastRaycast = now;
  pointerDirty = false;
  raycaster.setFromCamera(pointer, camera);
  const ray = raycaster.ray;
  brainGroup.updateMatrixWorld();
  let closest = null;
  let closestDist = Infinity;

  for (const entry of meshes) {
    if (!entry.root.visible || !entry.boundsSphere) continue;
    tempVec.copy(entry.boundsSphere.center).add(entry.offset);
    tempVec.applyMatrix4(brainGroup.matrixWorld);
    const radius = entry.boundsSphere.radius * brainGroup.scale.x;
    ray.closestPointToPoint(tempVec, tempVec2);
    const distSq = tempVec2.distanceToSquared(tempVec);
    if (distSq > radius * radius) continue;
    const dist = ray.origin.distanceTo(tempVec2);
    if (dist < closestDist) {
      closestDist = dist;
      closest = entry;
    }
  }

  if (!closest) {
    highlight(null);
    return;
  }

  const hitList = raycaster.intersectObjects(closest.meshes, false);
  if (hitList.length) {
    highlight(closest);
  } else {
    highlight(null);
  }
}

function createLabelElements(entry) {
  const box = document.createElement("div");
  box.className = "label-box";
  const labelTitle = document.createElement("div");
  labelTitle.className = "label-title";
  labelTitle.textContent = entry.name;
  const desc = document.createElement("div");
  desc.className = "label-desc";
  desc.innerHTML = entry.description || "";
  desc.querySelectorAll("a[href^='/']").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  });
  box.appendChild(labelTitle);
  box.appendChild(desc);
  labelBoxes.appendChild(box);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("label-line");
  labelLines.appendChild(line);

  entry.label = {
    box,
    line,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
    needsMeasure: true,
    initialized: false,
  };

  box.addEventListener("mouseenter", () => {
    if (!canHighlight()) return;
    hoverSource = "label";
    highlight(entry);
  });
  box.addEventListener("mouseleave", () => {
    if (!canHighlight()) return;
    hoverSource = null;
    highlight(null);
    pointerDirty = true;
  });
}

function setLabelVisible(entry, visible) {
  const label = entry.label;
  if (!label || label.visible === visible) return;
  label.visible = visible;
  label.box.style.display = "block";
  label.line.style.display = "block";
  label.box.style.opacity = visible ? "1" : "0";
  label.line.style.opacity = visible ? "1" : "0";
  label.box.style.pointerEvents = visible ? "auto" : "none";
  label.box.setAttribute("aria-hidden", visible ? "false" : "true");
  if (visible) {
    label.needsMeasure = true;
  } else {
    label.initialized = false;
  }
}

function ensureLabelMetrics(entry) {
  const label = entry.label;
  if (!label || !label.needsMeasure) return;
  const rect = label.box.getBoundingClientRect();
  label.width = rect.width || 240;
  label.height = rect.height || 80;
  label.needsMeasure = false;
}

function computeLabelTarget(entry, anchorX, anchorY, width, height) {
  const label = entry.label;
  if (!label) return { x: 0, y: 0, ux: 1, uy: 0 };
  ensureLabelMetrics(entry);
  const boxWidth = label.width || 240;
  const boxHeight = label.height || 80;
  const dx = anchorX - width / 2;
  const dy = anchorY - height / 2;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const targetX = anchorX + ux * 240;
  const targetY = anchorY + uy * 170;
  const clampedX = Math.min(width - boxWidth - LABEL_MARGIN, Math.max(LABEL_MARGIN, targetX));
  const clampedY = Math.min(height - boxHeight - LABEL_MARGIN, Math.max(LABEL_MARGIN, targetY));
  return { x: clampedX, y: clampedY, ux, uy, w: boxWidth, h: boxHeight };
}

function updateLabelPosition(entry, anchorX, anchorY, width, height, targetX, targetY) {
  const label = entry.label;
  if (!label) return;
  ensureLabelMetrics(entry);
  const boxWidth = label.width || 240;
  const boxHeight = label.height || 80;
  const clampedX = Math.min(width - boxWidth - LABEL_MARGIN, Math.max(LABEL_MARGIN, targetX));
  const clampedY = Math.min(height - boxHeight - LABEL_MARGIN, Math.max(LABEL_MARGIN, targetY));

  if (!label.initialized) {
    label.x = clampedX;
    label.y = clampedY;
    label.initialized = true;
  } else {
    label.x += (clampedX - label.x) * LABEL_EASE;
    label.y += (clampedY - label.y) * LABEL_EASE;
  }

  label.box.style.transform = `translate(${label.x}px, ${label.y}px)`;

  const lineX2 = label.x + (anchorX < label.x ? 0 : boxWidth);
  const lineY2 = label.y + boxHeight * 0.5;
  label.line.setAttribute("x1", anchorX.toFixed(1));
  label.line.setAttribute("y1", anchorY.toFixed(1));
  label.line.setAttribute("x2", lineX2.toFixed(1));
  label.line.setAttribute("y2", lineY2.toFixed(1));
}

function updateLabels() {
  if (!isExploded) {
    meshes.forEach((entry) => setLabelVisible(entry, false));
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;
  labelLines.setAttribute("viewBox", `0 0 ${width} ${height}`);

  labelCandidates.length = 0;
  brainGroup.updateMatrixWorld();
  for (const entry of meshes) {
    if (!entry.root.visible) continue;
    tempVec.copy(entry.centroid).add(entry.offset);
    tempVec.applyMatrix4(brainGroup.matrixWorld);
    tempVec2.copy(tempVec).project(camera);
    if (tempVec2.z < -1 || tempVec2.z > 1) continue;

    const x = (tempVec2.x * 0.5 + 0.5) * width;
    const y = (-tempVec2.y * 0.5 + 0.5) * height;
    if (x < -100 || x > width + 100 || y < -100 || y > height + 100) continue;

    const dist = camera.position.distanceTo(tempVec);
    const score = 1 / (dist + 1);
    labelCandidates.push({ entry, x, y, score });
  }

  labelCandidates.sort((a, b) => b.score - a.score);
  visibleEntries.clear();

  const candidateList = [];
  if (canHighlight() && selected && selected.root.visible) {
    const exists = labelCandidates.find((c) => c.entry === selected);
    if (exists) {
      candidateList.push(exists);
    } else {
      tempVec.copy(selected.centroid).add(selected.offset);
      tempVec.applyMatrix4(brainGroup.matrixWorld);
      tempVec2.copy(tempVec).project(camera);
      if (tempVec2.z >= -1 && tempVec2.z <= 1) {
        const sx = (tempVec2.x * 0.5 + 0.5) * width;
        const sy = (-tempVec2.y * 0.5 + 0.5) * height;
        candidateList.push({ entry: selected, x: sx, y: sy, score: Infinity });
      }
    }
  }
  for (const candidate of labelCandidates) {
    if (candidateList.length >= MAX_LABELS) break;
    if (candidateList.find((c) => c.entry === candidate.entry)) continue;
    candidateList.push(candidate);
  }

  const placed = [];
  const lateralSteps = [0, 1, -1, 2, -2, 3, -3];
  const radialSteps = [0, 30, 60, 90, 120];
  for (const candidate of candidateList) {
    const entry = candidate.entry;
    const base = computeLabelTarget(entry, candidate.x, candidate.y, width, height);
    const vx = -base.uy;
    const vy = base.ux;
    let chosenX = base.x;
    let chosenY = base.y;
    let found = false;
    for (const radial of radialSteps) {
      for (const step of lateralSteps) {
        const tx = base.x + base.ux * radial + vx * step * 26;
        const ty = base.y + base.uy * radial + vy * step * 26;
        const clampedX = Math.min(width - base.w - LABEL_MARGIN, Math.max(LABEL_MARGIN, tx));
        const clampedY = Math.min(height - base.h - LABEL_MARGIN, Math.max(LABEL_MARGIN, ty));
        const rect = { x: clampedX, y: clampedY, w: base.w, h: base.h };
        const overlap = placed.some((other) => (
          rect.x < other.x + other.w + LABEL_GAP
          && rect.x + rect.w + LABEL_GAP > other.x
          && rect.y < other.y + other.h + LABEL_GAP
          && rect.y + rect.h + LABEL_GAP > other.y
        ));
        if (!overlap) {
          chosenX = rect.x;
          chosenY = rect.y;
          placed.push(rect);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      setLabelVisible(entry, false);
      continue;
    }
    setLabelVisible(entry, true);
    visibleEntries.add(entry);
    updateLabelPosition(entry, candidate.x, candidate.y, width, height, chosenX, chosenY);
  }

  for (const entry of meshes) {
    if (!visibleEntries.has(entry)) {
      setLabelVisible(entry, false);
    }
  }
}

function setExplodeTarget(distance) {
  explodeTarget = distance;
  meshes.forEach((entry) => {
    entry.targetOffset.copy(entry.dir).multiplyScalar(distance);
  });
  if (!distance) {
    clearHighlight();
    hoverSource = null;
  }
  pointerDirty = true;
}

function updateExplodeAnimation(delta) {
  let moving = false;
  const t = 1 - Math.exp(-EXPLODE_SPEED * delta);
  meshes.forEach((entry) => {
    entry.offset.lerp(entry.targetOffset, t);
    if (entry.offset.distanceToSquared(entry.targetOffset) > 0.0004) {
      moving = true;
    }
    entry.root.position.copy(entry.offset);
  });
  if (moving) pointerDirty = true;
  return moving;
}

function advanceSequence(now, delta) {
  if (!loadingState.done) return;

  if (sequencePhase === "flyin") {
    const t = Math.min(1, (now - sequenceStart) / FLY_DURATION);
    const eased = t * t * (3 - 2 * t);
    brainGroup.position.lerpVectors(flyFrom, flyTo, eased);
    if (t >= 1) {
      sequencePhase = "spin";
      sequenceStart = now;
    }
  } else if (sequencePhase === "spin") {
    if (now - sequenceStart >= SPIN_DURATION) {
      sequencePhase = "explode";
      sequenceStart = now;
      isExploded = true;
      setExplodeTarget(EXPLODE_DISTANCE);
    }
  } else if (sequencePhase === "explode") {
  if (!explodeMoving && now - sequenceStart >= EXPLODE_MIN_DURATION) {
      sequencePhase = "interactive";
      interactivityEnabled = true;
      controls.enabled = true;
      autoRotate = true;
      pointerDirty = true;
    }
  }

  const userActive = isInteracting || hoverSource === "label" || now < pointerActiveUntil;
  if (wasUserActive && !userActive) {
    hoverSource = null;
    clearHighlight();
  }
  wasUserActive = userActive;
  let rotateTarget = 0;
  if (autoRotate) {
    rotateTarget = interactivityEnabled && userActive ? 0 : 1;
  }
  rotateBlend += (rotateTarget - rotateBlend) * ROTATE_EASE;
  if (rotateBlend > 0.0001) {
    brainGroup.rotation.z += AUTO_ROTATE_SPEED * delta * rotateBlend;
  }
}

function loadMeshes(manifest) {
  expectedMeshes = manifest.meshes.length;
  loadedMeshes = 0;
  const centroids = manifest.meshes.map((m) => new THREE.Vector3(...m.centroid));
  if (centroids.length) {
    globalCenter = centroids
      .reduce((acc, v) => acc.add(v), new THREE.Vector3())
      .multiplyScalar(1 / centroids.length);
  }

  manifest.meshes.forEach((entry) => {
    const url = `assets/meshes/${entry.path}`;
    const centroid = new THREE.Vector3(...entry.centroid);
    const dir = centroid.clone().sub(globalCenter).normalize();
    const format = (
      entry.path.endsWith(".ply")
        ? "ply"
        : entry.path.endsWith(".glb")
          ? "glb"
          : (manifest.mesh_format || "glb")
    ).toLowerCase();

    const finish = (root) => {
      const tissueColor = makeTissueColor(entry.id || entry.name || "brain", materialBaseColor(entry));
      const meshList = [];
      root.traverse((obj) => {
        if (obj.isMesh) {
          obj.frustumCulled = true;
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
          applyWetMaterial(obj, tissueColor);
          meshList.push(obj);
        }
      });
      smoothShading(meshList);
      brainGroup.add(root);
      const bounds = new THREE.Box3().setFromObject(root);
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const scale = brainGroup.scale.x || 1;
      sphere.center.multiplyScalar(1 / scale);
      sphere.radius /= scale;

      const entryState = {
        ...entry,
        root,
        meshes: meshList,
        centroid,
        dir,
        offset: new THREE.Vector3(),
        targetOffset: new THREE.Vector3(),
        label: null,
        boundsSphere: sphere,
      };
      meshList.forEach((m) => {
        m.userData.entry = entryState;
      });

      createLabelElements(entryState);
      meshes.push(entryState);
      setExplodeTarget(explodeTarget);
      loadedMeshes += 1;
      handleLoaded();
    };

    if (format === "ply") {
      plyLoader.load(url, (geometry) => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshPhysicalMaterial({
          color: makeTissueColor(entry.id || entry.name || "brain", materialBaseColor(entry)),
          metalness: 0.05,
          roughness: 0.42,
          clearcoat: 0.35,
          clearcoatRoughness: 0.2,
          sheen: 0.2,
          sheenRoughness: 0.7,
          envMapIntensity: 0.5,
        });
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        finish(group);
      });
    } else {
      gltfLoader.load(url, (gltf) => {
        finish(gltf.scene);
      });
    }
  });
}

async function init() {
  updateLoading(0, 0);
  const resp = await fetch("assets/regions.json");
  const manifest = await resp.json();
  loadMeshes(manifest);
}

renderer.domElement.addEventListener("pointermove", onPointer);
renderer.domElement.addEventListener("pointerleave", () => {
  pointerActiveUntil = 0;
  if (hoverSource !== "label") {
    highlight(null);
  }
});

statusButton.addEventListener("click", () => {
  if (!loadingState.done) return;
  title.classList.remove("is-muted");
  if (overlay) overlay.classList.remove("is-muted");
  if (sequenceDelayId) {
    clearTimeout(sequenceDelayId);
    sequenceDelayId = null;
  }
  sequencePhase = "loading";
  sequenceStart = performance.now();
  autoRotate = false;
  isExploded = false;
  interactivityEnabled = false;
  controls.enabled = false;
  hoverSource = null;
  clearHighlight();
  setExplodeTarget(0);
  brainGroup.visible = false;
  if (hint) hint.classList.remove("is-visible");
  scheduleSequenceStart();
});

function scheduleSequenceStart() {
  if (sequenceDelayId) {
    clearTimeout(sequenceDelayId);
  }
  sequenceDelayId = setTimeout(() => {
    sequenceDelayId = null;
    title.classList.add("is-muted");
    if (overlay) overlay.classList.add("is-muted");
    startSequence();
  }, SEQUENCE_DELAY_MS);
}

function resizeRenderer() {
  const rect = banner.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  if (typeof controls.handleResize === "function") {
    controls.handleResize();
  }
  meshes.forEach((entry) => {
    if (entry.label) entry.label.needsMeasure = true;
  });
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  cameraMoving = false;
  controls.update();
  advanceSequence(now, delta);
  explodeMoving = updateExplodeAnimation(delta);
  runRaycast();
  updateLabels();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  resizeRenderer();
  updateHintMessage();
});

init();
resizeRenderer();
animate();
