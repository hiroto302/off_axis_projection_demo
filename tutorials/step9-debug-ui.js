/**
 * Phase 9: デバッグUI (lil-gui)
 *
 * このフェーズで学ぶこと:
 * - lil-guiライブラリの統合
 * - パラメータフォルダーの作成
 * - `.listen()` によるリアルタイム値更新
 * - デバッグツールの実装
 *
 * 実装内容:
 * 9.1 lil-gui セットアップ
 * - CDNからlil-guiを読み込み
 * - GUI管理クラスの作成
 * - フォルダー構造の設計
 *
 * 9.2 パラメータコントロール
 * - スムージングパラメータ調整
 * - 物理パラメータ調整（スケール、視聴距離、画面サイズ）
 * - 視線可視化設定（レイ表示、ランドマーク表示、レイ長さ）
 *
 * 9.3 デバッグ機能
 * - ビデオプレビュー表示切替
 * - Stats.js表示切替
 * - カメラ位置のマニュアル制御
 *
 * 9.4 リアルタイム値表示
 * - `.listen()` でカメラ位置をライブ更新
 * - FPS表示
 * - 顔検出状態表示
 *
 * 成功基準:
 * ✅ 全パラメータがリアルタイムで反映される
 * ✅ カメラ位置が `.listen()` でライブ更新される
 * ✅ フォルダーが折りたたみ可能
 * ✅ パラメータ変更が即座にビジュアルに反映される
 */

import * as THREE from 'three';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('9', 'デバッグUI: lil-gui Integration');

// =====================================
// ブラウザ互換性チェック
// =====================================
if (!checkBrowserCompatibility()) {
  throw new Error('Browser not compatible');
}

// =====================================
// グローバル変数
// =====================================

// Three.js関連
let scene, camera, renderer;
let cube, cubeWireframe;
let gridHelper;
let animationId;

// 視線レイの可視化
let gazeRayHelper = null;
let gazeIntersectionMarker = null;
let raycaster = null;

// カメラ関連
let videoElement;
let videoStream;

// MediaPipe関連
let faceLandmarker;
let lastDetectionTime = 0;

// キャンバスオーバーレイ(顔検出結果を描画)
let canvasElement;
let canvasCtx;

// 座標変換用の変数
let eyeX = 0;
let eyeY = 2;
let eyeZ = 10;

// スムージング用の変数
let smoothedX = 0;
let smoothedY = 2;
let smoothedZ = 10;

// 生座標（スムージング前）
let rawX = 0;
let rawY = 2;
let rawZ = 10;

// 視線ベクトル
let gazeDirectionX = 0;
let gazeDirectionY = 0;
let gazeDirectionZ = -1;

// 顔検出状態の管理
let faceDetected = false;
let lastFaceDetectionTime = 0;
let faceFirstLostTime = 0;
let warningBannerShown = false;

// UX管理用のDOM要素
let warningBanner;
let loadingScreen;
let loadingText;

// 🆕 Phase 9: lil-gui インスタンス
let gui;

// 🆕 Phase 9: GUIで制御可能なパラメータ
const guiParams = {
  // Smoothing Parameters
  smoothingX: 0.1,
  smoothingY: 0.1,
  smoothingZ: 0.15,

  // Physical Parameters
  scale: 1.0,
  viewingDistance: 10,
  screenWidth: 16.59,
  screenHeight: 9.33,
  cameraY: 2,

  // Gaze Visualization
  showGazeRay: true,
  showLandmarks: true,
  rayLength: 50,
  rayColor: '#00ffff',
  intersectionMarkerColor: '#ff0000',

  // Debug Controls
  showVideo: false,
  showStats: false,
  manualMode: false,
  manualX: 0,
  manualY: 2,
  manualZ: 10,

  // Read-only Display (with .listen())
  currentX: 0,
  currentY: 2,
  currentZ: 10,
  fps: 0,
  faceDetectedStatus: '❌ No'
};

// 設定
const ROTATION_SPEED = 0.01;
const VIDEO_CONFIG = {
  width: 640,
  height: 480,
  frameRate: 30
};

const MEDIAPIPE_CONFIG = {
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  runningMode: 'VIDEO',
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
};

const DETECTION_INTERVAL_MS = 33;

