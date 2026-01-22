/**
 * Phase 5: スムージング (EMA - Exponential Moving Average)
 *
 * このフェーズで学ぶこと:
 * - Exponential Moving Average (EMA) アルゴリズムの実装
 * - X, Y, Z軸それぞれの独立したスムージング
 * - Alpha値による強度調整（0.0 = 変化なし、1.0 = スムージングなし）
 * - ジッター（ガタつき）の軽減と遅延のバランス
 *
 * 成功基準:
 * ✅ 生座標のジッターが平滑化される
 * ✅ Alpha値を調整してスムージング強度を変更可能
 * ✅ Alpha = 0.1 で遅延を感じない程度にスムーズ
 * ✅ カメラの動きが自然で滑らか
 */

import * as THREE from 'three';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('5', 'スムージング: EMA (Exponential Moving Average)');

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

// カメラ関連
let videoElement;
let videoStream;

// MediaPipe関連
let faceDetector;
let lastDetectionTime = 0;

// キャンバスオーバーレイ(顔検出結果を描画)
let canvasElement;
let canvasCtx;

// 座標変換用の変数
let eyeX = 0; // 物理座標X（cm単位）
let eyeY = 0; // 物理座標Y（cm単位）
let eyeZ = 60; // 物理座標Z（cm単位）デフォルト視聴距離

// 🆕 Phase 5: スムージング用の変数
let smoothedX = 0; // スムージング後のX座標
let smoothedY = 0; // スムージング後のY座標
let smoothedZ = 60; // スムージング後のZ座標

// 生座標（スムージング前）を保持してデバッグ用に比較
let rawX = 0;
let rawY = 0;
let rawZ = 60;

// 設定
const ROTATION_SPEED = 0.01;
const VIDEO_CONFIG = {
  width: 640,
  height: 480,
  frameRate: 30
};

// MediaPipe設定
const MEDIAPIPE_CONFIG = {
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  runningMode: 'VIDEO',
  minDetectionConfidence: 0.5,
  minSuppressionThreshold: 0.5
};

// 顔検出の頻度(2フレームに1回 = 30fps)
const DETECTION_INTERVAL_MS = 33; // 約30fps

// 物理パラメータ（CLAUDE.mdに基づく）
const PHYSICAL_PARAMS = {
  screenWidth: 33.8,      // 画面の物理幅（cm）15.4インチ想定
  screenHeight: 19.0,     // 画面の物理高さ（cm）16:9
  viewingDistance: 60,    // デフォルト視聴距離（cm）
  scale: 2.0              // 座標スケール（感度調整）
};

// 🆕 Phase 5: スムージングパラメータ
const SMOOTHING_PARAMS = {
  alphaX: 0.1,   // X軸のスムージング係数（0.0 = 完全スムーズ、1.0 = スムージングなし）
  alphaY: 0.1,   // Y軸のスムージング係数
  alphaZ: 0.15   // Z軸のスムージング係数（少し強めにスムージング）
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
  camera.position.set(0, 2, 10);
  camera.lookAt(0, 0, 0);

  console.log('✅ Camera initialized');
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
// MediaPipe Face Detection初期化
// =====================================

async function initFaceDetector() {
  console.log('🤖 Initializing MediaPipe Face Detector...');

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    console.log('   Vision tasks loaded');

    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_CONFIG.modelAssetPath,
        delegate: 'GPU'
      },
      runningMode: MEDIAPIPE_CONFIG.runningMode,
      minDetectionConfidence: MEDIAPIPE_CONFIG.minDetectionConfidence,
      minSuppressionThreshold: MEDIAPIPE_CONFIG.minSuppressionThreshold
    });

    console.log('✅ Face Detector initialized');
    console.log(`   Model: blaze_face_short_range`);
    console.log(`   Min confidence: ${MEDIAPIPE_CONFIG.minDetectionConfidence}`);
    console.log(`   Running mode: ${MEDIAPIPE_CONFIG.runningMode}`);

    return faceDetector;

  } catch (error) {
    console.error('❌ Face Detector initialization error:', error);
    showError('MediaPipeエラー', 'モデルの読み込みに失敗しました。ページを再読み込みしてください。');
    throw error;
  }
}

