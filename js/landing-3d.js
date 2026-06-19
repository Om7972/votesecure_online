import * as THREE from 'three';

const container = document.getElementById('canvas-container');

// Scene setup
const scene = new THREE.Scene();
// Fog to blend into background
scene.fog = new THREE.FogExp2(0x0f172a, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Particles
const geometry = new THREE.BufferGeometry();
const count = 1000;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);

const color1 = new THREE.Color(0x6366f1); // Indigo
const color2 = new THREE.Color(0x2dd4bf); // Teal

for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 100;
    positions[i + 1] = (Math.random() - 0.5) * 100;
    positions[i + 2] = (Math.random() - 0.5) * 100;

    // Gradient color mixing
    const mixedColor = Math.random() > 0.5 ? color1 : color2;
    colors[i] = mixedColor.r;
    colors[i + 1] = mixedColor.g;
    colors[i + 2] = mixedColor.b;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Material
const material = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// Connections (optional, can be expensive for performance, let's keep it simple with just particles floating efficiently)

// Mouse interaction
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    particles.rotation.y += 0.001;
    particles.rotation.x += 0.0005;

    // Gentle wave effect
    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // positions[i3 + 1] += Math.sin(elapsedTime + positions[i3]) * 0.01; 
    }
    // particles.geometry.attributes.position.needsUpdate = true; // heavy operation, skip for fps

    // Smooth camera movement based on mouse
    camera.position.x += (mouseX * 0.01 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 0.01 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
