// --- ОСНОВНЫЕ ПЕРЕМЕННЫЕ ---
const SCENE_SIZE = 1000;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Настройка рендерера для теней и качества
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

let player = new THREE.Object3D(); // Объект-контейнер для игрока
let playerSpeed = 0.5;
let isShooting = false;
let car = null;
let isInCar = false;

// Векторы для управления
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = { forward: false, backward: false, left: false, right: false };

// HUD элементы
const hpElement = document.getElementById('hp');
const timeTextElement = document.getElementById('timeText');

// --- НАСТРОЙКА ОСВЕЩЕНИЯ (ДЕНЬ/НОЧЬ) ---
let ambientLight;
let sunLight;
let hemiLight;
let timeOfDay = 0.5; // 0.0 = Полночь, 0.5 = Полдень, 1.0 = Полночь
const TIME_SPEED = 0.00005; // Скорость смены времени

function setupLights() {
    // 1. Солнечный свет (направленный)
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

    // 2. Рассеянный свет
    ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambientLight);

    // 3. Полусферический свет
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(hemiLight);
}

function updateDayNightCycle(delta) {
    timeOfDay += delta * TIME_SPEED;
    timeOfDay %= 1.0;

    // Цвет неба (оттенки синего/оранжевого)
    const sunColor = new THREE.Color();
    const lightIntensity = Math.sin(timeOfDay * Math.PI) * 0.8 + 0.2; // Интенсивность (мин 0.2, макс 1.0)

    if (timeOfDay < 0.25 || timeOfDay > 0.75) { // Ночь
        sunColor.setRGB(0.05, 0.05, 0.1);
        sunLight.intensity = 0.1;
        timeTextElement.textContent = 'Ночь';
    } else if (timeOfDay < 0.35 || timeOfDay > 0.65) { // Сумерки/Рассвет
        sunColor.setRGB(1.0, 0.8, 0.6);
        sunLight.intensity = 0.8;
        timeTextElement.textContent = timeOfDay < 0.5 ? 'Рассвет' : 'Закат';
    } else { // День
        sunColor.setRGB(1.0, 1.0, 1.0);
        sunLight.intensity = 1.5;
        timeTextElement.textContent = 'День';
    }
    
    // Позиция солнца
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
    // 1. ЗЕМЛЯ / ДОРОГА
    const roadTexture = new THREE.TextureLoader().load('textures/road.jpg'); // Предполагаем, что текстура дороги есть
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(SCENE_SIZE / 50, SCENE_SIZE / 50);

    const groundGeometry = new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        map: roadTexture, 
        color: 0x555555, 
        roughness: 0.8 // Влияет на отражения/скольжение
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. ЗДАНИЯ (5 разных моделей, расставленных по сетке)
    const buildingGeometries = [
        new THREE.BoxGeometry(20, 40, 20),
        new THREE.BoxGeometry(30, 60, 30),
        new THREE.BoxGeometry(15, 25, 15),
        new THREE.BoxGeometry(40, 80, 40),
        new THREE.BoxGeometry(25, 50, 25),
    ];

    const gridStep = 100; // Шаг сетки для зданий
    const halfSize = SCENE_SIZE / 2;
    const buildingCount = 0;

    for (let x = -halfSize + gridStep; x < halfSize; x += gridStep) {
        for (let z = -halfSize + gridStep; z < halfSize; z += gridStep) {
            // Случайный шанс появления здания
            if (Math.random() > 0.6) {
                const geo = buildingGeometries[Math.floor(Math.random() * buildingGeometries.length)];
                const color = new THREE.Color(Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5);
                const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0.1 });
                
                const building = new THREE.Mesh(geo, mat);
                building.position.x = x + (Math.random() - 0.5) * 20;
                building.position.z = z + (Math.random() - 0.5) * 20;
                building.position.y = geo.parameters.height / 2; // Центр внизу
                
                building.castShadow = true;
                building.receiveShadow = true;
                scene.add(building);
                buildingCount++;
            }
        }
    }
}

