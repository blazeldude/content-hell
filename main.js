import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

const w = window.innerWidth;
const h = window.innerHeight;

const container = document.createElement('div');
document.body.appendChild(container);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(w, h);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
document.querySelector('#webgl').appendChild(renderer.domElement);

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(w, h);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = 0;
cssRenderer.domElement.style.pointerEvents = 'none';
document.querySelector('#css').appendChild(cssRenderer.domElement);

const fov = 50;
const aspect = w / h;
const near = 0.1;
const far = 2000

const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(0,20,35)
camera.rotation.x = THREE.MathUtils.degToRad(0);
const scene = new THREE.Scene();
const cssScene = new THREE.Scene();

const gui = new GUI();
const cameraInfo = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 }
};

gui.add(cameraInfo.position, 'x').name('Pos X').listen();
gui.add(cameraInfo.position, 'y').name('Pos Y').listen();
gui.add(cameraInfo.position, 'z').name('Pos Z').listen();

const cubeTextureLoader = new THREE.CubeTextureLoader();
const skybox = cubeTextureLoader.load([
//right
"textures/cubemap/vz_moody_right.png",
//left
"textures/cubemap/vz_moody_left.png",
//up
"textures/cubemap/vz_moody_up.png",
//down
"textures/cubemap/vz_moody_down.png",
//front
"textures/cubemap/vz_moody_front.png",
//back
"textures/cubemap/vz_moody_back.png"
]);
scene.background = skybox;

scene.fog = new THREE.Fog( 0x000000, 50, 400 );

let ground;
const groundSize = 750;
const terrainSize = 1000;
const galleries = [];

//FOOTSTEPS
const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('sounds/Steps_gravel-009.ogg', 
(buffer) => 
{sound.setBuffer(buffer); 
sound.setLoop(false); 
sound.setVolume(0.7)});

//WIND
const soundWind = new THREE.Audio(listener);
const windAudioLoader = new THREE.AudioLoader();
windAudioLoader.load('sounds/Waves3.wav', 
(buffer2) => 
{soundWind.setBuffer(buffer2); 
soundWind.setLoop(true); 
soundWind.play()
});

let stepInterval;
const stepDelay = 600;

window.addEventListener("keydown", (event) => {
  if ((event.key === "w"|| event.key === "s") && !stepInterval) {
      playStepSound();
      stepInterval = setInterval(playStepSound, stepDelay);
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "w"|| event.key === "s") {
      clearInterval(stepInterval);
      stepInterval = null;
      sound.stop();
  }
});

function playStepSound() {
  sound.stop();
  sound.play();
}

const raycaster = new THREE.Raycaster();
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

document.addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => console.log("Pointer Lock Enabled"));
controls.addEventListener('unlock', () => console.log("Pointer Lock Disabled"));

const moveSpeed = .2;
const playerHeight = 3.5;
const keys = {};

document.addEventListener('keydown', (event) => (keys[event.code] = true));
document.addEventListener('keyup', (event) => (keys[event.code] = false));


function handleMovement() {
    if (!controls.isLocked) return;
    
    const originalPosition = camera.position.clone();

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;

    if (keys['KeyW']) controls.moveForward(moveSpeed);
    if (keys['KeyS']) controls.moveForward(-moveSpeed);
    if (keys['KeyA']) controls.moveRight(-moveSpeed);
    if (keys['KeyD']) controls.moveRight(moveSpeed);

    raycaster.firstHitOnly = true;
    const movementVector = camera.position.clone().sub(originalPosition);

    if (movementVector.length() > 0) {
      raycaster.set(originalPosition, movementVector.normalize());
      const wallHits = raycaster.intersectObjects(galleries.map(g => g.group), true);

      if (wallHits[0] && wallHits[0]. distance < movementVector.length()){
        camera.position.copy(originalPosition);
      }
    }

    raycaster.set(camera.position, new THREE.Vector3(0, -1, 0));

    const hits = raycaster.intersectObjects([...galleries.map(g => g.group), ground], true);

    if (hits[0]) camera.position.y = hits[0].point.y + playerHeight;

    const boundary = terrainSize/2 - 5;
    camera.position.x = Math.max(-boundary, Math.min(boundary, camera.position.x));
    camera.position.z = Math.max(-boundary, Math.min(boundary, camera.position.z));

  };

