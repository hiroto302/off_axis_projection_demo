import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * MediaPipe Face Detection wrapper
 * Handles initialization and face detection from video frames
 */
export class FaceDetectorManager {
  constructor() {
    this.detector = null;
    this.isInitialized = false;
  }

  /**
   * Initialize MediaPipe Face Detector
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load WASM files from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create Face Detector with VIDEO mode
      this.detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.5
      });

      this.isInitialized = true;
      console.log('MediaPipe Face Detector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MediaPipe Face Detector:', error);
      throw new Error(`Face detector initialization failed: ${error.message}`);
    }
  }

  /**
   * Detect faces in a video frame
   * @param {HTMLVideoElement} videoElement - The video element to analyze
   * @param {number} timestamp - Current timestamp in milliseconds
   * @returns {Object|null} Face detection result or null if no face detected
   */
  detectFace(videoElement, timestamp) {
    if (!this.isInitialized || !this.detector) {
      console.warn('Face detector not initialized');
      return null;
    }

    try {
      // Detect faces in the video frame
      const detections = this.detector.detectForVideo(videoElement, timestamp);

      // Return null if no faces detected
      if (!detections.detections || detections.detections.length === 0) {
        return null;
      }

      // Use only the first detected face
      const detection = detections.detections[0];

      // Check confidence threshold
      if (detection.categories[0].score < 0.5) {
        return null;
      }

      // Extract bounding box
      const bbox = detection.boundingBox;

      // Calculate face center (normalized coordinates [0, 1])
      const faceX = bbox.originX + bbox.width / 2;
      const faceY = bbox.originY + bbox.height / 2;

      return {
        x: faceX,
        y: faceY,
        width: bbox.width,
        height: bbox.height,
        confidence: detection.categories[0].score
      };
    } catch (error) {
      console.error('Face detection error:', error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.detector) {
      this.detector.close();
      this.detector = null;
      this.isInitialized = false;
    }
  }
}
