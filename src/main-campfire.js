import './style.css'
import { GUI } from 'lil-gui'
import { FaceDetectorManager } from './modules/faceDetector.js'
import { ThreeSceneCampfireManager } from './modules/threeSceneCampfire.js'
import { CameraController } from './modules/cameraController.js'
import { PositionSmoother } from './modules/smoothing.js'

/**
 * Off-Axis Projection Demo with MediaPipe Face Tracking - Campfire Edition
 * Features skybox environment and GLTF model loading
 */
class OffAxisProjectionCampfireApp {
  constructor() {
    // DOM elements
    this.app = document.getElementById('app')
    this.webcam = document.getElementById('webcam')
    this.loading = document.getElementById('loading')
    this.noFaceWarning = document.getElementById('no-face-warning')

    // Module instances
    this.faceDetector = null
    this.sceneManager = null
    this.cameraController = null
    this.smoother = null

    // State
    this.isRunning = false
    this.frameCount = 0
    this.lastTime = performance.now()
    this.noFaceTimer = 0
    this.noFaceTimeout = 2000 // 2 seconds

    // Smoothing parameters
    this.smoothingAlpha = 0.1

    // Scale for head movement amplification
    this.scale = 1.0

    // GUI parameters
    this.guiParams = {
      smoothing: 0.1,
      scale: 1.0,
      viewingDistance: 10,
      screenWidth: 16.59,
      showVideo: false,
      showStats: false,
      manualControl: false,
      cameraX: 0,
      cameraY: 2,
      // Campfire effects
      fireIntensity: 2.0,
      fireFlicker: true
    }

    // GUI instance
    this.gui = null
  }

  /**
   * Initialize camera stream
   */
  async initCamera() {
    try {
      console.log('Requesting camera access...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          frameRate: 30,
          facingMode: 'user'
        }
      })

      this.webcam.srcObject = stream

      // Wait for video to be ready
      await new Promise((resolve) => {
        this.webcam.onloadedmetadata = () => {
          this.webcam.play()
          resolve()
        }
      })

