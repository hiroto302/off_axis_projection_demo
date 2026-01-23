/**
 * Phase 7: 視線方向の可視化
 *
 * このフェーズで学ぶこと:
 * - MediaPipe Face Landmarkerへのアップグレード（478ランドマーク）
 * - 目のランドマーク（左右の虹彩中心）の抽出
 * - 視線ベクトルの計算
 * - 2Dオーバーレイでの視線可視化
 * - 3Dシーンでの視線レイ投射
 *
 * 実装内容:
 * 7.1 2Dオーバーレイ可視化
 * - ビデオキャンバスに目のランドマークを描画（シアン色の円）
 * - 顔の中心から視線方向への矢印
 * - 信頼度による色分け（緑=高、黄=中、赤=低）
 *
 * 7.2 3Dシーンでの視線レイ
 * - カメラ位置から視線方向へのレイを投射
 * - Three.js ArrowHelper でレイを可視化
 * - シーンのジオメトリ（グリッド/キューブ）との交差点を表示
 *
 * 成功基準:
 * ✅ 目のランドマークがシアンドットで正確に追跡される
 * ✅ 視線矢印がユーザーの視線方向を指す
 * ✅ 3Dレイがリアルタイムで更新される
 * ✅ キューブを見るとレイが交差点をハイライト
 */

import * as THREE from 'three';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('7', '視線方向の可視化: Face Landmarker + Gaze Ray');

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

// 🆕 Phase 7: 視線レイの可視化
let gazeRayHelper = null;  // ArrowHelper for gaze ray
let gazeIntersectionMarker = null;  // 交差点マーカー
let raycaster = null;  // Raycaster for intersection detection

// カメラ関連
let videoElement;
let videoStream;

// MediaPipe関連
let faceLandmarker;  // 🆕 Phase 7: FaceDetector → FaceLandmarker
let lastDetectionTime = 0;

// キャンバスオーバーレイ(顔検出結果を描画)
let canvasElement;
let canvasCtx;

// 座標変換用の変数
let eyeX = 0; // 物理座標X（cm単位）
let eyeY = 2; // 物理座標Y（cm単位）カメラY位置に対応
let eyeZ = 10; // 物理座標Z（cm単位）デフォルト視聴距離

// スムージング用の変数
let smoothedX = 0;
let smoothedY = 2;
let smoothedZ = 10;

// 生座標（スムージング前）
let rawX = 0;
let rawY = 2;
let rawZ = 10;

// 🆕 Phase 7: 視線ベクトル
let gazeDirectionX = 0;
let gazeDirectionY = 0;
let gazeDirectionZ = -1;  // デフォルトは前方（-Z方向）

// 顔検出状態の管理
let faceDetected = false;
let lastFaceDetectionTime = 0;
const FACE_LOST_TIMEOUT = 2000; // 2秒間顔未検出でデフォルトに戻る

// 設定
const ROTATION_SPEED = 0.01;
const VIDEO_CONFIG = {
  width: 640,
  height: 480,
  frameRate: 30
};

// 🆕 Phase 7: MediaPipe Face Landmarker設定
const MEDIAPIPE_CONFIG = {
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  runningMode: 'VIDEO',
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
};

// 顔検出の頻度(2フレームに1回 = 30fps)
const DETECTION_INTERVAL_MS = 33; // 約30fps

// 物理パラメータ（Phase 6から継承）
const PHYSICAL_PARAMS = {
  screenWidth: 16.59,     // 画面の物理幅（cm）FOV=50°相当
  screenHeight: 9.33,     // 画面の物理高さ（cm）FOV=50°相当
  viewingDistance: 10,    // デフォルト視聴距離（cm）
  cameraY: 2,             // カメラのY位置オフセット（cm）
  scale: 1.0              // 座標スケール（感度調整）
};

// スムージングパラメータ
const SMOOTHING_PARAMS = {
  alphaX: 0.1,   // X軸のスムージング係数
  alphaY: 0.1,   // Y軸のスムージング係数
  alphaZ: 0.15   // Z軸のスムージング係数
};