const ambientLight = new THREE.AmbientLight(0xFFFFFF, .5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 2);
directionalLight.position.set(1000, 500, 1000);
directionalLight.target.position.set(0, 0, 0);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, .5);
directionalLight2.position.set(-1000, 500, -1000);
directionalLight2.target.position.set(0, 0, 0);
scene.add(directionalLight2);


//GALLERIES
const cellSize = 125;
const cellsPerSide = groundSize / cellSize;
const galleryCount = 2;

const gridPositions = [];
for (let x = 0; x < cellsPerSide; x++) {
  for (let z = 0; z < cellsPerSide; z++) {
    gridPositions.push({
      x: x,
      z: z,
      sort: Math.random()
    });
  }
}

gridPositions.sort((a, b) => a.sort - b.sort);

(async () => {
for (let i = 0; i < galleryCount; i++) {

  const pos = gridPositions[i];

  const x = (pos.x - (cellsPerSide-1)/2) * cellSize + (Math.random() - 0.5) * cellSize * 0.5;
  const z = (pos.z - (cellsPerSide-1)/2) * cellSize + (Math.random() - 0.5) * cellSize * 0.5;

  const rotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);

  const newGallery = await createGallery(x, 10, z, rotation);
  galleries.push(newGallery)
}
})();

//TERRAIN
generateTerrain(galleries);
addFence();

window.addEventListener('resize', onWindowResize );

async function createGallery(x, y, z, rotation) {

const gltfLoader = new GLTFLoader();

const group = new THREE.Group();
group.position.set(x, y, z);

gltfLoader.load('models/galleryblank2.glb', function (gltf) {
  const model = gltf.scene;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.material.needsUpdate = true;
      child.geometry.boundsTree = new MeshBVH(child.geometry);
    
    }
  })
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrix();

  model.scale.set(2, 2, 2);
  group.add(model);
  });

  const screenGeo = new THREE.PlaneGeometry(1.28, .72)
  const screenMat = new THREE.MeshBasicMaterial({
    color:0x000000,
    opacity: 0.1,
    blending: THREE.NoBlending,
    side: THREE.DoubleSide
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 5, -8.15);
  
  const screenScale = 10;
  screen.scale.set(screenScale, screenScale, screenScale);
  group.add(screen);

  scene.add(group);
  group.rotation.copy(rotation);

  const videoId = await getValidId();

  const iframe = document.createElement('iframe');
  iframe.src = `about:blank`;
  iframe.style.width = (1280 * screenScale) + 'px';
  iframe.style.height = (720 * screenScale) + 'px';
  iframe.style.border = '0px';
  iframe.style.backgroundColor = 'black';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = false;

  const div = document.createElement('div');
  div.appendChild(iframe);
  div.style.pointerEvents = 'auto';
  
  const ytVideo = new CSS3DObject(div);
  ytVideo.scale.set(0.001, 0.001, 0.001);
  
  const screenWorldPos = screen.getWorldPosition(new THREE.Vector3());
  ytVideo.position.copy(screenWorldPos);
  ytVideo.rotation.copy(group.rotation);

  cssScene.add(ytVideo);

  const light = new THREE.PointLight( 0xffffff, 30, 100 );
  light.position.set(0, 6, 0);
  group.add(light); 
  
  return {group, iframe, ytVideo, screen, videoId
  };
  }