// --- ФУНКЦИИ ИГРОКА (Базовое перемещение) ---
function setupPlayer() {
    // Временно создаем куб для игрока
    const playerGeo = new THREE.BoxGeometry(3, 8, 3);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 4, 0);
    player.castShadow = true;
    scene.add(player);

    camera.position.set(0, 10, -15);
    player.add(camera);
}

// --- ЗАГРУЗКА МАШИНЫ (СПОРТИВНАЯ) ---
function loadCar() {
    // Внимание! Для реальной 3D-модели (GLTF/OBJ) нужно использовать THREE.GLTFLoader.
    // Пока создадим временный бокс, имитирующий спортивную машину.
    const carGeo = new THREE.BoxGeometry(5, 2, 10);
    const carMat = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.8, roughness: 0.2 });
    car = new THREE.Mesh(carGeo, carMat);
    car.position.set(50, 1, 50);
    car.castShadow = true;
    scene.add(car);
}

// --- ФУНКЦИИ УПРАВЛЕНИЯ ---
function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'KeyE': toggleCar(); break; // Сесть/выйти из машины
        case 'Space': isShooting = true; break; // Стрельба
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
        case 'Space': isShooting = false; break;
    }
}

function toggleCar() {
    if (!isInCar) {
        // Проверяем, близко ли игрок к машине
        const distance = player.position.distanceTo(car.position);
        if (distance < 15) {
            isInCar = true;
            scene.remove(player); // Убираем игрока со сцены
            car.add(camera); // Камера переходит в машину
            camera.position.set(0, 10, -15); // Позиция камеры от третьего лица
        }
    } else {
        isInCar = false;
        car.remove(camera); // Убираем камеру из машины
        scene.add(player); // Возвращаем игрока на сцену
        player.position.copy(car.position).add(new THREE.Vector3(5, 0, 0)); // Ставим рядом
    }
}

// --- УПРАВЛЕНИЕ КАМЕРОЙ (Pointer Lock Controls) ---
let pitch = new THREE.Object3D();
let yaw = new THREE.Object3D();
yaw.position.y = 5;
yaw.add(pitch);

function initControls() {
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    // Управление мышью (очень упрощенная PointerLock)
    document.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === renderer.domElement) {
            let rotationSpeed = 0.002;
            if (!isInCar) {
                // Вращение игрока
                player.rotation.y -= event.movementX * rotationSpeed;
                
                // Вращение камеры (вертикальное)
                let newPitch = camera.rotation.x - event.movementY * rotationSpeed;
                camera.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, newPitch));
            } else {
                // Вращение машины
                car.rotation.y -= event.movementX * rotationSpeed * 2;
            }
        }
    }, false);
}

// --- ЛОГИКА ОБНОВЛЕНИЯ ИГРЫ (ОСНОВНОЙ ЦИКЛ) ---
const clock = new THREE.Clock();

function updateMovement(delta) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    let currentSpeed = playerSpeed;
    if (isInCar) currentSpeed = playerSpeed * 10; // Машина едет быстрее

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * currentSpeed * 100.0 * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * currentSpeed * 100.0 * delta;

    // Применение движения
    if (!isInCar) {
        player.translateX(velocity.x * delta);
        player.translateZ(velocity.z * delta);
    } else {
        // Управление машиной: вперед/назад относительно направления
        if (moveState.forward) car.translateZ(currentSpeed * delta);
        if (moveState.backward) car.translateZ(-currentSpeed * delta * 0.5);
    }
    
    // Коллизии: ограничение по границам карты
    const halfMap = SCENE_SIZE / 2 - 5;
    if (!isInCar) {
        player.position.x = Math.max(-halfMap, Math.min(halfMap, player.position.x));
        player.position.z = Math.max(-halfMap, Math.min(halfMap, player.position.z));
        player.position.y = 4; // Простая коллизия с землей
    } else {
        car.position.x = Math.max(-halfMap, Math.min(halfMap, car.position.x));
        car.position.z = Math.max(-halfMap, Math.min(halfMap, car.position.z));
    }
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    updateDayNightCycle(delta);
    updateMovement(delta);
    
    renderer.render(scene, camera);
}

// --- ЗАПУСК ИГРЫ ---
setupLights();
createCity();
setupPlayer();
loadCar();
initControls();

animate();
  
