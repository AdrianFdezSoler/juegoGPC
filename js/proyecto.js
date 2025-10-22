var renderer, scene, camera;
var car;
var leftHeadlight, rightHeadlight;
var trackCurve, centerlinePoints = [], trackMesh;
var trackWidth = 18;
var carSpeed = 0;
var maxSpeed = 1;
var acceleration = 0.15;
var deceleration = 0.008;
var keys = { forward: false, backward: false, left: false, right: false };
var timerActive = false;
var startTime = null;
var lapTime = 0;
var carHasMoved = false;
var minimapRenderer, minimapCamera;
var gameState = 'start'; // 'start', 'running', 'finished'
var controlsEnabled = false;
var stats;

// Iniciar el juego
init();
render();

function init() {
  // 1. Configurar renderer
  setupRenderer();

  // stats
  stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  // 2. Crear escena
  scene = new THREE.Scene();
  
  // 3. Crear cielo
  createSkybox();
  
  // 4. Crear elementos del mundo
  createCircuit();
  loadCar();
  createForest();
  
  // 5. Configurar cámara
  setupCamera();
  
  // 6. Configurar iluminación
  setupLights();
  
  // 7. Configurar controles y UI
  setupKeyboardControls();
  createMinimap();
  
  // 8. Configurar eventos
  window.addEventListener('resize', updateAspectRatio);
  
  // 9. Iniciar bucle de animación
  animate();
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 0.8);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x001122));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  document.getElementById('container').appendChild(renderer.domElement);
}

function createSkybox() {
  const loader = new THREE.TextureLoader();
  const skyTexture = loader.load('models/cielo-noche.jpg');
  skyTexture.wrapS = skyTexture.wrapT = THREE.RepeatWrapping;
  skyTexture.repeat.set(1.5, 1.5);
  const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
  const skyMaterial = new THREE.MeshBasicMaterial({ 
    map: skyTexture,
    side: THREE.BackSide
  });

  const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
  skybox.name = 'skybox';
  scene.add(skybox);
}

function setupCamera() {
  const aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 500);
  camera.position.set(0, 10, -10);
  camera.lookAt(0, 0, 0);
}

function createCircuit() {
  createGrassTerrain();

  const circuitPoints = defineCircuitPoints();
  trackCurve = new THREE.CatmullRomCurve3(circuitPoints, true, 'catmullrom', 0.01);
  
  generateTrackGeometry();
  addTrackMarkings();
  addFinishLine();
}

function createGrassTerrain() {
  const terrainSize = 500;
  const grassGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, 1, 1);
  
  const loader = new THREE.TextureLoader();
  const grassTexture = loader.load('models/generic_grass/textures/Material_baseColor.png');
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(20, 20);
  grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  
  const grassMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.position.y = -0.01;
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);
}

function defineCircuitPoints() {

  return [
    new THREE.Vector3(0, 0, 0),    
    new THREE.Vector3(0, 0, 120),   
    new THREE.Vector3(40, 0, 140),
    new THREE.Vector3(60, 0, 140),
    new THREE.Vector3(90, 0, 135),
    new THREE.Vector3(105, 0, 128),
    new THREE.Vector3(115, 0, 110),
    new THREE.Vector3(125, 0, 95),
    new THREE.Vector3(130, 0, 75),
    new THREE.Vector3(125, 0, 55),
    new THREE.Vector3(110, 0, 40),
    new THREE.Vector3(120, 0, 0),
    new THREE.Vector3(130, 0, -10),
    new THREE.Vector3(135, 0, -15),
    new THREE.Vector3(160, 0, -15),
    new THREE.Vector3(180, 0, -25),
    new THREE.Vector3(170, 0, -50),
    new THREE.Vector3(150, 0, -60),
    new THREE.Vector3(120, 0, -60),
    new THREE.Vector3(90, 0, -55),
    new THREE.Vector3(70, 0, -40),
    new THREE.Vector3(65, 0, -50),
    new THREE.Vector3(55, 0, -75),
    new THREE.Vector3(50, 0, -70),
    new THREE.Vector3(40, 0, -70),    
    new THREE.Vector3(20, 0, -60),
    new THREE.Vector3(10, 0, -40),
    new THREE.Vector3(5, 0, -20)
  ];
}