async function getValidId() {
    const apiKey = process.env.VITE_API_KEY;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    const maxAttempts = 2;

    console.log("Environment Variables:", {
      VITE_API_KEY: process.env.VITE_API_KEY,
      ALL_ENV: process.env
    });
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const query = Array(3).fill().map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${apiKey}&maxResults=1&type=video&videoEmbeddable=true&videoDuration=medium&part=snippet&q=${query}`);
    
    try {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            const videoId = data.items[0].id.videoId;
            console.log(`Found video: ${videoId} (query: ${query})`);
            return videoId;
          }
        } catch (err) {
          console.warn("Error parsing API response:", err);
        }
      }
      
    console.warn("Couldn't find random video, soz. Using fallback");
    return "wEYkU1pHUG8";
      
}

function generateTerrain() {

const terrainRes = 250;

const planeGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainRes, terrainRes);
const planeTexture = new THREE.TextureLoader().load("textures/images/rocks.jpg");
planeTexture.wrapS = THREE.RepeatWrapping;
planeTexture.wrapT = THREE.RepeatWrapping;
planeTexture.repeat.set( 100, 100);
const planeMat = new THREE.MeshBasicMaterial({ map: planeTexture });
ground = new THREE.Mesh(planeGeo,planeMat);

const noise = new ImprovedNoise();
const verts = planeGeo.attributes.position;

for (let i = 0; i < verts.count; i++){
  const x = verts.getX(i);
  const y = verts.getY(i);
  let z = noise.noise(x * 0.04, y * 0.04, 0) * 4;
  verts.setZ(i, z);
}

verts.needsUpdate = true;
planeGeo.computeVertexNormals();

ground.position.y = -.05
ground.rotation.x = - Math.PI / 2;
scene.add(ground);    
}

function addFence() {
  const fenceGeo = new THREE.PlaneGeometry(terrainSize, 20);
  const fenceTexture = new THREE.TextureLoader().load("textures/images/fence.png");
  fenceTexture.wrapS = THREE.RepeatWrapping;
  fenceTexture.wrapT = THREE.RepeatWrapping;
  fenceTexture.repeat.set( 100, 2.5);
  const fenceMat = new THREE.MeshStandardMaterial({ 
    map: fenceTexture, 
    transparent: true, 
    side: THREE.DoubleSide  });
  const fence = new THREE.Mesh(fenceGeo, fenceMat);
  const fenceSouth = fence.clone();
  const fenceNorth = fence.clone();
  const fenceWest = fence.clone().rotateY(Math.PI/2);
  const fenceEast = fence.clone().rotateY(Math.PI/2);

  fenceSouth.position.set(0, 1, -terrainSize/2);
  fenceNorth.position.set(0, 1, terrainSize/2);
  fenceWest.position.set(-terrainSize/2, 1, 0);
  fenceEast.position.set(terrainSize/2, 1, 0);

  scene.add(fenceSouth, fenceNorth, fenceWest, fenceEast);
}



function checkIfInRange(camera) {
  if (galleries.length === 0) return;
  let shouldLowerVolume = false;


   galleries.forEach((gallery) => {
    const galleryPosition = gallery.group.position;
    const distance = camera.position.distanceTo(galleryPosition);

  if (distance < 11) {
      
    shouldLowerVolume = true;
      gallery.ytVideo.element.style.display = 'block';
      if (gallery.iframe.src === 'about:blank') {
        gallery.iframe.src = `https://www.youtube.com/embed/${gallery.videoId}?autoplay=1&`;
      }
  } else {
      gallery.ytVideo.element.style.display = 'none';
      if (gallery.iframe.src !== 'about:blank') {
        gallery.iframe.src = 'about:blank';
      }
    }
  });

  if (shouldLowerVolume) {
    soundWind.setVolume(0.05);
  } else {
    soundWind.setVolume(0.4);
  }
  
}

  function animate () {
    requestAnimationFrame(animate);

    cameraInfo.position.x = camera.position.x;
    cameraInfo.position.y = camera.position.y;
    cameraInfo.position.z = camera.position.z;

    handleMovement();

    checkIfInRange(camera);
   
    renderer.clear();
    renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);

  }

  animate();

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    cssRenderer.setSize(window.innerWidth, window.innerHeight);
  }

