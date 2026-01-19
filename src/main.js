import './style.css'
import { FaceDetectorManager } from './modules/faceDetector.js'
import { ThreeSceneManager } from './modules/threeScene.js'
import { CameraController } from './modules/cameraController.js'
import { PositionSmoother } from './modules/smoothing.js'

/**
 * Off-Axis Projection Demo with MediaPipe Face Tracking
 * Complete integration of all modules
 */
class OffAxisProjectionApp {
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
    this.scale = 2.0
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
   * Initialize Three.js scene
   */
  initThreeScene() {
    try {
      console.log('Initializing Three.js scene...')

      // Create scene manager
      this.sceneManager = new ThreeSceneManager(this.app)

      // Create camera controller
      this.cameraController = new CameraController()

      // Set camera in scene manager
      this.sceneManager.setCamera(this.cameraController.getCamera())

      // Create position smoother
      this.smoother = new PositionSmoother()

      console.log('Three.js scene initialized successfully')
    } catch (error) {
      console.error('Three.js initialization error:', error)
      this.showError('3Dシーンの初期化に失敗しました。')
      throw error
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
        const eyeY = -normalizedY * maxOffsetY * this.scale // Also invert Y

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
      console.log('Starting Off-Axis Projection Demo initialization...')

      // Step 1: Show loading screen
      this.showLoading('初期化中...')

      // Step 2: Initialize camera stream
      this.showLoading('カメラにアクセス中...')
      await this.initCamera()

      // Step 3: Initialize MediaPipe
      this.showLoading('MediaPipeモデル読み込み中...')
      await this.initMediaPipe()

      // Step 4: Initialize Three.js scene
      this.showLoading('3Dシーンを構築中...')
      this.initThreeScene()

      // Step 5: Hide loading screen
      this.hideLoading()
      this.hideNoFaceWarning()

      // Step 6: Start animation loop
      this.isRunning = true
      this.lastTime = performance.now()
      this.animate()

      console.log('Application initialized successfully!')
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
const app = new OffAxisProjectionApp()
app.initialize()

// Make app globally accessible for debugging
window.app = app