function generateTrackGeometry() {
  const segments = 1000;
  centerlinePoints = trackCurve.getPoints(segments);

  // Calcular vertices izquierdo y derecho de la pista
  const trackVertices = calculateTrackVertices(segments);
  
  // Construir geometría de la pista
  const geometry = buildTrackGeometry(trackVertices);
  
  // Crear material y malla de la pista
  const trackMaterial = createTrackMaterial();
  trackMesh = new THREE.Mesh(geometry, trackMaterial);
  trackMesh.receiveShadow = true;
  scene.add(trackMesh);
}

function calculateTrackVertices(segments) {
  const leftVertices = [];
  const rightVertices = [];
  const up = new THREE.Vector3(0, 1, 0);
  
  for (let i = 0; i < centerlinePoints.length; i++) {
    const point = centerlinePoints[i];
    const tangent = trackCurve.getTangent(i / segments).clone();
    const lateral = new THREE.Vector3().crossVectors(up, tangent).normalize();
    
    leftVertices.push(point.clone().add(lateral.clone().multiplyScalar(trackWidth * 0.5)));
    rightVertices.push(point.clone().add(lateral.clone().multiplyScalar(-trackWidth * 0.5)));
  }
  
  return { left: leftVertices, right: rightVertices };
}

// Construir la geometría de la pista
function buildTrackGeometry(trackVertices) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const total = trackVertices.left.length;
  
  const lengthAt = calculateTrackLengths();
  const metersPerRepeat = 8;
  
  for (let i = 0; i < total; i++) {
    const leftVertex = trackVertices.left[i];
    const rightVertex = trackVertices.right[i];
    
    positions.push(leftVertex.x, leftVertex.y, leftVertex.z);
    positions.push(rightVertex.x, rightVertex.y, rightVertex.z);
    
    const vCoord = lengthAt[i] / metersPerRepeat;
    uvs.push(0, vCoord, 1, vCoord);
    
    if (i < total - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, d, a, d, c);
    } else {
      // Cerrar la pista conectando con el inicio
      const a = i * 2;
      const b = i * 2 + 1;
      indices.push(a, b, 1, a, 1, 0);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}


function calculateTrackLengths() {
  const lengthAt = [0];
  let totalLength = 0;
  
  for (let i = 1; i < centerlinePoints.length; i++) {
    totalLength += centerlinePoints[i].distanceTo(centerlinePoints[i - 1]);
    lengthAt.push(totalLength);
  }
  
  return lengthAt;
}

// Crear material de la pista
function createTrackMaterial() {
  const loader = new THREE.TextureLoader();
  const roadTexture = loader.load('models/asfalto2.jpg');
  roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.repeat.set(1, 1);
  roadTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  roadTexture.magFilter = THREE.LinearFilter;
  roadTexture.minFilter = THREE.LinearMipmapLinearFilter;
  
  return new THREE.MeshPhongMaterial({ 
    map: roadTexture,
    shininess: 20,
  });
}

// Agregar marcas de línea central
function addTrackMarkings() {
  const dashGeometry = new THREE.PlaneGeometry(0.4, 3);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  
  for (let i = 0; i < centerlinePoints.length; i += 20) {
    const point = centerlinePoints[i];
    const dash = new THREE.Mesh(dashGeometry, dashMaterial);
    dash.position.set(point.x, 0.02, point.z);
    
    const tangent = trackCurve.getTangent(i / 1000);
    const angle = Math.atan2(tangent.x, tangent.z);
    dash.rotation.set(-Math.PI / 2, 0, angle);
    scene.add(dash);
  }
}

// Agregar línea de salida/meta
function addFinishLine() {
  const startPoint = centerlinePoints[0];
  const tangent = trackCurve.getTangent(0);
  const angle = Math.atan2(tangent.x, tangent.z);

  const metaGeometry = new THREE.PlaneGeometry(trackWidth, 1.2);
  const metaMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const finishLine = new THREE.Mesh(metaGeometry, metaMaterial);
  finishLine.position.set(startPoint.x, 0.03, startPoint.z);
  finishLine.rotation.set(-Math.PI / 2, 0, angle);
  scene.add(finishLine);

  // Crear y almacenar la Bounding Box de la línea de meta
  finishLine.boundingBox = new THREE.Box3().setFromObject(finishLine);
  finishLine.name = "finishLine";
}

function loadCar() {
  const loader = new THREE.GLTFLoader();
  const modelPath = 'models/2010-porsche-918-spyder/source/2010_Porsche_918_Spyder.glb';
  
  loader.load(modelPath,
    function (gltf) {
      car = gltf.scene;
      setupCarPosition();
      setupCarProperties();
      scene.add(car);
    },
    undefined,
    function (error) { 
      console.log('Error al cargar el coche:', error); 
    }
  );
}