// 🆕 Phase 7: 視線可視化設定
const GAZE_VIS_CONFIG = {
  showGazeRay: true,           // 3Dレイを表示
  showLandmarks: true,         // 2D目のランドマークを表示
  rayLength: 50,               // レイの長さ（cm単位）
  rayColor: 0x00ffff,          // シアン色
  intersectionMarkerColor: 0xff0000,  // 赤色
  landmarkColor: 'cyan',       // 目のランドマーク色
  gazeArrowColor: 'yellow'     // 視線矢印の色
};

// 🆕 Phase 7: MediaPipe Face Landmarkerの重要なランドマークインデックス
const LANDMARK_INDICES = {
  LEFT_EYE_CENTER: 468,    // 左目の虹彩中心
  RIGHT_EYE_CENTER: 473,   // 右目の虹彩中心
  NOSE_TIP: 1,             // 鼻先
  FOREHEAD: 10             // 額の中心
};

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

  // Phase 6: デフォルト視点でOff-Axis Projectionを初期化
  applyOffAxisProjection(0, PHYSICAL_PARAMS.cameraY, PHYSICAL_PARAMS.viewingDistance);

  console.log('✅ Camera initialized with Off-Axis Projection');
  console.log(`   Initial position: (0, ${PHYSICAL_PARAMS.cameraY}, ${PHYSICAL_PARAMS.viewingDistance})`);
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
// 🆕 Phase 7: 視線レイの初期化
// =====================================

