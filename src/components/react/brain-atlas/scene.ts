import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const INTRO_DELAY_MS = 240;
const FLY_DURATION_MS = 900;
const SPIN_DURATION_MS = 1800;
const EXPLODE_MIN_DURATION_MS = 600;
const EXPLODE_DISTANCE = 62;
const EXPLODE_SPEED = 4.4;
const AUTO_ROTATE_SPEED = 0.18;
const ROTATE_EASE = 0.08;
const POINTER_IDLE_MS = 700;
const RAYCAST_INTERVAL_MS = 24;
const MAX_VISIBLE_LABELS = 3;
const LABEL_MARGIN = 14;
const LABEL_GAP = 14;
const LABEL_EASE = 0.12;
const BRAIN_SCALE = 1.24;
const FLYIN_OFFSET_MULTIPLIER = 1.35;

export interface BrainAtlasRegion {
  id: string;
  name: string;
  path: string;
  centroid: [number, number, number];
  description?: string;
  type?: string;
  hemisphere?: string;
  color?: [number, number, number];
}

export interface BrainAtlasManifest {
  units?: string;
  mesh_format?: string;
  meshes: BrainAtlasRegion[];
}

interface LabelHandle {
  box: HTMLDivElement;
  line: SVGLineElement;
}

interface InternalLabelHandle extends LabelHandle {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  needsMeasure: boolean;
  initialized: boolean;
}

interface BrainEntry extends BrainAtlasRegion {
  root: THREE.Group;
  meshes: THREE.Mesh[];
  centroidVector: THREE.Vector3;
  direction: THREE.Vector3;
  offset: THREE.Vector3;
  targetOffset: THREE.Vector3;
  boundsSphere: THREE.Sphere;
  label: InternalLabelHandle | null;
}

interface BrainAtlasSceneOptions {
  canvasHost: HTMLDivElement;
  manifest: BrainAtlasManifest;
  meshBaseUrl: string;
  reducedMotion: boolean;
  getLabelHandle: (id: string) => LabelHandle | null;
  onLoadingProgress: (progress: number) => void;
  onReady: () => void;
  onError: (message: string) => void;
}

type SequencePhase = 'loading' | 'fly-in' | 'spin' | 'explode' | 'interactive';