// Configurar posición inicial del coche
function setupCarPosition() {
  if (centerlinePoints.length > 1) {
    const startPoint = centerlinePoints[0];
    const nextPoint = centerlinePoints[1];
    
    car.position.copy(startPoint);
    
    // Orientar el coche en la dirección correcta
    const direction = {
      x: nextPoint.x - startPoint.x,
      z: nextPoint.z - startPoint.z
    };
    car.rotation.y = Math.atan2(direction.x, direction.z);
  } else {
    car.position.set(0, 0, 0);
    car.rotation.y = 0;
  }
}

function setupCarProperties() {
  car.scale.set(1.2, 1.2, 1.2);
  car.castShadow = true;

  const textureLoader = new THREE.TextureLoader();
  const textures = {
    body: textureLoader.load('models/2010-porsche-918-spyder/textures/2010_porsche_918_spyder_ext_basalt_black.etc_5.png')
  };

  // Configurar sombras y materiales para cada parte del coche
  car.traverse(function (child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      // Usar MeshPhongMaterial con textura básica para mejor visibilidad nocturna
      child.material = new THREE.MeshPhongMaterial({
        map: textures.body, // Solo usar textura básica del coche
        shininess: 80,
        specular: 0x333333,
      });
    }
  });

  // Crear faros del coche
  setupCarHeadlights();
  
  // Añadir luz puntual sobre el coche
  const carTopLight = new THREE.PointLight(0xffffff, 0.3, 15);
  carTopLight.position.set(0, 2, 0);
  car.add(carTopLight);
}

function setupCarHeadlights() {
  // Faro izquierdo
  leftHeadlight = new THREE.SpotLight(0xffffff, 3, 100, Math.PI / 7, 0.2);
  leftHeadlight.position.set(-0.6, 0.8, 2.5);
  leftHeadlight.target.position.set(-0.6, 0, 10);
  leftHeadlight.castShadow = true;
  leftHeadlight.shadow.mapSize.width = 512;
  leftHeadlight.shadow.mapSize.height = 512;
  leftHeadlight.shadow.camera.near = 0.5;
  leftHeadlight.shadow.camera.far = 100;
  
  // Faro derecho
  rightHeadlight = new THREE.SpotLight(0xffffff, 3, 100, Math.PI / 7, 0.2);
  rightHeadlight.position.set(0.6, 0.8, 2.5);
  rightHeadlight.target.position.set(0.6, 0, 10);
  rightHeadlight.castShadow = true;
  rightHeadlight.shadow.mapSize.width = 512;
  rightHeadlight.shadow.mapSize.height = 512;
  rightHeadlight.shadow.camera.near = 0.5;
  rightHeadlight.shadow.camera.far = 100;
  
  car.add(leftHeadlight);
  car.add(leftHeadlight.target);
  car.add(rightHeadlight);
  car.add(rightHeadlight.target);
}

function setupLights() {
  const directionalLight = new THREE.DirectionalLight(0x6080ff, 0.4);
  directionalLight.position.set(50, 100, 0);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 200;
  directionalLight.shadow.camera.left = -60;
  directionalLight.shadow.camera.right = 60;
  directionalLight.shadow.camera.top = 60;
  directionalLight.shadow.camera.bottom = -60;
  scene.add(directionalLight);
  
  const ambientLight = new THREE.AmbientLight(0x404080, 0.3);
  scene.add(ambientLight);
}