// =====================================
// 🆕 Phase 5: EMAスムージング実装
// =====================================

/**
 * Exponential Moving Average (EMA) によるスムージング
 *
 * EMAアルゴリズム:
 *   smoothed = previous × (1 - alpha) + current × alpha
 *
 * Alpha値の意味:
 *   - alpha = 0.0: 完全にスムーズ（変化なし）
 *   - alpha = 0.1: 90%が前の値、10%が新しい値（推奨）
 *   - alpha = 0.5: 50%ずつ（中間）
 *   - alpha = 1.0: スムージングなし（生データそのまま）
 *
 * 遅延とスムーズさのトレードオフ:
 *   - Alpha が小さい → よりスムーズだが遅延が大きい
 *   - Alpha が大きい → 応答が速いがジッターが残る
 *
 * @param {number} current - 現在の値（生データ）
 * @param {number} previous - 前回のスムージング済み値
 * @param {number} alpha - スムージング係数 [0.0, 1.0]
 * @returns {number} - スムージング後の値
 */
function applyEMA(current, previous, alpha) {
  return previous * (1 - alpha) + current * alpha;
}

/**
 * 座標全体にスムージングを適用
 *
 * X, Y, Z軸それぞれに独立したalpha値を使用することで、
 * 軸ごとに最適なスムージングを実現する。
 *
 * 例: Z軸（奥行き）は変化が少ないため、強めのスムージングを適用
 *
 * @param {number} rawX - 生のX座標
 * @param {number} rawY - 生のY座標
 * @param {number} rawZ - 生のZ座標
 */
function smoothCoordinates(rawX, rawY, rawZ) {
  // 各軸に独立したEMAを適用
  smoothedX = applyEMA(rawX, smoothedX, SMOOTHING_PARAMS.alphaX);
  smoothedY = applyEMA(rawY, smoothedY, SMOOTHING_PARAMS.alphaY);
  smoothedZ = applyEMA(rawZ, smoothedZ, SMOOTHING_PARAMS.alphaZ);

  // デバッグ用: 生座標とスムージング後の差分を計算
  const deltaX = Math.abs(rawX - smoothedX);
  const deltaY = Math.abs(rawY - smoothedY);
  const deltaZ = Math.abs(rawZ - smoothedZ);

  // 10%の確率でデバッグ情報を出力
  if (Math.random() < 0.1) {
    console.log(`🎚️ Smoothing Debug:`);
    console.log(`   Raw:      (${rawX.toFixed(1)}, ${rawY.toFixed(1)}, ${rawZ.toFixed(1)}) cm`);
    console.log(`   Smoothed: (${smoothedX.toFixed(1)}, ${smoothedY.toFixed(1)}, ${smoothedZ.toFixed(1)}) cm`);
    console.log(`   Delta:    (Δ${deltaX.toFixed(2)}, Δ${deltaY.toFixed(2)}, Δ${deltaZ.toFixed(2)}) cm`);
    console.log(`   Alpha:    (${SMOOTHING_PARAMS.alphaX}, ${SMOOTHING_PARAMS.alphaY}, ${SMOOTHING_PARAMS.alphaZ})`);
  }
}

// =====================================
// 座標変換関数（Phase 4から継承）
// =====================================

/**
 * MediaPipe正規化座標 [0, 1] → Three.js物理座標（cm単位）への変換
 */
function convertToPhysicalCoordinates(normalizedX, normalizedY) {
  const centeredX = (normalizedX - 0.5) * 2;
  const centeredY = (normalizedY - 0.5) * 2;

  const mirroredX = -centeredX;
  const flippedY = -centeredY;

  const physicalX = mirroredX * (PHYSICAL_PARAMS.screenWidth / 2) * PHYSICAL_PARAMS.scale;
  const physicalY = flippedY * (PHYSICAL_PARAMS.screenHeight / 2) * PHYSICAL_PARAMS.scale;

  return { x: physicalX, y: physicalY };
}

/**
 * バウンディングボックスから顔までの距離を推定
 */