function initGazeVisualization() {
  // Raycasterを初期化
  raycaster = new THREE.Raycaster();

  // 視線レイのArrowHelperを作成
  const origin = new THREE.Vector3(0, 0, 0);
  const direction = new THREE.Vector3(0, 0, -1);
  const length = GAZE_VIS_CONFIG.rayLength;
  const color = GAZE_VIS_CONFIG.rayColor;

  gazeRayHelper = new THREE.ArrowHelper(direction, origin, length, color, 2, 1);
  gazeRayHelper.visible = GAZE_VIS_CONFIG.showGazeRay;
  scene.add(gazeRayHelper);

  // 交差点マーカー（赤い球体）
  const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: GAZE_VIS_CONFIG.intersectionMarkerColor
  });
  gazeIntersectionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  gazeIntersectionMarker.visible = false;
  scene.add(gazeIntersectionMarker);

  console.log('✅ Gaze visualization initialized');
  console.log(`   Ray length: ${GAZE_VIS_CONFIG.rayLength}cm`);
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
        console.log(`   Resolution: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
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
  console.log(`   Canvas size: ${canvasElement.width}x${canvasElement.height}`);
}

// =====================================
// 🆕 Phase 7: MediaPipe Face Landmarker初期化
// =====================================

async function initFaceLandmarker() {
  console.log('🤖 Initializing MediaPipe Face Landmarker...');

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    console.log('   Vision tasks loaded');

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
    console.log(`   Model: face_landmarker (478 landmarks)`);
    console.log(`   Min detection confidence: ${MEDIAPIPE_CONFIG.minFaceDetectionConfidence}`);
    console.log(`   Running mode: ${MEDIAPIPE_CONFIG.runningMode}`);

    return faceLandmarker;

  } catch (error) {
    console.error('❌ Face Landmarker initialization error:', error);
    showError('MediaPipeエラー', 'モデルの読み込みに失敗しました。ページを再読み込みしてください。');
    throw error;
  }
}

// =====================================
// EMAスムージング実装（Phase 5から継承）
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
// 座標変換関数（Phase 4から継承）
// =====================================

function convertToPhysicalCoordinates(normalizedX, normalizedY) {
  // 中心を0とした正規化座標に変換 [-1, 1]
  const centeredX = (normalizedX - 0.5) * 2;
  const centeredY = (normalizedY - 0.5) * 2;

  // ミラーリング（X軸反転）
  const mirroredX = -centeredX;

  // Y軸反転（MediaPipe: 左上原点 vs Three.js: 中心原点）
  const flippedY = -centeredY;

  // 物理座標に変換（cm単位）
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
// 🆕 Phase 7: 視線方向の計算
// =====================================

/**
 * 左右の目のランドマークから視線方向を推定
 *
 * @param {Array} landmarks - 顔のランドマーク配列（478個）
 * @returns {Object} - { x, y, z } 正規化された視線方向ベクトル
 */
function calculateGazeDirection(landmarks) {
  // 左目と右目の虹彩中心を取得
  const leftEye = landmarks[LANDMARK_INDICES.LEFT_EYE_CENTER];
  const rightEye = landmarks[LANDMARK_INDICES.RIGHT_EYE_CENTER];

  // 両目の中心を計算（正規化座標）
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const eyeCenterZ = (leftEye.z + rightEye.z) / 2;

  // 鼻先を取得（視線方向の参照点）
  const noseTip = landmarks[LANDMARK_INDICES.NOSE_TIP];

  // 視線ベクトルを計算（目の中心から鼻先への方向）
  let gazeX = noseTip.x - eyeCenterX;
  let gazeY = noseTip.y - eyeCenterY;
  let gazeZ = noseTip.z - eyeCenterZ;

  // 正規化（単位ベクトルに変換）
  const magnitude = Math.sqrt(gazeX * gazeX + gazeY * gazeY + gazeZ * gazeZ);
  if (magnitude > 0) {
    gazeX /= magnitude;
    gazeY /= magnitude;
    gazeZ /= magnitude;
  }

  // MediaPipe座標系からThree.js座標系への変換
  // MediaPipe: X右, Y下, Z後ろ
  // Three.js: X右, Y上, Z手前
  return {
    x: -gazeX,  // ミラーリング
    y: -gazeY,  // Y軸反転
    z: gazeZ    // Z軸はそのまま
  };
}

// =====================================
// Phase 6: Off-Axis Projection実装
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

  if (Math.random() < 0.1) {
    console.log(`🎥 Off-Axis Projection:`);
    console.log(`   Eye Position: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)}) cm`);
  }
}

function returnToDefaultView() {
  const defaultX = 0;
  const defaultY = PHYSICAL_PARAMS.cameraY;
  const defaultZ = PHYSICAL_PARAMS.viewingDistance;

  smoothedX = applyEMA(defaultX, smoothedX, 0.05);
  smoothedY = applyEMA(defaultY, smoothedY, 0.05);
  smoothedZ = applyEMA(defaultZ, smoothedZ, 0.05);

  eyeX = smoothedX;
  eyeY = smoothedY;
  eyeZ = smoothedZ;

  applyOffAxisProjection(eyeX, eyeY, eyeZ);

  const isNearDefault =
    Math.abs(smoothedX - defaultX) < 0.1 &&
    Math.abs(smoothedY - defaultY) < 0.1 &&
    Math.abs(smoothedZ - defaultZ) < 0.5;

  if (isNearDefault && Math.random() < 0.1) {
    console.log('🏠 Returned to default view');
  }
}

// =====================================
// 🆕 Phase 7: 視線レイの更新
// =====================================

function updateGazeRay() {
  if (!gazeRayHelper || !GAZE_VIS_CONFIG.showGazeRay) {
    if (gazeRayHelper) gazeRayHelper.visible = false;
    if (gazeIntersectionMarker) gazeIntersectionMarker.visible = false;
    return;
  }

  gazeRayHelper.visible = true;

  // カメラ位置から視線方向へのレイ
  const origin = new THREE.Vector3(eyeX, eyeY, eyeZ);
  const direction = new THREE.Vector3(gazeDirectionX, gazeDirectionY, gazeDirectionZ);
  direction.normalize();

  // ArrowHelperを更新
  gazeRayHelper.position.copy(origin);
  gazeRayHelper.setDirection(direction);
  gazeRayHelper.setLength(GAZE_VIS_CONFIG.rayLength, 2, 1);

  // Raycasterで交差判定
  raycaster.set(origin, direction);
  const intersects = raycaster.intersectObjects([cube, gridHelper], true);

  if (intersects.length > 0) {
    const intersection = intersects[0];
    gazeIntersectionMarker.position.copy(intersection.point);
    gazeIntersectionMarker.visible = true;

    if (Math.random() < 0.1) {
      console.log(`🎯 Gaze intersection at (${intersection.point.x.toFixed(1)}, ${intersection.point.y.toFixed(1)}, ${intersection.point.z.toFixed(1)})`);
    }
  } else {
    gazeIntersectionMarker.visible = false;
  }
}

// =====================================
// 🆕 Phase 7: 顔ランドマーク検出処理
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

  // ランドマーク描画
  if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
    faceDetected = true;
    lastFaceDetectionTime = now;

    const landmarks = results.faceLandmarks[0];

    // バウンディングボックスを計算
    const bbox = calculateBoundingBox(landmarks);

    // 座標変換
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

    // 🆕 Phase 7: 視線方向を計算
    const gazeDir = calculateGazeDirection(landmarks);
    gazeDirectionX = gazeDir.x;
    gazeDirectionY = gazeDir.y;
    gazeDirectionZ = gazeDir.z;

    // 視線レイを更新
    updateGazeRay();

    // 2Dオーバーレイに描画
    drawLandmarks(landmarks, bbox);

    if (Math.random() < 0.5) {
      console.log(`👁️ Eye Position: X=${eyeX.toFixed(1)}cm, Y=${eyeY.toFixed(1)}cm, Z=${eyeZ.toFixed(1)}cm`);
      console.log(`   Gaze Direction: (${gazeDirectionX.toFixed(2)}, ${gazeDirectionY.toFixed(2)}, ${gazeDirectionZ.toFixed(2)})`);
    }
  } else {
    faceDetected = false;

    if (now - lastFaceDetectionTime > FACE_LOST_TIMEOUT) {
      returnToDefaultView();
    }
  }

  updateDetectionInfo(results);
}

// =====================================
// 🆕 Phase 7: バウンディングボックスの計算
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
// 🆕 Phase 7: ランドマーク描画
// =====================================

function drawLandmarks(landmarks, bbox) {
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  // バウンディングボックスを描画
  const x = bbox.originX * videoWidth;
  const y = bbox.originY * videoHeight;
  const width = bbox.width * videoWidth;
  const height = bbox.height * videoHeight;

  canvasCtx.strokeStyle = '#00ff00';
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeRect(x, y, width, height);

  // 目のランドマークを描画（シアン色の円）
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

  // 視線方向の矢印を描画
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

  // 矢印の先端
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

  // 座標表示
  canvasCtx.fillStyle = '#00ff00';
  canvasCtx.font = 'bold 12px monospace';
  canvasCtx.fillText(
    `Eye: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)}) cm`,
    x,
    y + height + 15
  );
  canvasCtx.fillText(
    `Gaze: (${gazeDirectionX.toFixed(2)}, ${gazeDirectionY.toFixed(2)}, ${gazeDirectionZ.toFixed(2)})`,
    x,
    y + height + 30
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
    debugInfo['Video Resolution'] = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
  }

  if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
    debugInfo['Faces Detected'] = `✅ ${results.faceLandmarks.length}`;
    debugInfo['Landmarks'] = `478 points`;
    debugInfo['Eye Position (cm)'] = `(${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})`;
    debugInfo['Gaze Direction'] = `(${gazeDirectionX.toFixed(2)}, ${gazeDirectionY.toFixed(2)}, ${gazeDirectionZ.toFixed(2)})`;
    debugInfo['Off-Axis Active'] = '✅ Yes';
    debugInfo['Gaze Ray'] = gazeRayHelper && gazeRayHelper.visible ? '✅ Visible' : '❌ Hidden';
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
    debugInfo['Eye Position (cm)'] = 'N/A';
    debugInfo['Gaze Direction'] = 'N/A';
    debugInfo['Off-Axis Active'] = '❌ No (Returning to default)';
    debugInfo['Gaze Ray'] = '❌ Hidden';
  }

  updateDebugInfo(debugInfo);
}

// =====================================
// アニメーションループ
// =====================================

function animate() {
  animationId = requestAnimationFrame(animate);

  // キューブを回転
  cube.rotation.y += ROTATION_SPEED;
  cube.rotation.x += ROTATION_SPEED * 0.5;

  // 顔検出を実行
  if (faceLandmarker) {
    detectFaces();
  }

  // レンダリング
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
    console.log('🚀 Phase 7: Initializing Gaze Visualization...');

    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    // Three.jsシーンを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();
    initGazeVisualization();  // 🆕 Phase 7

    console.log('');
    console.log('🆕 Phase 7の新機能: 視線方向の可視化');
    console.log('');
    console.log('⚙️ Face Landmarker設定:');
    console.log('   - モデル: face_landmarker (478ランドマーク)');
    console.log('   - 目のランドマーク: 左目中心(468), 右目中心(473)');
    console.log('   - 視線推定: 目の中心→鼻先ベクトル');
    console.log('');
    console.log('📊 視線可視化機能:');
    console.log('   - 2Dオーバーレイ: シアン色の目のランドマーク + 黄色の視線矢印');
    console.log('   - 3Dシーン: シアン色の視線レイ(ArrowHelper)');
    console.log('   - 交差判定: レイがキューブ/グリッドと交差すると赤い球体を表示');
    console.log('');

    await initFaceLandmarker();

    toggleLoadingScreen(true, 'カメラアクセス中...');

    await initWebcam();
    initCanvas();

    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene + Webcam + Face Landmarker + Gaze Visualization ready!');
    }, 500);

    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - Three.jsシーン（回転するキューブとグリッド）');
    console.log('   - 画面右下のビデオプレビュー');
    console.log('   - ビデオ上に緑色のバウンディングボックス');
    console.log('   - 🆕 シアン色の目のランドマーク');
    console.log('   - 🆕 黄色の視線方向矢印');
    console.log('   - 🆕 3Dシーンにシアン色の視線レイ');
    console.log('   - 🆕 レイが物体と交差すると赤い球体');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   ✅ キューブを見る → 視線レイがキューブと交差');
    console.log('   ✅ グリッドを見る → 視線レイがグリッドと交差');
    console.log('   ✅ 視線を左右に動かす → 黄色の矢印が追従');
    console.log('   ✅ 2Dオーバーレイと3Dレイが同期している');

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
 * 🎯 Challenge 1: 視線トラッキングの精度確認
 * - キューブを見て、視線レイが正しく交差するか確認
 * - グリッドの異なる位置を見て、交差点が正確か確認
 * - 頭を動かしながら視線を固定し、レイが追従するか確認
 *
 * 🎯 Challenge 2: 視線ランドマークの可視化拡張
 * - 全478ランドマークを描画してみる
 * - 目の輪郭（ランドマーク362-382, 384-398）を線で描画
 * - 鼻、口、眉毛のランドマークも追加
 *
 * 🎯 Challenge 3: 視線方向の改善
 * - 目の中心→鼻先だけでなく、額の方向も考慮
 * - 左右の目で個別に視線ベクトルを計算
 * - まばたき検出を追加（目が閉じている時は視線レイを非表示）
 *
 * 🎯 Challenge 4: 交差点のハイライト
 * - 交差したオブジェクトの色を変更
 * - 交差点に視覚エフェクト（パーティクル、リング）を追加
 * - 複数オブジェクトとの交差を全て表示
 *
 * 🎯 Challenge 5: 視線ヒートマップ
 * - ユーザーがどこを見ていたかを記録
 * - グリッド上にヒートマップを重畳表示
 * - 時間経過で過去の視線データをフェードアウト
 *
 * 🎯 Challenge 6: UI操作
 * - 視線でボタンを選択（2秒間見続けるとクリック）
 * - キューブを視線で回転制御
 * - 視線の軌跡を描画（過去1秒分のレイを半透明で表示）
 *
 * 🎯 Challenge 7: パフォーマンス最適化
 * - 視線計算を別スレッド（Web Worker）で実行
 * - ランドマーク描画を間引き（3フレームに1回など）
 * - レイキャスティングの対象を限定
 *
 * 🎯 Challenge 8: デバッグUIの追加
 * - lil-guiで視線レイの長さを調整可能に
 * - 視線ランドマークの表示/非表示切り替え
 * - 交差判定の有効/無効切り替え
 */