const LANDMARK_INDICES = {
  LEFT_EYE_CENTER: 468,
  RIGHT_EYE_CENTER: 473,
  NOSE_TIP: 1,
  FOREHEAD: 10
};

const UX_CONFIG = {
  FACE_LOST_WARNING_DELAY: 2000,
  FACE_LOST_TIMEOUT: 2000,
  WARNING_FADE_DURATION: 300,
  DEFAULT_VIEW_ANIMATION_SPEED: 0.05,
  LOADING_FADE_DURATION: 500
};

// 🆕 Phase 9: FPSカウンター
let fpsCounter = null;

// =====================================
// 🆕 Phase 9: lil-gui セットアップ
// =====================================

function initGUI() {
  gui = new GUI({ title: 'Debug UI - Phase 9' });

  // Parameters Folder
  const parametersFolder = gui.addFolder('Parameters');
  parametersFolder.add(guiParams, 'smoothingX', 0.01, 0.5, 0.01).name('Smoothing X').onChange(updateSmoothingParams);
  parametersFolder.add(guiParams, 'smoothingY', 0.01, 0.5, 0.01).name('Smoothing Y').onChange(updateSmoothingParams);
  parametersFolder.add(guiParams, 'smoothingZ', 0.01, 0.5, 0.01).name('Smoothing Z').onChange(updateSmoothingParams);
  parametersFolder.add(guiParams, 'scale', 0.5, 5.0, 0.1).name('Scale').onChange(updatePhysicalParams);
  parametersFolder.add(guiParams, 'viewingDistance', 5, 20, 0.5).name('Viewing Distance').onChange(updatePhysicalParams);
  parametersFolder.add(guiParams, 'screenWidth', 10, 40, 0.5).name('Screen Width').onChange(updatePhysicalParams);

  // Gaze Visualization Folder
  const gazeFolder = gui.addFolder('Gaze Visualization');
  gazeFolder.add(guiParams, 'showGazeRay').name('Show Gaze Ray').onChange(updateGazeVisualization);
  gazeFolder.add(guiParams, 'showLandmarks').name('Show Landmarks').onChange(updateGazeVisualization);
  gazeFolder.add(guiParams, 'rayLength', 10, 100, 1).name('Ray Length').onChange(updateGazeVisualization);
  gazeFolder.addColor(guiParams, 'rayColor').name('Ray Color').onChange(updateGazeVisualization);
  gazeFolder.addColor(guiParams, 'intersectionMarkerColor').name('Marker Color').onChange(updateGazeVisualization);

  // Debug Controls Folder
  const debugFolder = gui.addFolder('Debug');
  debugFolder.add(guiParams, 'showVideo').name('Show Video').onChange(toggleVideoDebug);
  debugFolder.add(guiParams, 'showStats').name('Show Stats').onChange(toggleStatsDebug);

  // Camera Position Folder (Manual Control)
  const cameraFolder = gui.addFolder('Camera Position');
  cameraFolder.add(guiParams, 'manualMode').name('Manual Mode').onChange(updateManualMode);
  cameraFolder.add(guiParams, 'manualX', -20, 20, 0.5).name('Manual X').onChange(updateManualCamera);
  cameraFolder.add(guiParams, 'manualY', -10, 15, 0.5).name('Manual Y').onChange(updateManualCamera);
  cameraFolder.add(guiParams, 'manualZ', 5, 20, 0.5).name('Manual Z').onChange(updateManualCamera);

  // Read-only displays with .listen()
  cameraFolder.add(guiParams, 'currentX').name('Current X').disable().listen();
  cameraFolder.add(guiParams, 'currentY').name('Current Y').disable().listen();
  cameraFolder.add(guiParams, 'currentZ').name('Current Z').disable().listen();

  // Status Display Folder
  const statusFolder = gui.addFolder('Status');
  statusFolder.add(guiParams, 'fps').name('FPS').disable().listen();
  statusFolder.add(guiParams, 'faceDetectedStatus').name('Face Detected').disable().listen();

  console.log('✅ lil-gui initialized with all controllers');
}

// =====================================
// 🆕 Phase 9: GUI コールバック関数
// =====================================

function updateSmoothingParams() {
  console.log(`🔧 Smoothing updated: X=${guiParams.smoothingX}, Y=${guiParams.smoothingY}, Z=${guiParams.smoothingZ}`);
}