function estimateDistance(bboxWidth, bboxHeight) {
  const k = 18;
  const rawDistance = k / bboxWidth;

  const estimatedDistance = Math.max(30, Math.min(120, rawDistance));

  return estimatedDistance;
}

// =====================================
// 顔検出処理（スムージングを追加）
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

  const detections = faceDetector.detectForVideo(videoElement, now);

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  drawDetections(detections);

  // 顔検出結果から座標変換
  if (detections && detections.detections && detections.detections.length > 0) {
    const detection = detections.detections[0];
    const bbox = detection.boundingBox;

    const isNormalized = bbox.originX <= 1 && bbox.originY <= 1 && bbox.width <= 1 && bbox.height <= 1;

    let normalizedX, normalizedY, normalizedWidth, normalizedHeight;

    if (isNormalized) {
      normalizedX = bbox.originX + bbox.width / 2;
      normalizedY = bbox.originY + bbox.height / 2;
      normalizedWidth = bbox.width;
      normalizedHeight = bbox.height;
    } else {
      normalizedX = (bbox.originX + bbox.width / 2) / videoElement.videoWidth;
      normalizedY = (bbox.originY + bbox.height / 2) / videoElement.videoHeight;
      normalizedWidth = bbox.width / videoElement.videoWidth;
      normalizedHeight = bbox.height / videoElement.videoHeight;
    }

    // 物理座標に変換（生データ）
    const physical = convertToPhysicalCoordinates(normalizedX, normalizedY);
    rawX = physical.x;
    rawY = physical.y;
    rawZ = estimateDistance(normalizedWidth, normalizedHeight);

    // 🆕 Phase 5: スムージングを適用
    smoothCoordinates(rawX, rawY, rawZ);

    // スムージング後の座標を使用
    eyeX = smoothedX;
    eyeY = smoothedY;
    eyeZ = smoothedZ;

    // 50%の確率でコンソールに出力
    if (Math.random() < 0.5) {
      console.log(`👁️ Eye Position (Smoothed): X=${eyeX.toFixed(1)}cm, Y=${eyeY.toFixed(1)}cm, Z=${eyeZ.toFixed(1)}cm`);
    }
  }

  updateDetectionInfo(detections);
}

// =====================================
// 描画処理（Phase 5用に拡張）
// =====================================

function drawDetections(detections) {
  if (!detections || !detections.detections || detections.detections.length === 0) {
    return;
  }

  const detection = detections.detections[0];
  const bbox = detection.boundingBox;

  const x = bbox.originX;
  const y = bbox.originY;
  const width = bbox.width;
  const height = bbox.height;

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // バウンディングボックスを描画
  canvasCtx.strokeStyle = '#00ff00';
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeRect(x, y, width, height);

  // 顔の中心に十字マークを描画
  canvasCtx.strokeStyle = '#ff0000';
  canvasCtx.lineWidth = 2;
  const crossSize = 10;
  canvasCtx.beginPath();
  canvasCtx.moveTo(centerX - crossSize, centerY);
  canvasCtx.lineTo(centerX + crossSize, centerY);
  canvasCtx.moveTo(centerX, centerY - crossSize);
  canvasCtx.lineTo(centerX, centerY + crossSize);
  canvasCtx.stroke();

  // 信頼度スコアを表示
  const confidence = (detection.categories[0].score * 100).toFixed(1);
  canvasCtx.fillStyle = '#00ff00';
  canvasCtx.font = 'bold 16px Arial';
  canvasCtx.fillText(`${confidence}%`, x, y - 5);

  // 🆕 Phase 5: スムージング後の座標を表示（緑色）
  canvasCtx.fillStyle = '#00ff00'; // 緑色
  canvasCtx.font = 'bold 12px monospace';
  canvasCtx.fillText(
    `Smoothed: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)}) cm`,
    x,
    y + height + 15
  );

  // 🆕 Phase 5: 生座標を表示（シアン色）- 比較用
  canvasCtx.fillStyle = '#00ffff'; // シアン色
  canvasCtx.fillText(
    `Raw: (${rawX.toFixed(1)}, ${rawY.toFixed(1)}, ${rawZ.toFixed(1)}) cm`,
    x,
    y + height + 30
  );

  // スムージングの効果を可視化する矢印
  drawSmoothingIndicator(centerX, centerY);
}

