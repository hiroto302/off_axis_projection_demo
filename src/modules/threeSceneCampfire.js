import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

/**
 * Three.js Scene Manager for Campfire version with Skybox
 * Handles scene setup with skybox environment and GLTF model loading
 */
export class ThreeSceneCampfireManager {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.renderer = null;
    this.camera = null;

    // Campfire model related
    this.campfireModel = null;
    this.campfireAnimations = [];
    this.mixer = null; // Animation mixer

    // Skybox related
    this.cubeTexture = null;

    // Object references
    this.objects = {};

    // Lighting
    this.lights = {};

    // Flicker control
    this.enableFlicker = true;

    // DO NOT call initialize() here - it will be called from main-campfire.js
  }

  /**
   * Initialize the Three.js scene with async asset loading
   */
  async initialize() {
    this.createScene();
    await this.loadSkybox(); // Skybox loading
    await this.loadCampfire(); // Campfire model loading
    this.setupLighting();
    this.setupRenderer();
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);
    console.log('Three.js campfire scene initialized');
  }

  /**
   * Create the base scene
   */
  createScene() {
    this.scene = new THREE.Scene();
    // Temporary background (will be replaced by skybox)
    this.scene.background = new THREE.Color(0x0a0a1e);
  }

  /**
   * Load skybox using EXRLoader for HDRI panorama
   */
  async loadSkybox() {
    const loader = new EXRLoader();

    try {
      // Load EXR HDRI panorama
      const texture = await loader.loadAsync('/src/assets/textures/skybox/kloppenheim_02_4k.exr');

      // Set texture mapping to equirectangular
      texture.mapping = THREE.EquirectangularReflectionMapping;

      // Set as scene background and environment map
      this.scene.background = texture;
      this.scene.environment = texture;

      // Store reference
      this.cubeTexture = texture;

      console.log('✅ HDRI Skybox loaded');
    } catch (error) {
      console.error('❌ Skybox loading failed:', error);
      // Fallback: keep color background
      console.log('Using fallback color background');
    }
  }

  /**
   * Load campfire GLTF model
   */
  /**
   * Load campfire GLTF model
   * TEMPORARILY DISABLED FOR PERFORMANCE TESTING
   */
  async loadCampfire() {
    console.log('⚠️ Campfire model loading is DISABLED for performance testing');
    
    // Create a simple placeholder instead
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const cube = new THREE.Mesh(geometry, material);
    group.add(cube);
    group.position.set(0, 0, 0);
    
    this.scene.add(group);
    this.objects.campfire = group;
    
    console.log('✅ Placeholder cube created (model disabled)');
    
    /* ORIGINAL CODE - COMMENTED OUT FOR TESTING
    const loader = new GLTFLoader();

    try {
      const gltf = await loader.loadAsync('/src/assets/models/cozy_campfire_-_shape_key_animation.glb');
      this.campfireModel = gltf.scene;

      // Model scale and position adjustment
      this.campfireModel.scale.set(1, 1, 1); // Adjust as needed
      this.campfireModel.position.set(0, -1, 0); // Place on ground

      this.scene.add(this.campfireModel);

      // If model has animations
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.campfireModel);
        gltf.animations.forEach((clip) => {
          this.mixer.clipAction(clip).play();
        });
        console.log(`✅ Campfire animations: ${gltf.animations.length}`);
      }

      // Store reference
      this.objects.campfire = this.campfireModel;

      console.log('✅ Campfire model loaded');
    } catch (error) {
      console.error('❌ Campfire model loading failed:', error);
      // Fallback: create simple geometry
      this.createFallbackCampfire();
    }
    */
  }

  /**
   * Create fallback campfire if model loading fails
   */
  createFallbackCampfire() {
    const group = new THREE.Group();

    // Logs
    const logGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
    const logMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

    const log1 = new THREE.Mesh(logGeometry, logMaterial);
    log1.rotation.z = Math.PI / 2;
    group.add(log1);

    const log2 = new THREE.Mesh(logGeometry, logMaterial);
    log2.rotation.x = Math.PI / 2;
    group.add(log2);

    // Flame (cone)
    const flameGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
    const flameMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF6600,
      emissive: 0xFF6600,
      emissiveIntensity: 0.8
    });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.y = 0.75;
    group.add(flame);

    group.position.set(0, -1, 0);
    this.scene.add(group);
    this.objects.campfire = group;

    console.log('✅ Fallback campfire created');
  }

  /**
   * Setup scene lighting
   */
  setupLighting() {
    // Ambient light
    this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.lights.ambient);

    // Campfire light (point light)
    this.lights.fire = new THREE.PointLight(0xFF6600, 2.0, 10);
    this.lights.fire.position.set(0, 0.5, 0);
    this.scene.add(this.lights.fire);

    // Directional light (moonlight)
    this.lights.directional = new THREE.DirectionalLight(0x8899ff, 0.3);
    this.lights.directional.position.set(5, 10, 7.5);
    this.scene.add(this.lights.directional);

    console.log('✅ Lighting setup');
  }

  /**
   * Setup WebGL renderer
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Tone mapping for HDR environment maps
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.container.appendChild(this.renderer.domElement);
    console.log('✅ Renderer setup');
  }

  /**
   * Set the camera for rendering
   * @param {THREE.PerspectiveCamera} camera
   */
  setCamera(camera) {
    this.camera = camera;
  }

  /**
   * Render the scene
   */
  render() {
    if (this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Update animations and effects
   * @param {number} deltaTime - Time delta in milliseconds
   */
  update(deltaTime) {
    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(deltaTime / 1000); // Convert ms to seconds
    }

    // Fire flicker effect
    if (this.lights.fire && this.enableFlicker) {
      const flicker = Math.sin(Date.now() * 0.005) * 0.2;
      this.lights.fire.intensity = 2.0 + flicker;
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    if (this.camera) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Add an object to the scene
   * @param {THREE.Object3D} object
   */
  addObject(object) {
    this.scene.add(object);
  }

  /**
   * Remove an object from the scene
   * @param {THREE.Object3D} object
   */
  removeObject(object) {
    this.scene.remove(object);
  }

  /**
   * Clean up resources
   */
  dispose() {
    window.removeEventListener('resize', this.onWindowResize);

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }

    if (this.mixer) {
      this.mixer.stopAllAction();
    }

    this.scene.clear();
    console.log('✅ Scene disposed');
  }
}