function createForest() {
  const loader = new THREE.GLTFLoader();
  const treePath = 'models/tree.glb';

  loader.load(
    treePath,
    (gltf) => {
      const meshGroups = new Map();

      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          const matKey = child.material.uuid;
          if (!meshGroups.has(matKey)) {
            meshGroups.set(matKey, { material: child.material, geometries: [] });
          }
          const entry = meshGroups.get(matKey);
          const geom = child.geometry.clone();
          geom.applyMatrix4(child.matrixWorld);
          entry.geometries.push(geom);
        }
      });

      if (meshGroups.size === 0) {
        console.error("No se encontró malla válida en el modelo del árbol");
        return;
      }


      const spacing = 17;
      const treesPerSide = 1;
      const lateralMin = trackWidth * 0.7 + 4;
      const lateralMax = trackWidth * 1.1 + 13;
      const matrices = [];

      const up = new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3();
      const lateral = new THREE.Vector3();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scaleVec = new THREE.Vector3();
      const mat = new THREE.Matrix4();

      const steps = Math.floor(centerlinePoints.length / spacing);
      const maxTrees = 85;
      let treeCount = 0;

      for (let s = 0; s < steps && treeCount < maxTrees; s++) {
        const i = Math.floor(s * spacing + Math.random() * spacing * 0.5);
        if (i >= centerlinePoints.length) continue;
        const point = centerlinePoints[i];
        tangent.copy(trackCurve.getTangent(i / centerlinePoints.length));
        lateral.crossVectors(up, tangent).normalize();

        for (let side = -1; side <= 1; side += 2) {
          if (treeCount >= maxTrees) break;
          for (let t = 0; t < treesPerSide; t++) {
            const offset = lateralMin + Math.random() * (lateralMax - lateralMin) + Math.random() * 2;
            const along = (Math.random() - 0.5) * spacing * 1.2;

            pos.copy(point);
            pos.addScaledVector(lateral, offset * side);
            if (i + along >= 0 && i + along < centerlinePoints.length) {
              pos.addScaledVector(
                trackCurve.getTangent((i + along) / centerlinePoints.length),
                along
              );
            }

            if (!isInsideTrack(pos)) {
              const scale = 0.45 + Math.random() * 0.18;
              quat.setFromAxisAngle(up, Math.random() * Math.PI * 2);
              scaleVec.set(scale, scale * (0.9 + Math.random() * 0.25), scale);
              mat.compose(pos, quat, scaleVec);
              matrices.push(mat.clone());
              treeCount++;
            }
          }
        }
      }

      console.log(`Total árboles generados: ${matrices.length}`);

      meshGroups.forEach(({ material, geometries }) => {
        const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries, false);
        const instanced = new THREE.InstancedMesh(mergedGeometry, material, matrices.length);

        instanced.castShadow = true;
        instanced.receiveShadow = true;

        for (let i = 0; i < matrices.length; i++) {
          instanced.setMatrixAt(i, matrices[i]);
        }
        instanced.instanceMatrix.needsUpdate = true;
        scene.add(instanced);
      });
    },
    undefined,
    (error) => console.error('Error al cargar el árbol:', error)
  );
}

function setupKeyboardControls() {
  // Detectar cuando se presiona una tecla
  document.addEventListener('keydown', function (event) {
    switch (event.code) {
      case 'ArrowUp': 
      case 'KeyW': 
        keys.forward = true; 
        break;
      case 'ArrowDown': 
      case 'KeyS': 
        keys.backward = true; 
        break;
      case 'ArrowLeft': 
      case 'KeyA': 
        keys.left = true; 
        break;
      case 'ArrowRight': 
      case 'KeyD': 
        keys.right = true; 
        break;
    }
  });
  
  // Detectar cuando se suelta una tecla
  document.addEventListener('keyup', function (event) {
    switch (event.code) {
      case 'ArrowUp': 
      case 'KeyW': 
        keys.forward = false; 
        break;
      case 'ArrowDown': 
      case 'KeyS': 
        keys.backward = false; 
        break;
      case 'ArrowLeft': 
      case 'KeyA': 
        keys.left = false; 
        break;
      case 'ArrowRight': 
      case 'KeyD': 
        keys.right = false; 
        break;
    }
  });
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update() {
  if (car && controlsEnabled) {
    updateCarMovement();
    updateCarPosition();
    updateCameraSystem();
    updateGameElements();
  }
}

function updateCarMovement() {
  if (keys.forward) {
    carSpeed = Math.min(carSpeed + acceleration, maxSpeed);
  } else if (keys.backward) {
    carSpeed = Math.max(carSpeed - acceleration, -maxSpeed * 0.5);
  } else {
    if (carSpeed > 0) carSpeed = Math.max(carSpeed - deceleration, 0);
    else if (carSpeed < 0) carSpeed = Math.min(carSpeed + deceleration, 0);
  }
  
  if (Math.abs(carSpeed) > 0.001) {
    // Giro más fuerte cuando va más lento y más suave a alta velocidad
    const baseTurnRate = 0.04;
    const maxTurnRate = 0.08;
    const speedFactor = Math.abs(carSpeed) / maxSpeed;
    const turnAmount = baseTurnRate + (maxTurnRate - baseTurnRate) * (1 - speedFactor);
    
    if (keys.left) car.rotation.y += turnAmount;
    if (keys.right) car.rotation.y -= turnAmount;
  }
}

function updateCarPosition() {
  const previousPosition = car.position.clone();

  const angle = car.rotation.y;
  const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

  car.position.add(direction.multiplyScalar(carSpeed));

  if (!isInsideTrack(car.position)) {
    car.position.copy(previousPosition);
    carSpeed *= 0.5;
  }

  // Actualizar la Bounding Box del coche
  if (!car.boundingBox) {
    car.boundingBox = new THREE.Box3().setFromObject(car);
  } else {
    car.boundingBox.setFromObject(car);
  }

  // Verificar si el coche se ha movido desde su posición inicial
  const startPoint = centerlinePoints[0];
  const distanceFromStart = car.position.distanceTo(startPoint);
  if (distanceFromStart > 5) {
    carHasMoved = true;
  }
}

function updateCameraSystem() {
  const cameraOffset = new THREE.Vector3(0, 5, -5);
  cameraOffset.applyMatrix4(new THREE.Matrix4().makeRotationY(car.rotation.y));
  
  const desiredCameraPosition = new THREE.Vector3();
  desiredCameraPosition.addVectors(car.position, cameraOffset);
  
  camera.position.lerp(desiredCameraPosition, 0.15);
  camera.lookAt(car.position.x, car.position.y + 2, car.position.z);
  
  const skybox = scene.getObjectByName('skybox');
  if (skybox) {
    skybox.position.copy(camera.position);
  }
}

function updateGameElements() {
  updateUI();
  updateTimer();
}

function isInsideTrack(position) {
  if (!centerlinePoints.length) return true;
  let minDistSq = Infinity;
  for (let i = 0; i < centerlinePoints.length; i++) {
    const p = centerlinePoints[i];
    const dx = position.x - p.x;
    const dz = position.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minDistSq) minDistSq = d2;
  }
  const dist = Math.sqrt(minDistSq);
  return dist <= (trackWidth * 0.5);
}

