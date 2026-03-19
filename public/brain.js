import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const hemisphere = urlParams.get('l') ? 'left' : urlParams.get('r') ? 'right' : 'left';

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5);

// Setup camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Setup renderer
const container = document.getElementById('brain-model');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.innerHTML = ''; // Clear the loading text
container.appendChild(renderer.domElement);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Add controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Load STL model
const loader = new STLLoader();
const modelPath = `/stl/final-${hemisphere}-hemisphere.stl`;

// Show loading error if model fails to load
const showError = (message) => {
    container.innerHTML = `<p style="color: red;">Error: ${message}</p>`;
};

loader.load(
    modelPath,
    (geometry) => {
        const material = new THREE.MeshPhongMaterial({
            color: 0x808080,
            specular: 0x111111,
            shininess: 30
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Center the model
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.position.sub(center);
        
        // Scale the model to fit the view
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        mesh.scale.set(scale, scale, scale);
        
        scene.add(mesh);

        // --- Adjust camera and controls ---
        // Set controls to look at the center of the model
        controls.target.copy(mesh.position);
        // Move camera back so the model fits the view
        const cameraDistance = -10; // This value can be tweaked for best fit
        camera.position.set(mesh.position.x, mesh.position.y, cameraDistance);
        camera.lookAt(mesh.position);
        controls.update();
    },
    // Progress callback
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    // Error callback
    (error) => {
        console.error('Error loading model:', error);
        showError('Failed to load 3D model. Please try refreshing the page.');
    }
);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate(); 