      console.log('Camera initialized successfully')
    } catch (error) {
      console.error('Camera initialization error:', error)

      let errorMessage = 'カメラの初期化に失敗しました'
      if (error.name === 'NotAllowedError') {
        errorMessage = 'カメラアクセスが拒否されました。ブラウザの設定を確認してください。'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'カメラが見つかりませんでした。'
      }

      this.showError(errorMessage)
      throw error
    }
  }

  /**
   * Initialize MediaPipe Face Detector
   */
  async initMediaPipe() {
    try {
      console.log('Initializing MediaPipe Face Detector...')
      this.showLoading('MediaPipeモデル読み込み中...')

      this.faceDetector = new FaceDetectorManager()
      await this.faceDetector.initialize()

      console.log('MediaPipe initialized successfully')
    } catch (error) {
      console.error('MediaPipe initialization error:', error)
      this.showError('MediaPipeモデルの読み込みに失敗しました。ページを再読み込みしてください。')
      throw error
    }
  }

  /**
   * Initialize Three.js scene with campfire and skybox
   */
  async initThreeScene() {
    try {
      console.log('Initializing Three.js campfire scene...')

      // Create campfire scene manager
      this.sceneManager = new ThreeSceneCampfireManager(this.app)

      // Wait for async initialization to complete
      await this.sceneManager.initialize()

      // Create camera controller
      this.cameraController = new CameraController()

      // Set camera in scene manager
      this.sceneManager.setCamera(this.cameraController.getCamera())

      // Create position smoother
      this.smoother = new PositionSmoother()

      console.log('Three.js campfire scene initialized successfully')
    } catch (error) {
      console.error('Three.js initialization error:', error)
      this.showError('3Dシーンの初期化に失敗しました。')
      throw error
    }
  }

  /**
   * Initialize lil-gui debug interface
   */
  initGUI() {
    try {
      console.log('Initializing GUI...')

      this.gui = new GUI()
      this.gui.title('Debug Controls - Campfire Edition')

      // Parameter controls folder
      const paramsFolder = this.gui.addFolder('Parameters')

      paramsFolder
        .add(this.guiParams, 'smoothing', 0.01, 0.5, 0.01)
        .name('Smoothing')
        .onChange((value) => {
          this.smoothingAlpha = value
        })

      paramsFolder
        .add(this.guiParams, 'scale', 0.5, 5.0, 0.1)
        .name('Scale')
        .onChange((value) => {
          this.scale = value
        })

      paramsFolder
        .add(this.guiParams, 'viewingDistance', 5, 30, 0.5)
        .name('Viewing Distance (cm)')
        .onChange((value) => {
          if (this.cameraController) {
            this.cameraController.viewingDistance = value
          }
        })

      paramsFolder
        .add(this.guiParams, 'screenWidth', 10, 40, 0.1)
        .name('Screen Width (cm)')
        .onChange((value) => {
          if (this.cameraController) {
            this.cameraController.screenWidth = value
          }
        })

      paramsFolder.open()

      // Campfire effects folder
      const campfireFolder = this.gui.addFolder('Campfire Effects')

      campfireFolder
        .add(this.guiParams, 'fireIntensity', 0.5, 5.0, 0.1)
        .name('Fire Light Intensity')
        .onChange((value) => {
          if (this.sceneManager.lights && this.sceneManager.lights.fire) {
            this.sceneManager.lights.fire.intensity = value
          }
        })

      campfireFolder
        .add(this.guiParams, 'fireFlicker')
        .name('Fire Flicker')
        .onChange((value) => {
          this.sceneManager.enableFlicker = value
        })

      campfireFolder.close()

      // Debug features folder
      const debugFolder = this.gui.addFolder('Debug')

      debugFolder
        .add(this.guiParams, 'showVideo')
        .name('Show Video')
        .onChange((value) => {
          if (this.webcam) {
            if (value) {
              this.webcam.classList.add('visible')
              this.webcam.style.zIndex = '200'
            } else {
              this.webcam.classList.remove('visible')
              this.webcam.style.zIndex = '-1'
            }
          }
        })

      debugFolder
        .add(this.guiParams, 'showStats')
        .name('Show Stats')
        .onChange((value) => {
          // Stats.js integration would go here
          console.log('Show Stats:', value)
        })

      debugFolder.close()

      // Camera Position folder for manual control
      const cameraFolder = this.gui.addFolder('Camera Position')

      cameraFolder
        .add(this.guiParams, 'manualControl')
        .name('Manual Control')
        .onChange((value) => {
          if (value) {
            // Reset camera position when entering manual mode
            this.guiParams.cameraX = 0
            this.guiParams.cameraY = 2
          }
        })

      cameraFolder
        .add(this.guiParams, 'cameraX', -20, 20, 0.1)
        .name('Camera X (cm)')
        .listen() // Update display when value changes programmatically

      cameraFolder
        .add(this.guiParams, 'cameraY', -15, 15, 0.1)
        .name('Camera Y (cm)')
        .listen() // Update display when value changes programmatically

      cameraFolder.close()

      console.log('GUI initialized successfully')
    } catch (error) {
      console.error('GUI initialization error:', error)
      // Non-critical error, don't throw
    }
  }

  /**
   * Main animation loop
   */
  animate() {
    if (!this.isRunning) return

    requestAnimationFrame(() => this.animate())

    // Calculate delta time
    const currentTime = performance.now()
    const deltaTime = currentTime - this.lastTime
    this.lastTime = currentTime

    this.frameCount++

    // Update campfire model animations and effects
    if (this.sceneManager && this.sceneManager.update) {
      this.sceneManager.update(deltaTime)
    }

    // Run face detection every 2 frames (30fps instead of 60fps)
    if (this.frameCount % 2 === 0) {
      this.detectAndUpdate(currentTime)
    }

    // Update no-face timer if needed
    if (this.noFaceTimer > 0 && this.noFaceTimer < this.noFaceTimeout) {
      this.noFaceTimer += deltaTime

      if (this.noFaceTimer >= this.noFaceTimeout) {
        this.handleNoFaceTimeout()
      }
    }

    // Render scene
    this.sceneManager.render()
  }

  /**
   * Detect face and update camera offset
   */
  detectAndUpdate(timestamp) {
    if (!this.faceDetector || !this.webcam) return

    try {
      // Manual control mode - skip face detection
      if (this.guiParams.manualControl) {
        // Apply smoothing to manual camera position
        const smoothed = this.smoother.update(
          { x: this.guiParams.cameraX, y: this.guiParams.cameraY, z: this.cameraController.viewingDistance },
          { x: this.smoothingAlpha, y: this.smoothingAlpha, z: 0.15 }
        )

        // Update camera projection with manual position
        this.cameraController.updateProjection(smoothed.x, smoothed.y, smoothed.z)

        // Hide no-face warning in manual mode
        this.hideNoFaceWarning()
        return
      }

      // Detect face in current video frame
      const detection = this.faceDetector.detectFace(this.webcam, timestamp)

      if (detection) {
        // Face detected - hide warning
        this.hideNoFaceWarning()
        this.noFaceTimer = 0
        this.cameraController.resetNoFaceTimer()

        // Convert MediaPipe normalized coords [0,1] to physical eye position in cm
        // MediaPipe: (0.5, 0.5) = center of camera view
        // Assuming user is roughly centered when face is at (0.5, 0.5)
        // and moves within reasonable range (±20cm X, ±15cm Y)
        const maxOffsetX = 20 // cm
        const maxOffsetY = 15 // cm

        // Convert [0,1] to [-1,1] centered coords
        const normalizedX = (detection.x - 0.5) * 2
        const normalizedY = (detection.y - 0.5) * 2

        // Convert to physical eye position (cm)
        // Invert X for mirror effect (moving right → see left side of object)
        const eyeX = -normalizedX * maxOffsetX * this.scale
        const eyeY = -normalizedY * maxOffsetY * this.scale + this.cameraController.cameraY // Add cameraY offset

        // Apply smoothing to eye position
        const smoothed = this.smoother.update(
          { x: eyeX, y: eyeY, z: this.cameraController.viewingDistance },
          { x: this.smoothingAlpha, y: this.smoothingAlpha, z: 0.15 }
        )

        // Update camera projection with eye position
        this.cameraController.updateProjection(smoothed.x, smoothed.y, smoothed.z)
      } else {
        // No face detected - start timer
        if (this.noFaceTimer === 0) {
          this.noFaceTimer = 1 // Start counting
        }
      }
    } catch (error) {
      console.error('Face detection error:', error)
    }
  }

  /**
   * Handle no face detected timeout
   */
  handleNoFaceTimeout() {
    this.showNoFaceWarning()
    this.cameraController.returnToDefaultView()
  }

  /**
   * Show loading screen
   */
  showLoading(message = 'Loading...') {
    if (this.loading) {
      const loadingText = this.loading.querySelector('p')
      if (loadingText) {
        loadingText.textContent = message
      }
      this.loading.classList.remove('hidden')
    }
  }

  /**
   * Hide loading screen
   */
  hideLoading() {
    if (this.loading) {
      this.loading.classList.add('hidden')
    }
  }

  /**
   * Show no-face warning
   */
  showNoFaceWarning() {
    if (this.noFaceWarning) {
      this.noFaceWarning.classList.remove('hidden')
    }
  }

  /**
   * Hide no-face warning
   */
  hideNoFaceWarning() {
    if (this.noFaceWarning) {
      this.noFaceWarning.classList.add('hidden')
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.hideLoading()
    alert(message)
  }

  /**
   * Main initialization flow
   */
  async initialize() {
    try {
      console.log('Starting Off-Axis Projection Campfire Demo initialization...')

      // Step 1: Show loading screen
      this.showLoading('初期化中...')

      // Step 2: Initialize camera stream
      this.showLoading('カメラにアクセス中...')
      await this.initCamera()

      // Step 3: Initialize MediaPipe
      this.showLoading('MediaPipeモデル読み込み中...')
      await this.initMediaPipe()

      // Step 4: Initialize Three.js campfire scene
      this.showLoading('3Dシーンを構築中...')
      await this.initThreeScene()

      // Step 5: Initialize GUI
      this.initGUI()

      // Step 6: Hide loading screen
      this.hideLoading()
      this.hideNoFaceWarning()

      // Step 7: Start animation loop
      this.isRunning = true
      this.lastTime = performance.now()
      this.animate()

      console.log('Campfire application initialized successfully!')
      console.log('Move your head to see the off-axis projection effect.')
    } catch (error) {
      console.error('Initialization failed:', error)
      // Error messages already shown in individual init functions
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.isRunning = false

    if (this.gui) {
      this.gui.destroy()
    }

    if (this.faceDetector) {
      this.faceDetector.dispose()
    }

    if (this.sceneManager) {
      this.sceneManager.dispose()
    }

    if (this.webcam && this.webcam.srcObject) {
      const tracks = this.webcam.srcObject.getTracks()
      tracks.forEach(track => track.stop())
    }
  }
}

// Initialize app when DOM is ready
const app = new OffAxisProjectionCampfireApp()
app.initialize()

// Make app globally accessible for debugging
window.app = app