function updatePhysicalParams() {
  console.log(`🔧 Physical params updated: Scale=${guiParams.scale}, Distance=${guiParams.viewingDistance}`);
  if (faceDetected) {
    applyOffAxisProjection(eyeX, eyeY, eyeZ);
  }
}

function updateGazeVisualization() {
  if (gazeRayHelper) {
    gazeRayHelper.visible = guiParams.showGazeRay && faceDetected;

    // Update ray color
    gazeRayHelper.setColor(new THREE.Color(guiParams.rayColor));
  }

  if (gazeIntersectionMarker) {
    gazeIntersectionMarker.material.color.set(guiParams.intersectionMarkerColor);
  }

  console.log(`🔧 Gaze visualization updated: Ray=${guiParams.showGazeRay}, Landmarks=${guiParams.showLandmarks}`);
}

function toggleVideoDebug(value) {
  toggleVideoPreview(value);
  console.log(`🔧 Video preview: ${value ? 'ON' : 'OFF'}`);
}

function toggleStatsDebug(value) {
  // Stats.js integration would go here (Phase 10)
  console.log(`🔧 Stats display: ${value ? 'ON' : 'OFF'}`);
}

function updateManualMode(value) {
  if (value) {
    console.log('🔧 Manual camera mode enabled');
  } else {
    console.log('🔧 Auto camera mode enabled');
  }
}

function updateManualCamera() {
  if (guiParams.manualMode) {
    eyeX = guiParams.manualX;
    eyeY = guiParams.manualY;
    eyeZ = guiParams.manualZ;
    applyOffAxisProjection(eyeX, eyeY, eyeZ);
    console.log(`🔧 Manual camera: (${eyeX}, ${eyeY}, ${eyeZ})`);
  }
}

// =====================================
// UX要素の初期化
// =====================================

function initUXElements() {
  warningBanner = document.getElementById('warning-banner');
  loadingScreen = document.getElementById('loading-screen');
  loadingText = document.getElementById('loading-text');

  console.log('✅ UX elements initialized');
}

// =====================================
// ローディング画面の管理
// =====================================

function toggleLoadingScreen(show, message = '初期化中...') {
  if (!loadingScreen || !loadingText) return;

  if (show) {
    loadingScreen.style.display = 'flex';
    loadingScreen.style.opacity = '1';
    loadingText.textContent = message;
    console.log(`🔄 Loading: ${message}`);
  } else {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, UX_CONFIG.LOADING_FADE_DURATION);
    console.log('✅ Loading screen hidden');
  }
}

// =====================================
// 警告バナーの管理
// =====================================

function toggleWarningBanner(show) {
  if (!warningBanner) return;

  if (show && !warningBannerShown) {
    warningBanner.classList.add('visible');
    warningBannerShown = true;
    console.log('⚠️ Warning banner shown: Face not detected');
  } else if (!show && warningBannerShown) {
    warningBanner.classList.remove('visible');
    warningBannerShown = false;
    console.log('✅ Warning banner hidden: Face detected');
  }
}

function updateWarningBanner() {
  const now = performance.now();

  if (!faceDetected) {
    if (faceFirstLostTime === 0) {
      faceFirstLostTime = now;
    }

    const timeSinceLost = now - faceFirstLostTime;
    if (timeSinceLost >= UX_CONFIG.FACE_LOST_WARNING_DELAY) {
      toggleWarningBanner(true);
    }
  } else {
    faceFirstLostTime = 0;
    toggleWarningBanner(false);
  }
}

// =====================================
// Three.jsシーン初期化
// =====================================

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1e);
  console.log('✅ Scene created');
}

function initCamera() {
  const fov = 50;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;

  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  applyOffAxisProjection(0, guiParams.cameraY, guiParams.viewingDistance);

  console.log('✅ Camera initialized with Off-Axis Projection');
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('three-canvas'),
    antialias: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  console.log('✅ Renderer initialized');
}

function addGrid() {
  const size = 20;
  const divisions = 20;
  gridHelper = new THREE.GridHelper(size, divisions, 0xff8844, 0xdd6633);
  gridHelper.position.y = -2;
  scene.add(gridHelper);

  console.log('✅ Grid added');
}