/**
 * 🆕 Phase 5: スムージングの効果を可視化
 * 生座標からスムージング後座標への矢印を描画
 */
function drawSmoothingIndicator(centerX, centerY) {
  // 生座標とスムージング後座標の差分を可視化
  const deltaX = (rawX - smoothedX) * 2; // スケール調整
  const deltaY = (rawY - smoothedY) * 2; // スケール調整

  // 差分が十分大きい場合のみ描画
  if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
    canvasCtx.strokeStyle = '#ff00ff'; // マゼンタ
    canvasCtx.lineWidth = 2;
    canvasCtx.setLineDash([5, 5]); // 破線

    canvasCtx.beginPath();
    canvasCtx.moveTo(centerX, centerY);
    canvasCtx.lineTo(centerX + deltaX, centerY - deltaY); // Y軸は上が負
    canvasCtx.stroke();

    // 矢印の先端
    canvasCtx.beginPath();
    canvasCtx.arc(centerX + deltaX, centerY - deltaY, 3, 0, Math.PI * 2);
    canvasCtx.fillStyle = '#ff00ff';
    canvasCtx.fill();

    canvasCtx.setLineDash([]); // 破線をリセット
  }
}

// =====================================
// デバッグ情報更新（Phase 5用に拡張）
// =====================================