function updateUI() {
  const speedDisplay = document.getElementById('speedDisplay');
  const speedBar = document.getElementById('speedBar');
  const gearLabel = document.getElementById('gearLabel');
  if (!speedDisplay || !speedBar || !gearLabel) return;
  
  // Mostrar timer si está activo, sino mostrar velocidad
  if (timerActive) {
    const currentTime = (Date.now() - startTime) / 1000;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const centiseconds = Math.floor((currentTime % 1) * 100);
    
    const formattedTime = minutes + ':' + 
                         seconds.toString().padStart(2, '0') + '.' + 
                         centiseconds.toString().padStart(2, '0');
    
    speedDisplay.textContent = formattedTime;
  } else {
    const mPerSecond = carSpeed * 60;
    const kmh = mPerSecond * 3.6;
    speedDisplay.textContent = Math.round(Math.max(0, kmh));
  }
  
  
  const percent = Math.min(1, Math.abs(carSpeed) / maxSpeed);
  speedBar.style.width = (percent * 100).toFixed(1) + '%';
  
  // Actualizar título del panel
  const titleElement = document.querySelector('#ui h3');
  if (titleElement) {
    titleElement.textContent = timerActive ? '⏱️ Timer' : '🏁 Juego de Carreras';
  }
  
  // Marcha simple: N (parado), R (atrás), D (adelante)
  let gear = 'N';
  if (carSpeed > 0.02) gear = 'D';
  else if (carSpeed < -0.02) gear = 'R';
  gearLabel.textContent = gear;
 
}