function addCube() {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    metalness: 0.3,
    roughness: 0.4
  });

  cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 0, 0);
  scene.add(cube);

  const wireframeGeometry = new THREE.EdgesGeometry(geometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 2
  });
  cubeWireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
  cube.add(cubeWireframe);

  console.log('✅ Cube added');
}

function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 1.5);
  pointLight.position.set(0, 5, 10);
  scene.add(pointLight);

  console.log('✅ Lights added');
}

// =====================================
// 視線レイの初期化
// =====================================

function initGazeVisualization() {
  raycaster = new THREE.Raycaster();

  const origin = new THREE.Vector3(0, 0, 0);
  const direction = new THREE.Vector3(0, 0, -1);
  const length = guiParams.rayLength;
  const color = guiParams.rayColor;

  gazeRayHelper = new THREE.ArrowHelper(direction, origin, length, color, 2, 1);
  gazeRayHelper.visible = guiParams.showGazeRay;
  scene.add(gazeRayHelper);

  const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: guiParams.intersectionMarkerColor
  });
  gazeIntersectionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  gazeIntersectionMarker.visible = false;
  scene.add(gazeIntersectionMarker);

  console.log('✅ Gaze visualization initialized');
}

// =====================================
// Webカメラアクセス
// =====================================

async function initWebcam() {
  console.log('📹 Requesting camera access...');

  try {
    const constraints = {
      video: {
        width: { ideal: VIDEO_CONFIG.width },
        height: { ideal: VIDEO_CONFIG.height },
        frameRate: { ideal: VIDEO_CONFIG.frameRate },
        facingMode: 'user'
      },
      audio: false
    };

    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement = document.getElementById('video');
    videoElement.srcObject = videoStream;

    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        console.log('✅ Video metadata loaded');
        resolve();
      };
    });

    await videoElement.play();

    // Don't show video by default (controlled by GUI)
    toggleVideoPreview(guiParams.showVideo);

    console.log('✅ Webcam initialized and playing');
    return videoStream;

  } catch (error) {
    console.error('❌ Camera access error:', error);
    handleCameraError(error);
    throw error;
  }
}

function stopWebcam() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => {
      track.stop();
      console.log('🛑 Video track stopped:', track.label);
    });
    videoStream = null;
  }

  if (videoElement) {
    videoElement.srcObject = null;
  }

  toggleVideoPreview(false);
}

// =====================================
// キャンバスオーバーレイ初期化
// =====================================

function initCanvas() {
  canvasElement = document.getElementById('overlay-canvas');
  canvasCtx = canvasElement.getContext('2d');

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  // Show canvas only if video is shown
  if (guiParams.showVideo) {
    canvasElement.classList.add('visible');
  }

  console.log('✅ Canvas overlay initialized');
}

// =====================================
// MediaPipe Face Landmarker初期化
// =====================================

async function initFaceLandmarker() {
  console.log('🤖 Initializing MediaPipe Face Landmarker...');

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_CONFIG.modelAssetPath,
        delegate: 'GPU'
      },
      runningMode: MEDIAPIPE_CONFIG.runningMode,
      numFaces: MEDIAPIPE_CONFIG.numFaces,
      minFaceDetectionConfidence: MEDIAPIPE_CONFIG.minFaceDetectionConfidence,
      minFacePresenceConfidence: MEDIAPIPE_CONFIG.minFacePresenceConfidence,
      minTrackingConfidence: MEDIAPIPE_CONFIG.minTrackingConfidence
    });

    console.log('✅ Face Landmarker initialized');
    return faceLandmarker;

  } catch (error) {
    console.error('❌ Face Landmarker initialization error:', error);
    showError('MediaPipeエラー', 'モデルの読み込みに失敗しました。ページを再読み込みしてください。');
    throw error;
  }
}

// =====================================
// EMAスムージング実装
// =====================================

function applyEMA(current, previous, alpha) {
  return previous * (1 - alpha) + current * alpha;
}

function smoothCoordinates(rawX, rawY, rawZ) {
  smoothedX = applyEMA(rawX, smoothedX, guiParams.smoothingX);
  smoothedY = applyEMA(rawY, smoothedY, guiParams.smoothingY);
  smoothedZ = applyEMA(rawZ, smoothedZ, guiParams.smoothingZ);
}

// =====================================
// 座標変換関数
// =====================================

