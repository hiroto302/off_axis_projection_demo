import './style.css'
import * as THREE from 'three'

// Simplified Off-Axis Projection Demo
// Basic Three.js setup to ensure cube is visible

class OffAxisProjectionApp {
  constructor() {
    this.app = document.getElementById('app')
    this.scene = null
    this.camera = null
    this.renderer = null
    this.cube = null
    this.isRunning = false
  }

  async initialize() {
    try {
      console.log('Initializing basic Three.js scene...')

      // Create scene
      this.scene = new THREE.Scene()
      this.scene.background = new THREE.Color(0x1a1a2e)

      // Create camera
      this.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      )
      this.camera.position.z = 5
      console.log('Camera position:', this.camera.position)

      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true })
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.app.appendChild(this.renderer.domElement)
      console.log('Renderer created')

      // Create cube
      const geometry = new THREE.BoxGeometry(2, 2, 2)
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x00ff88,
        metalness: 0.3,
        roughness: 0.4
      })
      this.cube = new THREE.Mesh(geometry, material)
      this.cube.position.set(0, 0, 0)
      this.scene.add(this.cube)
      console.log('Cube created at:', this.cube.position)

      // Add wireframe to cube
      const edges = new THREE.EdgesGeometry(geometry)
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff })
      const wireframe = new THREE.LineSegments(edges, lineMaterial)
      this.cube.add(wireframe)

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0)
      directionalLight.position.set(5, 5, 5)
      this.scene.add(directionalLight)
      console.log('Lights added')

      // Add grid for reference
      const gridHelper = new THREE.GridHelper(10, 10)
      gridHelper.position.y = -2
      this.scene.add(gridHelper)

      // Add axes helper
      const axesHelper = new THREE.AxesHelper(3)
      this.scene.add(axesHelper)

      // Handle window resize
      window.addEventListener('resize', () => this.onWindowResize())

      // Hide loading screen
      const loadingElement = document.getElementById('loading')
      if (loadingElement) {
        loadingElement.classList.add('hidden')
      }

      // Start animation loop
      this.isRunning = true
      this.animate()

      console.log('Application initialized successfully')
      console.log('Scene children:', this.scene.children.length)
    } catch (error) {
      console.error('Initialization error:', error)
      alert('初期化エラー: ' + error.message)
    }
  }

  animate() {
    if (!this.isRunning) return

    requestAnimationFrame(() => this.animate())

    // Rotate cube for visual feedback
    // if (this.cube) {
    //   this.cube.rotation.x += 0.01
    //   this.cube.rotation.y += 0.01
    // }

    // Render scene
    this.renderer.render(this.scene, this.camera)
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  dispose() {
    this.isRunning = false
    window.removeEventListener('resize', this.onWindowResize)
    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}

// Initialize app when DOM is ready
const app = new OffAxisProjectionApp()
app.initialize()

// Make app globally accessible for debugging
window.app = app
