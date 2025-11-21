// --- ОСНОВНЫЕ ПЕРЕМЕННЫЕ ---
const SCENE_SIZE = 1000;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

let player = new THREE.Object3D(); 
let playerSpeed = 0.5;
let isShooting = false;
let car = null;
let isInCar = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = { forward: false, backward: false, left: false, right: false };

const hpElement = document.getElementById('hp');
const timeTextElement = document.getElementById('timeText');

// --- НАСТРОЙКА ОСВЕЩЕНИЯ (ДЕНЬ/НОЧЬ) ---
let ambientLight;
let sunLight;
let hemiLight;
let timeOfDay = 0.5; 
const TIME_SPEED = 0.00005; 

function setupLights() {
    sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(200, 400, 200);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1000;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    scene.add(sunLight);

    ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(hemiLight);
}

function updateDayNightCycle(delta) {
    timeOfDay += delta * TIME_SPEED;
    timeOfDay %= 1.0;

    const sunColor = new THREE.Color();
    const lightIntensity = Math.sin(timeOfDay * Math.PI) * 0.8 + 0.2; 

    if (timeOfDay < 0.25 || timeOfDay > 0.75) { 
        sunColor.setRGB(0.05, 0.05, 0.1);
        sunLight.intensity = 0.1;
        timeTextElement.textContent = 'Ночь';
    } else if (timeOfDay < 0.35 || timeOfDay > 0.65) { 
        sunColor.setRGB(1.0, 0.8, 0.6);
        sunLight.intensity = 0.8;
        timeTextElement.textContent = timeOfDay < 0.5 ? 'Рассвет' : 'Закат';
    } else { 
        sunColor.setRGB(1.0, 1.0, 1.0);
        sunLight.intensity = 1.5;
        timeTextElement.textContent = 'День';
    }
    
    const angle = timeOfDay * Math.PI * 2;
    sunLight.position.x = Math.sin(angle) * 500;
    sunLight.position.y = Math.cos(angle) * 500;
    sunLight.position.z = Math.sin(angle) * 500;
    
    sunLight.color.set(sunColor);
    scene.background = new THREE.Color(sunColor).multiplyScalar(0.5);
    ambientLight.intensity = lightIntensity * 0.6;
}

// --- ФУНКЦИИ ГОРОДА (1000x1000 ГРИД) ---
function createCity() {
    const roadTexture = new THREE.TextureLoader().load('textures/road.jpg'); 
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(SCENE_SIZE / 50, SCENE_SIZE / 50);

    const groundGeometry = new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        map: roadTexture, 
        color: 0x555555, 
        roughness: 0.8 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const buildingGeometries = [
        new THREE.BoxGeometry(20, 40, 20),
        new THREE.BoxGeometry(30, 60, 30),
        new THREE.BoxGeometry(15, 25, 15),
        new THREE.BoxGeometry(40, 80, 40),
        new THREE.BoxGeometry(25, 50, 25),
    ];

    const gridStep = 100; 
    const halfSize = SCENE_SIZE / 2;
    const buildingCount = 0;

    for (let x = -halfSize + gridStep; x < halfSize; x += gridStep) {
        for (let z = -halfSize + gridStep; z < halfSize; z += gridStep) {
            if (Math.random() > 0.6) {
                const geo = buildingGeometries[Math.floor(Math.random() * buildingGeometries.length)];
                const color = new THREE.Color(Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5, Math.random()
        