function convertToPhysicalCoordinates(normalizedX, normalizedY) {
  const centeredX = (normalizedX - 0.5) * 2;
  const centeredY = (normalizedY - 0.5) * 2;

  const mirroredX = -centeredX;
  const flippedY = -centeredY;

  const physicalX = mirroredX * (guiParams.screenWidth / 2) * guiParams.scale;
  const physicalY = flippedY * (guiParams.screenHeight / 2) * guiParams.scale + guiParams.cameraY;

  return { x: physicalX, y: physicalY };
}

function estimateDistance(bboxWidth, bboxHeight) {
  const k = 18;
  const rawDistance = k / bboxWidth;
  const estimatedDistance = Math.max(30, Math.min(120, rawDistance));
  return estimatedDistance;
}

// =====================================
// 視線方向の計算
// =====================================

function calculateGazeDirection(landmarks) {
  const leftEye = landmarks[LANDMARK_INDICES.LEFT_EYE_CENTER];
  const rightEye = landmarks[LANDMARK_INDICES.RIGHT_EYE_CENTER];

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const eyeCenterZ = (leftEye.z + rightEye.z) / 2;

  const noseTip = landmarks[LANDMARK_INDICES.NOSE_TIP];

  let gazeX = noseTip.x - eyeCenterX;
  let gazeY = noseTip.y - eyeCenterY;
  let gazeZ = noseTip.z - eyeCenterZ;

  const magnitude = Math.sqrt(gazeX * gazeX + gazeY * gazeY + gazeZ * gazeZ);
  if (magnitude > 0) {
    gazeX /= magnitude;
    gazeY /= magnitude;
    gazeZ /= magnitude;
  }

  return {
    x: -gazeX,
    y: -gazeY,
    z: gazeZ
  };
}

// =====================================
// Off-Axis Projection実装
// =====================================

function applyOffAxisProjection(eyeX, eyeY, eyeZ) {
  const halfWidth = guiParams.screenWidth / 2;
  const halfHeight = guiParams.screenHeight / 2;

  const left = -halfWidth;
  const right = halfWidth;
  const bottom = -halfHeight;
  const top = halfHeight;

  const near = 0.1;
  const far = 1000;

  const frustumLeft = (left - eyeX) * near / eyeZ;
  const frustumRight = (right - eyeX) * near / eyeZ;
  const frustumBottom = (bottom - eyeY) * near / eyeZ;
  const frustumTop = (top - eyeY) * near / eyeZ;

  camera.projectionMatrix.makePerspective(
    frustumLeft, frustumRight,
    frustumTop, frustumBottom,
    near, far
  );

  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  camera.position.set(eyeX, eyeY, eyeZ);
  camera.lookAt(eyeX, eyeY, 0);
}

// =====================================
// デフォルトビューへのスムーズな復帰
// =====================================

function returnToDefaultView() {
  const defaultX = 0;
  const defaultY = guiParams.cameraY;
  const defaultZ = guiParams.viewingDistance;

  smoothedX = applyEMA(defaultX, smoothedX, UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED);
  smoothedY = applyEMA(defaultY, smoothedY, UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED);
  smoothedZ = applyEMA(defaultZ, smoothedZ, UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED);

  eyeX = smoothedX;
  eyeY = smoothedY;
  eyeZ = smoothedZ;

  applyOffAxisProjection(eyeX, eyeY, eyeZ);

  const isNearDefault =
    Math.abs(smoothedX - defaultX) < 0.1 &&
    Math.abs(smoothedY - defaultY) < 0.1 &&
    Math.abs(smoothedZ - defaultZ) < 0.5;

  if (isNearDefault) {
    if (gazeRayHelper) gazeRayHelper.visible = false;
    if (gazeIntersectionMarker) gazeIntersectionMarker.visible = false;

    if (Math.random() < 0.05) {
      console.log('🏠 Smoothly returned to default view');
    }
  }
}

// =====================================
// 視線レイの更新
// =====================================

