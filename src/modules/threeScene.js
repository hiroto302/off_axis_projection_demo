import * as THREE from 'three';

/**
 * Three.js Scene Manager
 * Handles scene setup, lighting, grid, and rendering
 */
export class ThreeSceneManager {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.renderer = null;
    this.grid = null;
    this.lights = {};

    this.initialize();
  }

  /**
   * Initialize the Three.js scene
   */
  /**
   * Initialize the Three.js scene
   */
  initialize() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1e);

    // Create grid helper
    this.grid = new THREE.GridHelper(20, 20, 0xff8844, 0xdd6633);
    this.grid.position.y = -2;
    this.scene.add(this.grid);

    console.log('✅ Grid added');

    // Add 3D objects for off-axis projection demonstration
    this.create3DObjects();

    // Setup lighting
    this.setupLighting();

    // Create renderer
    this.setupRenderer();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    console.log('Three.js scene initialized');
  }

  /**
   * Create 3D objects to demonstrate off-axis projection
   */
  /**
   * Create 3D objects to demonstrate off-axis projection
   */
  create3DObjects() {
    // Central cube with wireframe
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.3,
      roughness: 0.4
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 0, 0);
    this.scene.add(cube);

    // Add wireframe edges to the cube
    const wireframeGeometry = new THREE.EdgesGeometry(cubeGeometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    cube.add(wireframe);

    // Store references for potential animation
    this.objects = {
      cube
    };

    console.log('✅ Cube added');
  }

  /**
   * Setup scene lighting
   */
  setupLighting() {
    // Ambient light for soft overall illumination
    this.lights.ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.lights.ambient);

    // Directional light for depth and shadows
    this.lights.directional = new THREE.DirectionalLight(0xffffff, 2.0);
    this.lights.directional.position.set(5, 10, 7.5);
    this.scene.add(this.lights.directional);

    // Add additional point light for better visibility
    this.lights.point = new THREE.PointLight(0xffffff, 1.5, 100);
    this.lights.point.position.set(0, 5, 10);
    this.scene.add(this.lights.point);

    console.log('Lighting setup complete');
  }

  /**
   * Setup WebGL renderer
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
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

    if (this.grid) {
      this.grid.geometry.dispose();
      this.grid.material.dispose();
    }

    this.scene.clear();
  }
}