export class BrainAtlasScene {
  private readonly canvasHost: HTMLDivElement;
  private readonly manifest: BrainAtlasManifest;
  private readonly meshBaseUrl: string;
  private readonly reducedMotion: boolean;
  private readonly getLabelHandle: (id: string) => LabelHandle | null;
  private readonly onLoadingProgress: (progress: number) => void;
  private readonly onReady: () => void;
  private readonly onError: (message: string) => void;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: TrackballControls;
  private readonly brainGroup = new THREE.Group();
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.22);
  private readonly cameraKeyLight = new THREE.DirectionalLight(0xffffff, 1.55);
  private readonly cameraFillLight = new THREE.DirectionalLight(0xf8efe7, 0.42);
  private readonly cameraLightTarget = new THREE.Object3D();
  private readonly initialCameraPosition = new THREE.Vector3(0, -300, 148);
  private readonly initialCameraUp = new THREE.Vector3(0, 1, 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly labelCandidates: Array<{ entry: BrainEntry; x: number; y: number; score: number }> = [];
  private readonly visibleEntries = new Set<string>();
  private readonly tempWorld = new THREE.Vector3();
  private readonly tempProjection = new THREE.Vector3();
  private readonly tempClosest = new THREE.Vector3();
  private readonly tempSphereCenter = new THREE.Vector3();
  private readonly flyFrom = new THREE.Vector3();
  private readonly flyTo = new THREE.Vector3();
  private readonly brainBounds = new THREE.Box3();
  private readonly brainSize = new THREE.Vector3();
  private readonly lightTargetWorld = new THREE.Vector3();
  private readonly disposeListeners = new Set<() => void>();
  private readonly entries: BrainEntry[] = [];

  private globalCenter = new THREE.Vector3();
  private selectedEntry: BrainEntry | null = null;
  private hoverLabelId: string | null = null;
  private introTimeoutId: number | null = null;
  private animationFrameId: number | null = null;
  private sequencePhase: SequencePhase = 'loading';
  private sequenceStart = 0;
  private lastFrameTime = 0;
  private pointerDirty = false;
  private pointerActiveUntil = 0;
  private lastRaycastAt = 0;
  private explodeMoving = false;
  private autoRotate = false;
  private rotateBlend = 0;
  private isExploded = false;
  private interactivityEnabled = false;
  private isInteracting = false;
  private wasUserActive = false;
  private cameraMoving = false;
  private isActive = true;
  private disposed = false;

  constructor(options: BrainAtlasSceneOptions) {
    this.canvasHost = options.canvasHost;
    this.manifest = options.manifest;
    this.meshBaseUrl = options.meshBaseUrl;
    this.reducedMotion = options.reducedMotion;
    this.getLabelHandle = options.getLabelHandle;
    this.onLoadingProgress = options.onLoadingProgress;
    this.onReady = options.onReady;
    this.onError = options.onError;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    this.camera.position.copy(this.initialCameraPosition);
    this.camera.up.copy(this.initialCameraUp);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.canvasHost.appendChild(this.renderer.domElement);

    this.scene.environment = null;
    this.scene.add(this.camera);

    this.brainGroup.scale.setScalar(BRAIN_SCALE);
    this.brainGroup.visible = false;
    this.scene.add(this.brainGroup);

    this.cameraKeyLight.position.set(0, 0, 1.6);
    this.cameraFillLight.position.set(-0.7, 0.5, 1.1);
    this.camera.add(this.cameraKeyLight);
    this.camera.add(this.cameraFillLight);
    this.scene.add(this.cameraLightTarget);
    this.cameraKeyLight.target = this.cameraLightTarget;
    this.cameraFillLight.target = this.cameraLightTarget;
    this.scene.add(this.ambientLight);

    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
    this.controls.noPan = true;
    this.controls.staticMoving = false;
    this.controls.dynamicDampingFactor = 0.08;
    this.controls.rotateSpeed = 3.2;
    this.controls.zoomSpeed = 1.1;
    this.controls.enabled = false;
    this.controls.addEventListener('change', this.handleControlsChange);
    this.controls.addEventListener('start', this.handleControlsStart);
    this.controls.addEventListener('end', this.handleControlsEnd);
  }

  async init(): Promise<void> {
    this.onLoadingProgress(0);
    await this.loadEntries();
    if (this.disposed) {
      return;
    }

    this.controls.target.copy(this.globalCenter);
    this.updateZoomLimits();
    this.resize();
    this.controls.update();
    this.onReady();

    if (this.reducedMotion) {
      this.showStaticInteractiveState();
      this.startLoop();
    } else {
      this.scheduleIntro();
      this.startLoop();
    }
  }

  resize(): void {
    if (this.disposed) {
      return;
    }

    const bounds = this.canvasHost.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const coarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    const pixelRatioCap = coarsePointer ? 1.15 : 1.5;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    this.controls.handleResize();

    for (const entry of this.entries) {
      if (entry.label) {
        entry.label.needsMeasure = true;
      }
    }

    this.renderFrame();
  }

  reset(): void {
    if (this.disposed || this.entries.length === 0) {
      return;
    }

    if (this.reducedMotion) {
      this.resetCameraToDefault();
      this.setExplodeTarget(EXPLODE_DISTANCE);
      this.highlight(null);
      this.renderFrame();
      return;
    }

    if (this.introTimeoutId !== null) {
      window.clearTimeout(this.introTimeoutId);
      this.introTimeoutId = null;
    }

    this.sequencePhase = 'loading';
    this.sequenceStart = performance.now();
    this.autoRotate = false;
    this.isExploded = false;
    this.interactivityEnabled = false;
    this.isInteracting = false;
    this.wasUserActive = false;
    this.hoverLabelId = null;
    this.pointerActiveUntil = 0;
    this.rotateBlend = 0;
    this.controls.enabled = false;
    this.resetCameraToDefault();
    this.brainGroup.visible = false;
    this.setExplodeTarget(0);
    this.highlight(null);
    this.scheduleIntro();
    this.startLoop();
  }

  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.startLoop();
      return;
    }

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setPointerFromClient(clientX: number, clientY: number): void {
    if (this.disposed || !this.interactivityEnabled) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerActiveUntil = performance.now() + POINTER_IDLE_MS;
    this.pointerDirty = true;
  }

  clearPointer(): void {
    this.pointerActiveUntil = 0;
    this.pointerDirty = true;
    if (!this.hoverLabelId) {
      this.highlight(null);
    }
  }

  setLabelHover(id: string | null): void {
    this.hoverLabelId = id;
    if (!id) {
      this.highlight(null);
      this.pointerDirty = true;
      return;
    }

    const entry = this.entries.find((candidate) => candidate.id === id) ?? null;
    this.highlight(entry);
  }

  onDispose(callback: () => void): void {
    this.disposeListeners.add(callback);
  }

  dispose(): void {
    this.disposed = true;

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.introTimeoutId !== null) {
      window.clearTimeout(this.introTimeoutId);
      this.introTimeoutId = null;
    }

    this.controls.removeEventListener('change', this.handleControlsChange);
    this.controls.removeEventListener('start', this.handleControlsStart);
    this.controls.removeEventListener('end', this.handleControlsEnd);
    this.controls.dispose();

    for (const entry of this.entries) {
      entry.root.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) {
          return;
        }

        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) {
            material.dispose();
          }
        } else {
          mesh.material.dispose();
        }
      });
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();

    for (const callback of this.disposeListeners) {
      callback();
    }
    this.disposeListeners.clear();
  }

  private readonly handleControlsChange = () => {
    this.pointerDirty = true;
    this.cameraMoving = true;
  };

  private readonly handleControlsStart = () => {
    this.isInteracting = true;
  };

  private readonly handleControlsEnd = () => {
    this.isInteracting = false;
    this.pointerDirty = true;
  };

  private readonly tick = (now: number) => {
    if (this.disposed || !this.isActive) {
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = window.requestAnimationFrame(this.tick);

    const deltaSeconds = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.cameraMoving = false;

    this.controls.update();
    this.advanceSequence(now, deltaSeconds);
    this.explodeMoving = this.updateExplosion(deltaSeconds);
    this.updateRaycast(now);
    this.updateLabels();
    this.renderFrame();
  };

  private startLoop(): void {
    if (this.animationFrameId !== null || this.disposed || !this.isActive) {
      return;
    }

    this.lastFrameTime = performance.now();
    this.animationFrameId = window.requestAnimationFrame(this.tick);
  }

  private renderFrame(): void {
    this.updateCameraLights();
    this.renderer.render(this.scene, this.camera);
  }

  private resetCameraToDefault(): void {
    this.camera.position.copy(this.initialCameraPosition);
    this.camera.up.copy(this.initialCameraUp);
    this.controls.target.copy(this.globalCenter);
    this.camera.lookAt(this.globalCenter);
    this.controls.update();
    this.pointerDirty = true;
  }

  private updateCameraLights(): void {
    this.brainGroup.updateMatrixWorld(true);
    this.lightTargetWorld.copy(this.globalCenter);
    this.brainGroup.localToWorld(this.lightTargetWorld);
    this.cameraLightTarget.position.copy(this.lightTargetWorld);
    this.cameraLightTarget.updateMatrixWorld();
  }

  private async loadEntries(): Promise<void> {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url: string, loaded: number, total: number) => {
      const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
      this.onLoadingProgress(progress);
    };

    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder);

    const centroids = this.manifest.meshes.map((entry) => new THREE.Vector3(...entry.centroid));
    if (centroids.length > 0) {
      this.globalCenter = centroids.reduce((sum, value) => sum.add(value), new THREE.Vector3()).multiplyScalar(1 / centroids.length);
    }

    try {
      const gltfs = await Promise.all(
        this.manifest.meshes.map((entry) => loader.loadAsync(`${this.meshBaseUrl}/${entry.path}`)),
      );

      this.manifest.meshes.forEach((entry, index) => {
        const root = gltfs[index].scene;
        const entryState = this.buildEntry(entry, root);
        this.entries.push(entryState);
        this.brainGroup.add(root);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the brain atlas.';
      this.onError(message);
      throw error;
    }

    this.onLoadingProgress(100);
  }

  private buildEntry(entry: BrainAtlasRegion, root: THREE.Group): BrainEntry {
    const baseColor = this.getBaseColor(entry);
    const tissueColor = this.makeTissueColor(entry.id || entry.name, baseColor);
    const meshes: THREE.Mesh[] = [];

    root.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }

      mesh.geometry.computeVertexNormals();
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: tissueColor,
        metalness: 0.01,
        roughness: 0.5,
        clearcoat: 0.22,
        clearcoatRoughness: 0.34,
        sheen: 0.08,
        sheenRoughness: 0.55,
        specularIntensity: 0.32,
        ior: 1.38,
        transparent: false,
        opacity: 1,
        depthWrite: true,
        depthTest: true,
      });
      mesh.renderOrder = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      meshes.push(mesh);
    });

    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const centroidVector = new THREE.Vector3(...entry.centroid);
    const direction = centroidVector.clone().sub(this.globalCenter);
    if (direction.lengthSq() === 0) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    return {
      ...entry,
      root,
      meshes,
      centroidVector,
      direction,
      offset: new THREE.Vector3(),
      targetOffset: new THREE.Vector3(),
      boundsSphere: sphere,
      label: null,
    };
  }

  private makeTissueColor(seed: string, baseHex: string): THREE.Color {
    const hash = [...seed].reduce((accumulator, character) => accumulator * 31 + character.charCodeAt(0), 7);
    const variation = (hash % 1000) / 1000;
    const base = new THREE.Color(baseHex);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);

    return new THREE.Color().setHSL(
      THREE.MathUtils.clamp(hsl.h + (variation - 0.5) * 0.012, 0, 1),
      THREE.MathUtils.clamp(hsl.s + (variation - 0.5) * 0.03, 0, 1),
      THREE.MathUtils.clamp(hsl.l + (variation - 0.5) * 0.045, 0, 1),
    );
  }

  private getBaseColor(entry: BrainAtlasRegion): string {
    const name = entry.name.toLowerCase();
    if (name.includes('ventricle')) {
      return '#98a7b8';
    }
    if (name.includes('white matter')) {
      return '#c9b09c';
    }
    if (name.includes('brain stem') || name.includes('brainstem')) {
      return '#b56b62';
    }
    if (name.includes('choroid')) {
      return '#ab5a4f';
    }
    if (name.includes('cortex')) {
      return '#c87067';
    }
    return '#bf7167';
  }

  private scheduleIntro(): void {
    if (this.introTimeoutId !== null) {
      window.clearTimeout(this.introTimeoutId);
    }

    this.introTimeoutId = window.setTimeout(() => {
      this.introTimeoutId = null;
      this.startIntro();
    }, INTRO_DELAY_MS);
  }

  private startIntro(): void {
    this.prepareFlyPositions();
    this.brainGroup.visible = true;
    this.brainGroup.position.copy(this.flyFrom);
    this.brainGroup.rotation.set(0, 0, 0);
    this.controls.enabled = false;
    this.resetCameraToDefault();
    this.autoRotate = true;
    this.interactivityEnabled = false;
    this.isExploded = false;
    this.sequencePhase = 'fly-in';
    this.sequenceStart = performance.now();
    this.setExplodeTarget(0);
  }

  private showStaticInteractiveState(): void {
    this.brainGroup.visible = true;
    this.brainGroup.position.set(0, 0, 0);
    this.brainGroup.rotation.set(0, 0, 0.28);
    this.controls.enabled = true;
    this.interactivityEnabled = true;
    this.isExploded = true;
    this.sequencePhase = 'interactive';
    this.autoRotate = false;
    this.setExplodeTarget(EXPLODE_DISTANCE);
    for (const entry of this.entries) {
      entry.offset.copy(entry.targetOffset);
      entry.root.position.copy(entry.offset);
    }
    this.renderFrame();
  }

  private prepareFlyPositions(): void {
    this.updateBrainBounds();
    this.flyTo.set(0, 0, 0);
    const distance = Math.max(this.brainSize.length(), 240);
    this.flyFrom.copy(this.flyTo).addScaledVector(this.camera.up, -distance * FLYIN_OFFSET_MULTIPLIER);
  }

  private advanceSequence(now: number, deltaSeconds: number): void {
    if (this.sequencePhase === 'fly-in') {
      const t = Math.min(1, (now - this.sequenceStart) / FLY_DURATION_MS);
      const eased = t * t * (3 - 2 * t);
      this.brainGroup.position.lerpVectors(this.flyFrom, this.flyTo, eased);
      if (t >= 1) {
        this.sequencePhase = 'spin';
        this.sequenceStart = now;
      }
    } else if (this.sequencePhase === 'spin') {
      if (now - this.sequenceStart >= SPIN_DURATION_MS) {
        this.sequencePhase = 'explode';
        this.sequenceStart = now;
        this.isExploded = true;
        this.setExplodeTarget(EXPLODE_DISTANCE);
      }
    } else if (this.sequencePhase === 'explode') {
      if (!this.explodeMoving && now - this.sequenceStart >= EXPLODE_MIN_DURATION_MS) {
        this.sequencePhase = 'interactive';
        this.interactivityEnabled = true;
        this.controls.enabled = true;
        this.autoRotate = true;
        this.pointerDirty = true;
      }
    }

    const userActive = this.isInteracting || this.hoverLabelId !== null || now < this.pointerActiveUntil;
    if (this.wasUserActive && !userActive) {
      this.highlight(null);
      this.hoverLabelId = null;
    }
    this.wasUserActive = userActive;

    const rotateTarget = this.autoRotate && !(this.interactivityEnabled && userActive) ? 1 : 0;
    this.rotateBlend += (rotateTarget - this.rotateBlend) * ROTATE_EASE;
    if (this.rotateBlend > 0.0001) {
      this.brainGroup.rotation.z += AUTO_ROTATE_SPEED * deltaSeconds * this.rotateBlend;
    }
  }

  private setExplodeTarget(distance: number): void {
    for (const entry of this.entries) {
      entry.targetOffset.copy(entry.direction).multiplyScalar(distance);
    }
    if (distance === 0) {
      this.highlight(null);
    }
    this.pointerDirty = true;
  }

  private updateExplosion(deltaSeconds: number): boolean {
    const ease = 1 - Math.exp(-EXPLODE_SPEED * deltaSeconds);
    let moving = false;

    for (const entry of this.entries) {
      entry.offset.lerp(entry.targetOffset, ease);
      if (entry.offset.distanceToSquared(entry.targetOffset) > 0.0004) {
        moving = true;
      }
      entry.root.position.copy(entry.offset);
    }

    if (moving) {
      this.pointerDirty = true;
    }

    return moving;
  }

  private updateRaycast(now: number): void {
    if (!this.canHighlight()) {
      return;
    }

    if (!this.pointerDirty || this.isInteracting || this.cameraMoving || this.hoverLabelId) {
      return;
    }

    if (now - this.lastRaycastAt < RAYCAST_INTERVAL_MS) {
      return;
    }

    this.lastRaycastAt = now;
    this.pointerDirty = false;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    let closestEntry: BrainEntry | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const entry of this.entries) {
      if (!entry.root.visible) {
        continue;
      }

      this.tempSphereCenter.copy(entry.boundsSphere.center).add(entry.offset);
      this.tempSphereCenter.applyMatrix4(this.brainGroup.matrixWorld);

      const scaledRadius = entry.boundsSphere.radius * this.brainGroup.scale.x;
      this.raycaster.ray.closestPointToPoint(this.tempSphereCenter, this.tempClosest);
      const distanceSquared = this.tempClosest.distanceToSquared(this.tempSphereCenter);
      if (distanceSquared > scaledRadius * scaledRadius) {
        continue;
      }

      const distance = this.raycaster.ray.origin.distanceTo(this.tempClosest);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEntry = entry;
      }
    }

    if (!closestEntry) {
      this.highlight(null);
      return;
    }

    const intersections = this.raycaster.intersectObjects(closestEntry.meshes, false);
    this.highlight(intersections.length > 0 ? closestEntry : null);
  }

  private updateLabels(): void {
    if (!this.isExploded) {
      for (const entry of this.entries) {
        this.setLabelVisible(entry, false);
      }
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) {
      return;
    }

    const svg = this.entries.find((entry) => entry.label)?.label?.line?.ownerSVGElement;
    svg?.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.labelCandidates.length = 0;
    this.visibleEntries.clear();

    this.brainGroup.updateMatrixWorld();

    for (const entry of this.entries) {
      if (!entry.root.visible) {
        continue;
      }

      this.tempWorld.copy(entry.centroidVector).add(entry.offset);
      this.tempWorld.applyMatrix4(this.brainGroup.matrixWorld);
      this.tempProjection.copy(this.tempWorld).project(this.camera);

      if (this.tempProjection.z < -1 || this.tempProjection.z > 1) {
        continue;
      }

      const x = (this.tempProjection.x * 0.5 + 0.5) * width;
      const y = (-this.tempProjection.y * 0.5 + 0.5) * height;
      if (x < -100 || x > width + 100 || y < -100 || y > height + 100) {
        continue;
      }

      const distance = this.camera.position.distanceTo(this.tempWorld);
      this.labelCandidates.push({ entry, x, y, score: 1 / (distance + 1) });
    }

    this.labelCandidates.sort((left, right) => right.score - left.score);

    const candidateList: Array<{ entry: BrainEntry; x: number; y: number; score: number }> = [];
    if (this.selectedEntry) {
      const existing = this.labelCandidates.find((candidate) => candidate.entry === this.selectedEntry);
      if (existing) {
        candidateList.push(existing);
      }
    }

    for (const candidate of this.labelCandidates) {
      if (candidateList.length >= MAX_VISIBLE_LABELS) {
        break;
      }
      if (candidateList.some((existing) => existing.entry === candidate.entry)) {
        continue;
      }
      candidateList.push(candidate);
    }

    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const lateralSteps = [0, 1, -1, 2, -2, 3, -3];
    const radialSteps = [0, 30, 60, 90, 120];

    for (const candidate of candidateList) {
      const base = this.computeLabelTarget(candidate.entry, candidate.x, candidate.y, width, height);
      if (!base) {
        continue;
      }

      const vx = -base.uy;
      const vy = base.ux;
      let chosenX = base.x;
      let chosenY = base.y;
      let found = false;

      for (const radial of radialSteps) {
        for (const step of lateralSteps) {
          const x = base.x + base.ux * radial + vx * step * 26;
          const y = base.y + base.uy * radial + vy * step * 26;
          const clampedX = Math.min(width - base.w - LABEL_MARGIN, Math.max(LABEL_MARGIN, x));
          const clampedY = Math.min(height - base.h - LABEL_MARGIN, Math.max(LABEL_MARGIN, y));
          const rectCandidate = { x: clampedX, y: clampedY, w: base.w, h: base.h };

          const overlap = placed.some((placedRect) => (
            rectCandidate.x < placedRect.x + placedRect.w + LABEL_GAP
            && rectCandidate.x + rectCandidate.w + LABEL_GAP > placedRect.x
            && rectCandidate.y < placedRect.y + placedRect.h + LABEL_GAP
            && rectCandidate.y + rectCandidate.h + LABEL_GAP > placedRect.y
          ));

          if (!overlap) {
            chosenX = rectCandidate.x;
            chosenY = rectCandidate.y;
            placed.push(rectCandidate);
            found = true;
            break;
          }
        }

        if (found) {
          break;
        }
      }

      if (!found) {
        this.setLabelVisible(candidate.entry, false);
        continue;
      }

      this.setLabelVisible(candidate.entry, true);
      this.visibleEntries.add(candidate.entry.id);
      this.updateLabelPosition(candidate.entry, candidate.x, candidate.y, width, height, chosenX, chosenY);
    }

    for (const entry of this.entries) {
      if (!this.visibleEntries.has(entry.id)) {
        this.setLabelVisible(entry, false);
      }
    }
  }

  private computeLabelTarget(entry: BrainEntry, anchorX: number, anchorY: number, width: number, height: number) {
    const label = this.ensureLabel(entry);
    if (!label) {
      return null;
    }

    this.ensureLabelMetrics(entry);
    const boxWidth = label.width || 240;
    const boxHeight = label.height || 80;
    const dx = anchorX - width / 2;
    const dy = anchorY - height / 2;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const targetX = anchorX + ux * 190;
    const targetY = anchorY + uy * 135;

    return {
      x: Math.min(width - boxWidth - LABEL_MARGIN, Math.max(LABEL_MARGIN, targetX)),
      y: Math.min(height - boxHeight - LABEL_MARGIN, Math.max(LABEL_MARGIN, targetY)),
      ux,
      uy,
      w: boxWidth,
      h: boxHeight,
    };
  }

  private updateLabelPosition(
    entry: BrainEntry,
    anchorX: number,
    anchorY: number,
    width: number,
    height: number,
    targetX: number,
    targetY: number,
  ): void {
    const label = this.ensureLabel(entry);
    if (!label) {
      return;
    }

    this.ensureLabelMetrics(entry);
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
    label.line.setAttribute('x1', anchorX.toFixed(1));
    label.line.setAttribute('y1', anchorY.toFixed(1));
    label.line.setAttribute('x2', lineX2.toFixed(1));
    label.line.setAttribute('y2', lineY2.toFixed(1));
  }

  private setLabelVisible(entry: BrainEntry, visible: boolean): void {
    const label = this.ensureLabel(entry);
    if (!label || label.visible === visible) {
      return;
    }

    label.visible = visible;
    label.box.style.display = 'block';
    label.box.style.opacity = visible ? '1' : '0';
    label.box.style.pointerEvents = visible ? 'auto' : 'none';
    label.box.setAttribute('aria-hidden', visible ? 'false' : 'true');
    label.line.style.opacity = visible ? '1' : '0';
    label.line.style.pointerEvents = 'none';

    if (visible) {
      label.needsMeasure = true;
    } else {
      label.initialized = false;
    }
  }

  private ensureLabel(entry: BrainEntry): InternalLabelHandle | null {
    const nextHandle = this.getLabelHandle(entry.id);
    if (!nextHandle) {
      return null;
    }

    if (!entry.label || entry.label.box !== nextHandle.box || entry.label.line !== nextHandle.line) {
      entry.label = {
        ...nextHandle,
        x: entry.label?.x ?? 0,
        y: entry.label?.y ?? 0,
        width: entry.label?.width ?? 0,
        height: entry.label?.height ?? 0,
        visible: entry.label?.visible ?? false,
        needsMeasure: true,
        initialized: false,
      };
    }

    return entry.label;
  }

  private ensureLabelMetrics(entry: BrainEntry): void {
    const label = this.ensureLabel(entry);
    if (!label || !label.needsMeasure) {
      return;
    }

    const rect = label.box.getBoundingClientRect();
    label.width = rect.width || 240;
    label.height = rect.height || 80;
    label.needsMeasure = false;
  }

  private highlight(entry: BrainEntry | null): void {
    if (!this.canHighlight()) {
      entry = null;
    }

    if (this.selectedEntry === entry) {
      return;
    }

    if (this.selectedEntry) {
      this.setEmissive(this.selectedEntry, 0x000000);
      this.setLabelActive(this.selectedEntry, false);
    }

    this.selectedEntry = entry;
    if (!entry) {
      return;
    }

    this.setEmissive(entry, 0x365f4b);
    this.setLabelActive(entry, true);
  }

  private setEmissive(entry: BrainEntry, hex: number): void {
    for (const mesh of entry.meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(hex);
    }
  }

  private setLabelActive(entry: BrainEntry, active: boolean): void {
    const label = this.ensureLabel(entry);
    if (!label) {
      return;
    }

    label.box.classList.toggle('is-active', active);
  }

  private canHighlight(): boolean {
    return this.isExploded && this.interactivityEnabled;
  }

  private updateBrainBounds(): void {
    this.brainBounds.setFromObject(this.brainGroup);
    this.brainBounds.getSize(this.brainSize);
  }

  private updateZoomLimits(): void {
    this.updateBrainBounds();
    const size = this.brainSize.length();
    this.controls.minDistance = Math.max(165, size * 0.72);
    this.controls.maxDistance = Math.max(460, size * 2.7);
  }
}