function updateGazeRay() {
  if (!gazeRayHelper || !guiParams.showGazeRay || !faceDetected) {
    if (gazeRayHelper) gazeRayHelper.visible = false;
    if (gazeIntersectionMarker) gazeIntersectionMarker.visible = false;
    return;
  }

  gazeRayHelper.visible = true;

  const origin = new THREE.Vector3(eyeX, eyeY, eyeZ);
  const direction = new THREE.Vector3(gazeDirectionX, gazeDirectionY, gazeDirectionZ);
  direction.normalize();

  gazeRayHelper.position.copy(origin);
  gazeRayHelper.setDirection(direction);
  gazeRayHelper.setLength(guiParams.rayLength, 2, 1);

  raycaster.set(origin, direction);
  const intersects = raycaster.intersectObjects([cube, gridHelper], true);

  if (intersects.length > 0) {
    const intersection = intersects[0];
    gazeIntersectionMarker.position.copy(intersection.point);
    gazeIntersectionMarker.visible = true;
  } else {
    gazeIntersectionMarker.visible = false;
  }
}

// =====================================
// 顔ランドマーク検出処理
// =====================================

function detectFaces() {
  if (!videoElement || videoElement.readyState < 2) {
    return;
  }

  const now = performance.now();
  if (now - lastDetectionTime < DETECTION_INTERVAL_MS) {
    return;
  }

  lastDetectionTime = now;

  const results = faceLandmarker.detectForVideo(videoElement, now);

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
    faceDetected = true;
    lastFaceDetectionTime = now;

    // 🆕 Phase 9: GUIステータス更新
    guiParams.faceDetectedStatus = '✅ Yes';

    // Manual mode check
    if (guiParams.manualMode) {
      // Skip face detection updates in manual mode
      return;
    }

    const landmarks = results.faceLandmarks[0];
    const bbox = calculateBoundingBox(landmarks);

    const normalizedX = bbox.centerX;
    const normalizedY = bbox.centerY;

    const physical = convertToPhysicalCoordinates(normalizedX, normalizedY);
    rawX = physical.x;
    rawY = physical.y;
    rawZ = estimateDistance(bbox.width, bbox.height);

    smoothCoordinates(rawX, rawY, rawZ);

    eyeX = smoothedX;
    eyeY = smoothedY;
    eyeZ = smoothedZ;

    applyOffAxisProjection(eyeX, eyeY, eyeZ);

    const gazeDir = calculateGazeDirection(landmarks);
    gazeDirectionX = gazeDir.x;
    gazeDirectionY = gazeDir.y;
    gazeDirectionZ = gazeDir.z;

    updateGazeRay();

    if (guiParams.showVideo) {
      drawLandmarks(landmarks, bbox);
    }

    if (Math.random() < 0.5) {
      console.log(`👁️ Eye: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})cm`);
    }
  } else {
    faceDetected = false;

    // 🆕 Phase 9: GUIステータス更新
    guiParams.faceDetectedStatus = '❌ No';

    if (now - lastFaceDetectionTime > UX_CONFIG.FACE_LOST_TIMEOUT) {
      if (!guiParams.manualMode) {
        returnToDefaultView();
      }
    }
  }

  updateWarningBanner();
  updateDetectionInfo(results);
}

// =====================================
// バウンディングボックスの計算
// =====================================

