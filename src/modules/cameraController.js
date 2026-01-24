import * as THREE from 'three';

/**
 * Camera Controller for Off-Axis Projection
 * Manages camera setup and view offset based on face position
 */
export class CameraController {
  constructor() {
    this.camera = null;
    this.defaultPosition = new THREE.Vector3(0, 2, 10);
    this.viewingDistance = 10; // cm (changed from 60cm)
    this.screenWidth = 16.59; // cm (FOV=50° equivalent)
    this.screenHeight = 9.33; // cm (FOV=50° equivalent)
    this.cameraY = 2; // cm (camera Y offset)
    this.scale = 1.0; // coordinate scale (sensitivity adjustment)

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
   * Update camera with off-axis projection based on eye position
   * @param {number} eyeX - Eye X position in cm (relative to screen center)
   * @param {number} eyeY - Eye Y position in cm (relative to screen center)
   * @param {number} eyeZ - Eye Z distance from screen in cm (default: this.viewingDistance)
   */
  updateProjection(eyeX, eyeY, eyeZ = this.viewingDistance) {
    // Physical screen dimensions
    const halfWidth = this.screenWidth / 2;
    const halfHeight = this.screenHeight / 2;

    // Screen bounds (screen plane at Z=0)
    const left = -halfWidth;
    const right = halfWidth;
    const bottom = -halfHeight;
    const top = halfHeight;

    // Near and far clipping planes
    const near = 0.1;
    const far = 1000;

    // Calculate frustum based on eye position
    // This creates the "looking through a window" effect
    const frustumLeft = (left - eyeX) * near / eyeZ;
    const frustumRight = (right - eyeX) * near / eyeZ;
    const frustumBottom = (bottom - eyeY) * near / eyeZ;
    const frustumTop = (top - eyeY) * near / eyeZ;

    // Update projection matrix directly
    this.camera.projectionMatrix.makePerspective(
      frustumLeft, frustumRight,
      frustumTop, frustumBottom,
      near, far
    );

    // Update inverse projection matrix
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

    // Position camera at eye position
    this.camera.position.set(eyeX, eyeY, eyeZ);
    this.camera.lookAt(eyeX, eyeY, 0); // Look at point on screen plane

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
  /**
   * Smoothly return to default view
   */
  returnToDefaultView() {
    this.isReturningToDefault = true;

    // Target: center position (0, cameraY, viewingDistance)
    let currentX = this.camera.position.x;
    let currentY = this.camera.position.y;

    const animateReturn = () => {
      const damping = 0.05; // slower return animation
      currentX *= (1 - damping);
      currentY = currentY * (1 - damping) + this.cameraY * damping;

      // Update projection with damped position
      this.updateProjection(currentX, currentY, this.viewingDistance);

      // Continue animation if still moving
      if (Math.abs(currentX) > 0.1 || Math.abs(currentY - this.cameraY) > 0.1) {
        requestAnimationFrame(animateReturn);
      } else {
        // Fully reset to default position
        this.updateProjection(0, this.cameraY, this.viewingDistance);
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
