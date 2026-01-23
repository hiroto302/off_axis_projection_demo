/**
 * Phase 8: UXポリッシュ
 *
 * このフェーズで学ぶこと:
 * - ローディング画面の実装（初期化中のユーザーフィードバック）
 * - 「顔が検出されません」警告バナー（2秒後表示）
 * - デフォルトビューへの自動復帰（スムーズアニメーション）
 * - ユーザーエクスペリエンスの向上
 *
 * 実装内容:
 * 8.1 ローディング画面の改善
 * - 初期化段階に応じたメッセージ表示
 * - スピナーアニメーション
 * - フェードアウトエフェクト
 *
 * 8.2 警告バナーシステム
 * - 顔未検出が2秒継続した時に警告表示
 * - 顔検出時に自動で非表示
 * - スムーズなアニメーション（スライドイン/アウト）
 *
 * 8.3 視点復帰アニメーション
 * - デフォルトビューへのスムーズな遷移
 * - イージング関数によるスムーズな動き
 * - 視線レイの自然な非表示
 *
 * 成功基準:
 * ✅ 初期化中にスピナーとステータスメッセージが表示される
 * ✅ 顔未検出が2秒続くと警告バナーが表示される
 * ✅ 顔を検出すると警告バナーが消える
 * ✅ カメラが滑らかに(0, 2, 10)へ戻る
 */

import * as THREE from 'three';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('8', 'UXポリッシュ: Loading, Warning Banner, Smooth Transitions');

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

// 🆕 Phase 8: 顔検出状態の詳細管理
let faceDetected = false;
let lastFaceDetectionTime = 0;
let faceFirstLostTime = 0;  // 顔が最初に失われた時刻
let warningBannerShown = false;  // 警告バナー表示状態

// 🆕 Phase 8: UX管理用のDOM要素
let warningBanner;
let loadingScreen;
let loadingText;

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

const PHYSICAL_PARAMS = {
  screenWidth: 16.59,
  screenHeight: 9.33,
  viewingDistance: 10,
  cameraY: 2,
  scale: 1.0
};

const SMOOTHING_PARAMS = {
  alphaX: 0.1,
  alphaY: 0.1,
  alphaZ: 0.15
};

const GAZE_VIS_CONFIG = {
  showGazeRay: true,
  showLandmarks: true,
  rayLength: 50,
  rayColor: 0x00ffff,
  intersectionMarkerColor: 0xff0000,
  landmarkColor: 'cyan',
  gazeArrowColor: 'yellow'
};

const LANDMARK_INDICES = {
  LEFT_EYE_CENTER: 468,
  RIGHT_EYE_CENTER: 473,
  NOSE_TIP: 1,
  FOREHEAD: 10
};

// 🆕 Phase 8: UX設定
const UX_CONFIG = {
  FACE_LOST_WARNING_DELAY: 2000,  // 2秒後に警告バナー表示
  FACE_LOST_TIMEOUT: 2000,        // 2秒間顔未検出でデフォルトに戻る
  WARNING_FADE_DURATION: 300,     // 警告バナーのフェード時間(ms)
  DEFAULT_VIEW_ANIMATION_SPEED: 0.05,  // デフォルトビューへの復帰速度
  LOADING_FADE_DURATION: 500      // ローディング画面のフェード時間(ms)
};

// =====================================
// 🆕 Phase 8: UX要素の初期化
// =====================================

function initUXElements() {
  // 警告バナーの取得
  warningBanner = document.getElementById('warning-banner');

  // ローディング画面の取得
  loadingScreen = document.getElementById('loading-screen');
  loadingText = document.getElementById('loading-text');

  console.log('✅ UX elements initialized');
  console.log(`   Warning delay: ${UX_CONFIG.FACE_LOST_WARNING_DELAY}ms`);
  console.log(`   Default view animation speed: ${UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED}`);
}

// =====================================
// 🆕 Phase 8: ローディング画面の管理
// =====================================

/**
 * ローディング画面の表示/非表示を制御
 *
 * @param {boolean} show - 表示するか
 * @param {string} message - ステータスメッセージ（オプション）
 */
function toggleLoadingScreen(show, message = '初期化中...') {
  if (!loadingScreen || !loadingText) return;

  if (show) {
    loadingScreen.style.display = 'flex';
    loadingScreen.style.opacity = '1';
    loadingText.textContent = message;
    console.log(`🔄 Loading: ${message}`);
  } else {
    // フェードアウトアニメーション
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, UX_CONFIG.LOADING_FADE_DURATION);
    console.log('✅ Loading screen hidden');
  }
}

// =====================================
// 🆕 Phase 8: 警告バナーの管理
// =====================================

/**
 * 警告バナーの表示/非表示を制御
 *
 * @param {boolean} show - 表示するか
 */
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