function calculateBoundingBox(landmarks) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
  }

  return {
    originX: minX,
    originY: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

// =====================================
// ランドマーク描画
// =====================================

function drawLandmarks(landmarks, bbox) {
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  const x = bbox.originX * videoWidth;
  const y = bbox.originY * videoHeight;
  const width = bbox.width * videoWidth;
  const height = bbox.height * videoHeight;

  canvasCtx.strokeStyle = '#00ff00';
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeRect(x, y, width, height);

  if (guiParams.showLandmarks) {
    const leftEye = landmarks[LANDMARK_INDICES.LEFT_EYE_CENTER];
    const rightEye = landmarks[LANDMARK_INDICES.RIGHT_EYE_CENTER];

    canvasCtx.fillStyle = 'cyan';
    canvasCtx.beginPath();
    canvasCtx.arc(leftEye.x * videoWidth, leftEye.y * videoHeight, 5, 0, 2 * Math.PI);
    canvasCtx.fill();

    canvasCtx.beginPath();
    canvasCtx.arc(rightEye.x * videoWidth, rightEye.y * videoHeight, 5, 0, 2 * Math.PI);
    canvasCtx.fill();
  }

  const eyeCenterX = (landmarks[LANDMARK_INDICES.LEFT_EYE_CENTER].x + landmarks[LANDMARK_INDICES.RIGHT_EYE_CENTER].x) / 2 * videoWidth;
  const eyeCenterY = (landmarks[LANDMARK_INDICES.LEFT_EYE_CENTER].y + landmarks[LANDMARK_INDICES.RIGHT_EYE_CENTER].y) / 2 * videoHeight;

  const arrowLength = 50;
  const arrowEndX = eyeCenterX - gazeDirectionX * arrowLength;
  const arrowEndY = eyeCenterY - gazeDirectionY * arrowLength;

  canvasCtx.strokeStyle = 'yellow';
  canvasCtx.lineWidth = 3;
  canvasCtx.beginPath();
  canvasCtx.moveTo(eyeCenterX, eyeCenterY);
  canvasCtx.lineTo(arrowEndX, arrowEndY);
  canvasCtx.stroke();

  const arrowHeadLength = 10;
  const angle = Math.atan2(arrowEndY - eyeCenterY, arrowEndX - eyeCenterX);
  canvasCtx.beginPath();
  canvasCtx.moveTo(arrowEndX, arrowEndY);
  canvasCtx.lineTo(
    arrowEndX - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    arrowEndY - arrowHeadLength * Math.sin(angle - Math.PI / 6)
  );
  canvasCtx.moveTo(arrowEndX, arrowEndY);
  canvasCtx.lineTo(
    arrowEndX - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    arrowEndY - arrowHeadLength * Math.sin(angle + Math.PI / 6)
  );
  canvasCtx.stroke();

  canvasCtx.fillStyle = '#00ff00';
  canvasCtx.font = 'bold 12px monospace';
  canvasCtx.fillText(
    `Eye: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)}) cm`,
    x,
    y + height + 15
  );
}

// =====================================
// デバッグ情報更新
// =====================================

function updateDetectionInfo(results) {
  const debugInfo = {
    'Camera Position': `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`,
    'Objects in Scene': scene.children.length
  };

  if (videoElement && videoElement.readyState >= 2) {
    debugInfo['Video Status'] = '📹 Active';
  }

  if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
    debugInfo['Faces Detected'] = `✅ ${results.faceLandmarks.length}`;
    debugInfo['Eye Position (cm)'] = `(${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})`;
    debugInfo['Off-Axis Active'] = '✅ Yes';
    debugInfo['Manual Mode'] = guiParams.manualMode ? '⚙️ ON' : '❌ OFF';
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
    debugInfo['Eye Position (cm)'] = 'N/A';
    debugInfo['Off-Axis Active'] = '❌ No';
    debugInfo['Manual Mode'] = guiParams.manualMode ? '⚙️ ON' : '❌ OFF';
  }

  updateDebugInfo(debugInfo);
}

// =====================================
// アニメーションループ
// =====================================

function animate() {
  animationId = requestAnimationFrame(animate);

  cube.rotation.y += ROTATION_SPEED;
  cube.rotation.x += ROTATION_SPEED * 0.5;

  if (faceLandmarker && !guiParams.manualMode) {
    detectFaces();
  }

  // 🆕 Phase 9: GUIパラメータをリアルタイム更新
  guiParams.currentX = parseFloat(camera.position.x.toFixed(2));
  guiParams.currentY = parseFloat(camera.position.y.toFixed(2));
  guiParams.currentZ = parseFloat(camera.position.z.toFixed(2));

  // 🆕 Phase 9: FPS更新
  if (fpsCounter) {
    guiParams.fps = fpsCounter.update();
  }

  renderer.render(scene, camera);
}

// =====================================
// ウィンドウリサイズ対応
// =====================================

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (faceDetected || guiParams.manualMode) {
    applyOffAxisProjection(eyeX, eyeY, eyeZ);
  } else {
    applyOffAxisProjection(0, guiParams.cameraY, guiParams.viewingDistance);
  }

  console.log('📐 Window resized');
}

window.addEventListener('resize', onWindowResize);

// =====================================
// クリーンアップ処理
// =====================================