function createMinimap() {
  const minimapContainer = document.createElement('div');
  minimapContainer.style.position = 'absolute';
  minimapContainer.style.top = '24px';
  minimapContainer.style.right = '24px';
  minimapContainer.style.background = 'rgba(255, 255, 255, 0.95)';
  minimapContainer.style.backdropFilter = 'blur(5px)';
  minimapContainer.style.padding = '20px';
  minimapContainer.style.borderRadius = '18px';
  minimapContainer.style.boxShadow = '0 6px 22px rgba(0,0,0,0.6), inset 0 0 14px rgba(0,0,0,0.06)';
  minimapContainer.style.zIndex = '1000';
  minimapContainer.style.color = '#333';
  minimapContainer.style.fontFamily = 'Arial, sans-serif';
  
  const minimapTitle = document.createElement('h3');
  minimapTitle.textContent = '🗺️ Minimapa';
  minimapTitle.style.margin = '0 0 15px 0';
  minimapTitle.style.fontSize = '20px';
  minimapTitle.style.letterSpacing = '1px';
  minimapTitle.style.textAlign = 'center';
  minimapContainer.appendChild(minimapTitle);
  
  const minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = 400;
  minimapCanvas.height = 400;
  minimapCanvas.style.borderRadius = '10px';
  minimapCanvas.style.border = '2px solid #333';
  minimapCanvas.style.display = 'block';
  minimapContainer.appendChild(minimapCanvas);
  
  document.body.appendChild(minimapContainer);
  minimapRenderer = new THREE.WebGLRenderer({ 
    canvas: minimapCanvas, 
    alpha: true,
    antialias: true 
  });
  minimapRenderer.setSize(400, 400);
  minimapRenderer.setClearColor(0x001122, 1.0);

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  // Calcular los límites del circuito
  centerlinePoints.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });

  // Añadir margen
  const margin = 30;
  minX -= margin; maxX += margin;
  minZ -= margin; maxZ += margin;

  // Crear cámara ortográfica cenital del minimapa
  const width = maxX - minX;
  const height = maxZ - minZ;
  const size = Math.max(width, height) * 0.5;
  
  minimapCamera = new THREE.OrthographicCamera(
    -size, size, size, -size, 0.1, 1000
  );
  
  minimapCamera.position.set((minX + maxX) / 2, 200, (minZ + maxZ) / 2);
  minimapCamera.lookAt((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
}

function updateTimer() {
  if (!car || !centerlinePoints.length) return;

  const finishLine = scene.getObjectByName("finishLine");
  if (!finishLine || !finishLine.boundingBox || !car.boundingBox) return;

  // Detectar colisión entre el coche y la línea de meta
  const isColliding = car.boundingBox.intersectsBox(finishLine.boundingBox);

  // Ignorar colision si el coche no se ha movido desde la línea de meta
  if (!carHasMoved) {
    return;
  }

  if (!timerActive && controlsEnabled && gameState === "running") {
    timerActive = true;
    startTime = Date.now();
  }

  if (isColliding && timerActive) {
    lapTime = (Date.now() - startTime) / 1000;

    // Mostrar popup de finalización
    const finalTime = getFormattedTime();
    showFinishPopup(finalTime);

    // Reiniciar variables del temporizador
    timerActive = false;
    startTime = null;
    lapTime = 0;
    carHasMoved = false;
  }
}

function getFormattedTime() {
  if (!timerActive || !startTime) return '0:00.00';

  const timeToFormat = lapTime > 0 ? lapTime : (Date.now() - startTime) / 1000;
  const minutes = Math.floor(timeToFormat / 60);
  const seconds = Math.floor(timeToFormat % 60);
  const centiseconds = Math.floor((timeToFormat % 1) * 100);
  
  return minutes + ':' + 
         seconds.toString().padStart(2, '0') + '.' + 
         centiseconds.toString().padStart(2, '0');
}

function startRace() {
  gameState = 'running';
  controlsEnabled = true; 
  document.getElementById('startPopup').classList.add('hidden');
  
}

function showFinishPopup(time) {
  gameState = 'finished';
  controlsEnabled = false;
  document.getElementById('finalTime').textContent = time;
  document.getElementById('finishPopup').classList.remove('hidden');
}

function restartRace() {
  // Reiniciar todas las variables del juego
  gameState = 'start';
  controlsEnabled = false;
  timerActive = false;
  startTime = null;
  lapTime = 0;
  carHasMoved = false;
  carSpeed = 0;

  // Cambiar pop-ups: ocultar finalización y mostrar inicio
  document.getElementById('finishPopup').classList.add('hidden');
  document.getElementById('startPopup').classList.remove('hidden');

  // Resetear posición del coche al punto de inicio
  if (car && centerlinePoints.length > 1) {
    const start = centerlinePoints[0];
    const next = centerlinePoints[1];
    car.position.copy(start.clone().add(new THREE.Vector3(0, 0, 0)));

    // Orientar el coche hacia la dirección correcta
    const dx = next.x - start.x;
    const dz = next.z - start.z;
    car.rotation.y = Math.atan2(dx, dz);
  }
}

function render() {
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
}

function animate() {
  requestAnimationFrame(animate);
  update();
  render();
  
  if (minimapRenderer && minimapCamera) {
    minimapRenderer.render(scene, minimapCamera);
  }
}


window.addEventListener('resize', updateAspectRatio, false);