/**
 * 顔検出状態に基づいて警告バナーを更新
 */
function updateWarningBanner() {
  const now = performance.now();

  if (!faceDetected) {
    // 顔が失われた時刻を記録
    if (faceFirstLostTime === 0) {
      faceFirstLostTime = now;
    }

    // 2秒経過したら警告バナー表示
    const timeSinceLost = now - faceFirstLostTime;
    if (timeSinceLost >= UX_CONFIG.FACE_LOST_WARNING_DELAY) {
      toggleWarningBanner(true);
    }
  } else {
    // 顔が検出されたら警告バナーを非表示
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
  applyOffAxisProjection(0, PHYSICAL_PARAMS.cameraY, PHYSICAL_PARAMS.viewingDistance);

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
  const length = GAZE_VIS_CONFIG.rayLength;
  const color = GAZE_VIS_CONFIG.rayColor;

  gazeRayHelper = new THREE.ArrowHelper(direction, origin, length, color, 2, 1);
  gazeRayHelper.visible = GAZE_VIS_CONFIG.showGazeRay;
  scene.add(gazeRayHelper);

  const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: GAZE_VIS_CONFIG.intersectionMarkerColor
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
    toggleVideoPreview(true);

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

  canvasElement.classList.add('visible');

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
  smoothedX = applyEMA(rawX, smoothedX, SMOOTHING_PARAMS.alphaX);
  smoothedY = applyEMA(rawY, smoothedY, SMOOTHING_PARAMS.alphaY);
  smoothedZ = applyEMA(rawZ, smoothedZ, SMOOTHING_PARAMS.alphaZ);
}

// =====================================
// 座標変換関数
// =====================================

function convertToPhysicalCoordinates(normalizedX, normalizedY) {
  const centeredX = (normalizedX - 0.5) * 2;
  const centeredY = (normalizedY - 0.5) * 2;

  const mirroredX = -centeredX;
  const flippedY = -centeredY;

  const physicalX = mirroredX * (PHYSICAL_PARAMS.screenWidth / 2) * PHYSICAL_PARAMS.scale;
  const physicalY = flippedY * (PHYSICAL_PARAMS.screenHeight / 2) * PHYSICAL_PARAMS.scale + PHYSICAL_PARAMS.cameraY;

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
  const halfWidth = PHYSICAL_PARAMS.screenWidth / 2;
  const halfHeight = PHYSICAL_PARAMS.screenHeight / 2;

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
// 🆕 Phase 8: デフォルトビューへのスムーズな復帰
// =====================================

/**
 * デフォルトビューへスムーズにアニメーションで戻る
 * イージング関数を使用して自然な動きを実現
 */
function returnToDefaultView() {
  const defaultX = 0;
  const defaultY = PHYSICAL_PARAMS.cameraY;
  const defaultZ = PHYSICAL_PARAMS.viewingDistance;

  // スムーズなアニメーション（Phase 8ではより滑らか）
  smoothedX = applyEMA(defaultX, smoothedX, UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED);
  smoothedY = applyEMA(defaultY, smoothedY, UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED);
  smoothedZ = applyEMA(defaultZ, smoothedZ, UX_CONFIG.DEFAULT_VIEW_ANIMATION_SPEED);

  eyeX = smoothedX;
  eyeY = smoothedY;
  eyeZ = smoothedZ;

  applyOffAxisProjection(eyeX, eyeY, eyeZ);

  // 🆕 Phase 8: デフォルトビューに近づいたら視線レイを非表示
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
  if (!gazeRayHelper || !GAZE_VIS_CONFIG.showGazeRay || !faceDetected) {
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
  gazeRayHelper.setLength(GAZE_VIS_CONFIG.rayLength, 2, 1);

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
    drawLandmarks(landmarks, bbox);

    if (Math.random() < 0.5) {
      console.log(`👁️ Eye: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})cm`);
    }
  } else {
    faceDetected = false;

    // 2秒間顔未検出でデフォルトビューに戻る
    if (now - lastFaceDetectionTime > UX_CONFIG.FACE_LOST_TIMEOUT) {
      returnToDefaultView();
    }
  }

  // 🆕 Phase 8: 警告バナーの更新
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

  if (GAZE_VIS_CONFIG.showLandmarks) {
    const leftEye = landmarks[LANDMARK_INDICES.LEFT_EYE_CENTER];
    const rightEye = landmarks[LANDMARK_INDICES.RIGHT_EYE_CENTER];

    canvasCtx.fillStyle = GAZE_VIS_CONFIG.landmarkColor;
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

  canvasCtx.strokeStyle = GAZE_VIS_CONFIG.gazeArrowColor;
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
    debugInfo['Warning Banner'] = warningBannerShown ? '⚠️ Shown' : '✅ Hidden';
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
    debugInfo['Eye Position (cm)'] = 'N/A';
    debugInfo['Off-Axis Active'] = '❌ No (Returning to default)';
    debugInfo['Warning Banner'] = warningBannerShown ? '⚠️ Shown' : '✅ Hidden';
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

  if (faceLandmarker) {
    detectFaces();
  }

  renderer.render(scene, camera);
}

// =====================================
// ウィンドウリサイズ対応
// =====================================

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (faceDetected) {
    applyOffAxisProjection(eyeX, eyeY, eyeZ);
  } else {
    applyOffAxisProjection(0, PHYSICAL_PARAMS.cameraY, PHYSICAL_PARAMS.viewingDistance);
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

  window.removeEventListener('resize', onWindowResize);

  console.log('🧹 Resources cleaned up');
}

window.addEventListener('beforeunload', dispose);

// =====================================
// メイン実行
// =====================================

async function main() {
  try {
    console.log('🚀 Phase 8: Initializing UX Polish...');

    // 🆕 Phase 8: UX要素を初期化
    initUXElements();

    // 🆕 Phase 8: ローディング画面を表示
    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    // Three.jsシーンを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();
    initGazeVisualization();

    console.log('');
    console.log('🆕 Phase 8の新機能: UXポリッシュ');
    console.log('');
    console.log('⚙️ UX改善項目:');
    console.log('   1. ローディング画面: 初期化中のフィードバック');
    console.log('   2. 警告バナー: 顔未検出2秒後に表示');
    console.log('   3. スムーズな視点復帰: デフォルトビューへ自然に戻る');
    console.log('');

    await initFaceLandmarker();

    // 🆕 Phase 8: ローディングメッセージを更新
    toggleLoadingScreen(true, 'カメラアクセス中...');

    await initWebcam();
    initCanvas();

    // 🆕 Phase 8: スムーズにローディング画面を非表示
    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ All systems ready!');
    }, 500);

    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される動作:');
    console.log('   ✅ 初期化中にスピナーとステータスメッセージが表示');
    console.log('   ✅ ローディング画面がスムーズにフェードアウト');
    console.log('   ✅ 顔未検出が2秒続くと警告バナーが表示');
    console.log('   ✅ 顔を検出すると警告バナーが消える');
    console.log('   ✅ カメラが滑らかにデフォルト位置へ戻る');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   1. 顔を隠して2秒待つ → 警告バナーが表示される');
    console.log('   2. 顔を見せる → 警告バナーが消える');
    console.log('   3. 顔を隠し続ける → カメラがスムーズにデフォルト位置へ');
    console.log('   4. ページをリロード → ローディング画面を確認');

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
 * 🎯 Challenge 1: ローディング進捗表示
 * - 初期化の各ステップをプログレスバーで表示
 * - パーセント表示（例: 30% - カメラアクセス中）
 * - 各ステップの所要時間を計測して表示
 *
 * 🎯 Challenge 2: 警告バナーのカスタマイズ
 * - 警告レベルに応じた色分け（警告=黄、エラー=赤）
 * - カウントダウン表示（「2秒後にデフォルトビューへ戻ります」）
 * - アニメーション効果（スライドイン、フェード、バウンス）
 *
 * 🎯 Challenge 3: 視点復帰のイージング
 * - イージング関数を実装（ease-in-out、ease-out-cubic など）
 * - 復帰速度をGUIで調整可能に
 * - 復帰時に軌跡を描画（カメラの移動経路を可視化）
 *
 * 🎯 Challenge 4: ユーザーフィードバックの改善
 * - 顔検出成功時に短いフィードバック（チェックマーク、サウンド）
 * - カメラ位置が極端な場合の警告（「画面に近すぎます」）
 * - FPSが低い場合のパフォーマンス警告
 *
 * 🎯 Challenge 5: オンボーディング
 * - 初回訪問時のチュートリアル表示
 * - 顔の動かし方のガイド（左右、上下、前後）
 * - 視線の使い方の説明
 *
 * 🎯 Challenge 6: エラーハンドリングの改善
 * - カメラアクセスエラー時のリトライボタン
 * - MediaPipeモデル読み込みエラー時の代替策
 * - ブラウザ非対応時の詳細な説明
 *
 * 🎯 Challenge 7: ステータス履歴
 * - 顔検出の成功/失敗をタイムラインで表示
 * - カメラ位置の履歴をグラフで表示
 * - パフォーマンス履歴（FPS、検出時間）
 *
 * 🎯 Challenge 8: ダークモード対応
 * - UIのカラーテーマ切り替え
 * - 警告バナー、ローディング画面のダークモード
 * - 視線レイの色もテーマに応じて変更
 */