function dispose() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  stopWebcam();

  if (faceLandmarker) {
    faceLandmarker.close();
    console.log('🛑 Face Landmarker closed');
  }

  if (cube) {
    cube.geometry.dispose();
    cube.material.dispose();
  }

  if (cubeWireframe) {
    cubeWireframe.geometry.dispose();
    cubeWireframe.material.dispose();
  }

  if (gazeRayHelper) {
    scene.remove(gazeRayHelper);
  }

  if (gazeIntersectionMarker) {
    gazeIntersectionMarker.geometry.dispose();
    gazeIntersectionMarker.material.dispose();
    scene.remove(gazeIntersectionMarker);
  }

  if (renderer) {
    renderer.dispose();
  }

  // 🆕 Phase 9: GUI cleanup
  if (gui) {
    gui.destroy();
  }

  window.removeEventListener('resize', onWindowResize);

  console.log('🧹 Resources cleaned up');
}

window.addEventListener('beforeunload', dispose);

// =====================================
// メイン実行
// =====================================

async function main() {
  try {
    console.log('🚀 Phase 9: Initializing Debug UI...');

    initUXElements();
    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();
    initGazeVisualization();

    // 🆕 Phase 9: lil-gui初期化
    initGUI();

    // 🆕 Phase 9: FPSカウンター初期化
    fpsCounter = new FPSCounter();

    console.log('');
    console.log('🆕 Phase 9の新機能: デバッグUI (lil-gui)');
    console.log('');
    console.log('⚙️ GUI機能:');
    console.log('   1. Parameters: スムージング、スケール、視聴距離、画面サイズ');
    console.log('   2. Gaze Visualization: レイ表示、ランドマーク表示、レイ長さ、色設定');
    console.log('   3. Debug: ビデオ表示、Stats表示切替');
    console.log('   4. Camera Position: マニュアルモード、位置調整、リアルタイム値表示');
    console.log('   5. Status: FPS、顔検出状態');
    console.log('');

    await initFaceLandmarker();

    toggleLoadingScreen(true, 'カメラアクセス中...');

    await initWebcam();
    initCanvas();

    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ All systems ready!');
    }, 500);

    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される動作:');
    console.log('   ✅ lil-guiパネルが右上に表示される');
    console.log('   ✅ 全パラメータがリアルタイムで反映される');
    console.log('   ✅ カメラ位置が `.listen()` でライブ更新される');
    console.log('   ✅ フォルダーが折りたたみ可能');
    console.log('   ✅ マニュアルモードでカメラを手動制御できる');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   1. スムージングを調整 → カメラの動きが変化');
    console.log('   2. スケールを調整 → 視点移動の幅が変化');
    console.log('   3. Manual Modeを有効化 → カメラを手動制御');
    console.log('   4. Show Videoを有効化 → カメラ映像を確認');
    console.log('   5. Show Gaze Rayを切り替え → 視線レイの表示/非表示');

  } catch (error) {
    console.error('❌ Initialization error:', error);

    if (error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
      showError('初期化エラー', error.message);
    }
  }
}

// DOMContentLoaded後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// =====================================
// 学習チャレンジ
// =====================================

/*
 * 🎯 Challenge 1: プリセットシステム
 * - パラメータのプリセット保存/読み込み機能
 * - "Cinema Mode", "Performance Mode", "Debug Mode" などのプリセット
 * - LocalStorageでプリセットを永続化
 *
 * 🎯 Challenge 2: キーボードショートカット
 * - "V" キー: ビデオ表示切替
 * - "G" キー: 視線レイ切替
 * - "M" キー: マニュアルモード切替
 * - "R" キー: デフォルト値にリセット
 *
 * 🎯 Challenge 3: グラフ表示
 * - カメラ位置の履歴をグラフで表示
 * - FPSの推移をリアルタイムグラフ
 * - スムージング前後の座標比較
 *
 * 🎯 Challenge 4: エクスポート/インポート機能
 * - 全パラメータをJSONでエクスポート
 * - JSONファイルからパラメータをインポート
 * - URLパラメータで設定を共有
 *
 * 🎯 Challenge 5: パフォーマンスモニタリング
 * - Stats.js統合（Phase 10で実装予定）
 * - フレームタイム、メモリ使用量の表示
 * - パフォーマンス警告（FPSが低い時）
 *
 * 🎯 Challenge 6: 高度な視線制御
 * - 視線でUIを操作（ボタンを注視して選択）
 * - 視線ヒートマップ表示
 * - 視線の滞留時間を記録
 *
 * 🎯 Challenge 7: カメラアニメーション
 * - カメラ位置のキーフレームアニメーション
 * - パスに沿ってカメラを移動
 * - アニメーションの記録と再生
 */
