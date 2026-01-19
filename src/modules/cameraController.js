import * as THREE from 'three';

/**
 * Camera Controller for Off-Axis Projection
 * Manages camera setup and view offset based on face position
 */
export class CameraController {
  constructor() {
    this.camera = null;
    this.defaultPosition = new THREE.Vector3(0, 0, 60);
    this.viewingDistance = 60; // cm
    this.screenWidth = 33.8; // cm (15.4 inch, 16:9)
    this.screenHeight = 19.0; // cm
    this.scale = 2.0;

    this.offsetX = 0;
    this.offsetY = 0;

    this.noFaceTimer = 0;
    this.noFaceTimeout = 2000; // 2 seconds
    this.isReturningToDefault = false;

    this.initialize();
  }

  /**
   * Initialize the PerspectiveCamera
   */
  initialize() {
    this.camera = new THREE.PerspectiveCamera(
      50, // FOV
      window.innerWidth / window.innerHeight, // aspect
      0.1, // near
      1000 // far
    );

    this.camera.position.copy(this.defaultPosition);
    this.camera.lookAt(0, 0, 0);

    console.log('Camera controller initialized');
  }

  /**
   * Convert MediaPipe normalized coordinates to Three.js offset
   * @param {number} faceX - Normalized X coordinate [0, 1]
   * @param {number} faceY - Normalized Y coordinate [0, 1]
   * @returns {Object} Offset coordinates {x, y}
   */
  convertToOffset(faceX, faceY) {
    // Convert [0, 1] to [-1, 1] with center at 0
    const normalizedX = (faceX - 0.5) * 2;
    const normalizedY = (faceY - 0.5) * 2;

    // Convert to physical offset (considering screen size and scale)
    const offsetX = normalizedX * (this.screenWidth / 2) * this.scale;
    const offsetY = -normalizedY * (this.screenHeight / 2) * this.scale; // Y-axis inversion

    return { x: offsetX, y: offsetY };
  }

  /**
   * Apply view offset to camera
   * @param {number} smoothedX - Smoothed X offset
   * @param {number} smoothedY - Smoothed Y offset
   */
  applyViewOffset(smoothedX, smoothedY) {
    this.offsetX = smoothedX;
    this.offsetY = smoothedY;

    this.camera.setViewOffset(
      window.innerWidth,
      window.innerHeight,
      smoothedX,
      smoothedY,
      window.innerWidth,
      window.innerHeight
    );

    this.noFaceTimer = 0;
    this.isReturningToDefault = false;
  }

  /**
   * Update no-face timer and return to default view if needed
   * @param {number} deltaTime - Time elapsed since last update (ms)
   */
  updateNoFaceTimer(deltaTime) {
    this.noFaceTimer += deltaTime;

    if (this.noFaceTimer > this.noFaceTimeout && !this.isReturningToDefault) {
      this.returnToDefaultView();
    }
  }

  /**
   * Smoothly return to default view
   */
  returnToDefaultView() {
    this.isReturningToDefault = true;

    // Smoothly animate offset back to (0, 0)
    const animateReturn = () => {
      const damping = 0.1;
      this.offsetX *= (1 - damping);
      this.offsetY *= (1 - damping);

      this.camera.setViewOffset(
        window.innerWidth,
        window.innerHeight,
        this.offsetX,
        this.offsetY,
        window.innerWidth,
        window.innerHeight
      );

      // Continue animation if offsets are still significant
      if (Math.abs(this.offsetX) > 0.1 || Math.abs(this.offsetY) > 0.1) {
        requestAnimationFrame(animateReturn);
      } else {
        // Clear view offset completely
        this.camera.clearViewOffset();
        this.offsetX = 0;
        this.offsetY = 0;
        this.isReturningToDefault = false;
      }
    };

    animateReturn();
  }

  /**
   * Reset no-face timer (called when face is detected)
   */
  resetNoFaceTimer() {
    this.noFaceTimer = 0;
    this.isReturningToDefault = false;
  }

  /**
   * Update camera parameters
   * @param {Object} params - Camera parameters to update
   */
  updateParameters(params) {
    if (params.viewingDistance !== undefined) {
      this.viewingDistance = params.viewingDistance;
      this.defaultPosition.z = params.viewingDistance;
      this.camera.position.z = params.viewingDistance;
    }

    if (params.screenWidth !== undefined) {
      this.screenWidth = params.screenWidth;
    }

    if (params.scale !== undefined) {
      this.scale = params.scale;
    }
  }

  /**
   * Get the camera instance
   * @returns {THREE.PerspectiveCamera}
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Update aspect ratio on window resize
   */
  updateAspect() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