function updateDetectionInfo(detections) {
  const debugInfo = {
    'Camera Position': `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`,
    'Objects in Scene': scene.children.length
  };

  if (videoElement && videoElement.readyState >= 2) {
    debugInfo['Video Status'] = '📹 Active';
    debugInfo['Video Resolution'] = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
  }

  if (detections && detections.detections && detections.detections.length > 0) {
    const detection = detections.detections[0];

    debugInfo['Faces Detected'] = `✅ ${detections.detections.length}`;
    debugInfo['Confidence'] = `${(detection.categories[0].score * 100).toFixed(1)}%`;

    // 🆕 Phase 5: 生座標とスムージング後座標の両方を表示
    debugInfo['Raw Position (cm)'] = `(${rawX.toFixed(1)}, ${rawY.toFixed(1)}, ${rawZ.toFixed(1)})`;
    debugInfo['Smoothed Position (cm)'] = `(${smoothedX.toFixed(1)}, ${smoothedY.toFixed(1)}, ${smoothedZ.toFixed(1)})`;

    // 差分を計算して表示
    const deltaX = Math.abs(rawX - smoothedX);
    const deltaY = Math.abs(rawY - smoothedY);
    const deltaZ = Math.abs(rawZ - smoothedZ);
    debugInfo['Smoothing Delta'] = `(Δ${deltaX.toFixed(2)}, Δ${deltaY.toFixed(2)}, Δ${deltaZ.toFixed(2)})`;

    // スムージングパラメータ
    debugInfo['Alpha (X, Y, Z)'] = `(${SMOOTHING_PARAMS.alphaX}, ${SMOOTHING_PARAMS.alphaY}, ${SMOOTHING_PARAMS.alphaZ})`;
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
    debugInfo['Smoothed Position (cm)'] = 'N/A';
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
  if (faceDetector) {
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
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

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

  if (faceDetector) {
    faceDetector.close();
    console.log('🛑 Face Detector closed');
  }

  if (cube) {
    cube.geometry.dispose();
    cube.material.dispose();
  }

  if (cubeWireframe) {
    cubeWireframe.geometry.dispose();
    cubeWireframe.material.dispose();
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
    console.log('🚀 Phase 5: Initializing Smoothing (EMA)...');

    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    // Three.jsシーンを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();

    console.log('');
    console.log('🆕 Phase 5の新機能: スムージング（EMA）');
    console.log('');
    console.log('📊 スムージングパラメータ:');
    console.log(`   - Alpha X: ${SMOOTHING_PARAMS.alphaX} (左右の動き)`);
    console.log(`   - Alpha Y: ${SMOOTHING_PARAMS.alphaY} (上下の動き)`);
    console.log(`   - Alpha Z: ${SMOOTHING_PARAMS.alphaZ} (奥行きの動き)`);
    console.log('');
    console.log('💡 Alpha値の意味:');
    console.log('   - 0.0 = 完全にスムーズ（変化なし）');
    console.log('   - 0.1 = 推奨値（90%前の値、10%新しい値）');
    console.log('   - 1.0 = スムージングなし（生データそのまま）');

    await initFaceDetector();

    toggleLoadingScreen(true, 'カメラアクセス中...');

    await initWebcam();
    initCanvas();

    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene + Webcam + Face Detection + Smoothing ready!');
    }, 500);

    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - Three.jsシーン（回転するキューブ）');
    console.log('   - 画面右下のビデオプレビュー');
    console.log('   - ビデオ上に緑色のバウンディングボックス');
    console.log('   - 🆕 緑色: スムージング後の座標');
    console.log('   - 🆕 シアン色: 生座標（比較用）');
    console.log('   - 🆕 マゼンタの破線矢印: 生座標→スムージング後の差分');
    console.log('   - 🆕 Info Panelに"Raw Position"と"Smoothed Position"が表示');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   ✅ 頭を小刻みに動かす → 生座標はジッター、スムージング後は滑らか');
    console.log('   ✅ 急激に動かす → 遅延が感じられるか確認（Alpha=0.1なら遅延少ない）');
    console.log('   ✅ Info Panelの"Smoothing Delta"で差分を確認');
    console.log('   ✅ ビデオ上のマゼンタ矢印でスムージング効果を可視化');
    console.log('');
    console.log('🎚️ スムージング調整:');
    console.log('   - SMOOTHING_PARAMS.alphaXを変更して効果を比較');
    console.log('   - 0.01（超スムーズ）～ 0.5（応答性重視）で試してみよう');
    console.log('   - 各軸で独立したalphaを設定できるのがポイント！');

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
 * 🎯 Challenge 1: Alpha値を変更
 * - SMOOTHING_PARAMS.alphaXを変更してみよう
 * - 例: 0.01 (超スムーズ), 0.05 (スムーズ), 0.2 (応答性重視), 0.5 (ほぼ生データ)
 * - 遅延とスムーズさのトレードオフを体感しよう
 *
 * 🎯 Challenge 2: 軸ごとに異なるAlpha
 * - X軸とY軸で異なるalphaを設定
 * - 例: alphaX = 0.1, alphaY = 0.2
 * - どの軸でスムージングが強いと感じるか確認
 *
 * 🎯 Challenge 3: スムージングON/OFF比較
 * - applyEMA関数を無効化（alpha = 1.0で呼び出し）
 * - 生データとスムージング後のジッターの差を比較
 *
 * 🎯 Challenge 4: GUIでAlpha調整
 * - lil-guiを使ってリアルタイムでalphaを調整
 * - const gui = new GUI();
 * - gui.add(SMOOTHING_PARAMS, 'alphaX', 0.0, 1.0);
 *
 * 🎯 Challenge 5: 二重スムージング
 * - EMAを2回連続で適用してみよう
 * - smoothedX2 = applyEMA(smoothedX, smoothedX2, 0.1);
 * - よりスムーズになるか、遅延が問題になるか確認
 *
 * 🎯 Challenge 6: 速度ベースの適応的スムージング
 * - 頭の動きが速い時はalphaを大きく（応答性重視）
 * - 頭の動きが遅い時はalphaを小さく（スムーズ重視）
 * - const speed = Math.abs(rawX - smoothedX);
 * - const adaptiveAlpha = Math.min(0.5, 0.1 + speed * 0.01);
 *
 * 🎯 Challenge 7: 移動平均（SMA）との比較
 * - Simple Moving Average (SMA) を実装してEMAと比較
 * - 配列に過去N個の値を保持して平均を取る
 * - どちらが自然に感じるか体感しよう
 *
 * 🎯 Challenge 8: スムージングの可視化グラフ
 * - Chart.jsなどを使って生座標とスムージング後をリアルタイムプロット
 * - 時系列データとしてグラフ化
 * - ジッターの減少を視覚的に確認
 */
