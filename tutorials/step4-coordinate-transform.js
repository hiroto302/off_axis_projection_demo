/**
 * Phase 4: 座標変換 (MediaPipe → Three.js)
 *
 * このフェーズで学ぶこと:
 * - MediaPipe正規化座標 [0,1] → Three.js物理座標（cm単位）への変換
 * - ミラーリング処理（X軸反転）でユーザー体験を向上
 * - Y軸の反転処理（MediaPipe: 左上原点 vs Three.js: 中心原点）
 * - 物理座標のコンソールログ出力とデバッグ
 *
 * 成功基準:
 * ✅ 頭を左に動かす → eyeX増加（ミラー効果）
 * ✅ 頭を上に動かす → eyeY増加（Y軸反転）
 * ✅ コンソールに物理座標（cm単位）が表示される
 * ✅ 座標変換ロジックが正しく動作する
 */

import * as THREE from 'three';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('4', '座標変換: MediaPipe → Three.js物理座標');

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

// 🆕 Phase 4: 座標変換用の変数
let eyeX = 0; // 物理座標X（cm単位）
let eyeY = 0; // 物理座標Y（cm単位）
let eyeZ = 60; // 物理座標Z（cm単位）デフォルト視聴距離

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

// 🆕 Phase 4: 物理パラメータ（CLAUDE.mdに基づく）
const PHYSICAL_PARAMS = {
  screenWidth: 33.8,      // 画面の物理幅（cm）15.4インチ想定
  screenHeight: 19.0,     // 画面の物理高さ（cm）16:9
  viewingDistance: 60,    // デフォルト視聴距離（cm）
  scale: 2.0              // 座標スケール（感度調整）
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
// 🆕 Phase 4: 座標変換関数
// =====================================

/**
 * MediaPipe正規化座標 [0, 1] → Three.js物理座標（cm単位）への変換
 *
 * 座標系の違い:
 * - MediaPipe: 左上が(0,0)、右下が(1,1)
 * - Three.js: 中心が(0,0,0)、Y軸は上が正
 *
 * 処理内容:
 * 1. 正規化座標を中心基準 [-1, 1] に変換
 * 2. ミラーリング（X軸反転）でユーザー体験向上
 * 3. Y軸反転（MediaPipeとThree.jsの違いを吸収）
 * 4. 物理座標（cm単位）へスケーリング
 *
 * @param {number} normalizedX - MediaPipe正規化X座標 [0, 1]
 * @param {number} normalizedY - MediaPipe正規化Y座標 [0, 1]
 * @returns {Object} { x, y } - 物理座標（cm単位）
 */
function convertToPhysicalCoordinates(normalizedX, normalizedY) {
  // ステップ1: 正規化座標を中心基準 [-1, 1] に変換
  // MediaPipeは左上が(0,0)なので、0.5を引いて2倍することで中心を0にする
  const centeredX = (normalizedX - 0.5) * 2;
  const centeredY = (normalizedY - 0.5) * 2;

  // ステップ2: ミラーリング（X軸反転）
  // ユーザーが左に動くと画面上も左に動くようにする（鏡の動き）
  // 反転しないと、頭を左に動かすと画面上は右に動いて違和感がある
  const mirroredX = -centeredX;

  // ステップ3: Y軸反転
  // MediaPipeは上が小さい値、Three.jsは上が正の値
  // そのため、符号を反転させる
  const flippedY = -centeredY;

  // ステップ4: 物理座標（cm単位）へスケーリング
  // 画面サイズの半分を掛けて、さらにscale係数で感度調整
  const physicalX = mirroredX * (PHYSICAL_PARAMS.screenWidth / 2) * PHYSICAL_PARAMS.scale;
  const physicalY = flippedY * (PHYSICAL_PARAMS.screenHeight / 2) * PHYSICAL_PARAMS.scale;

  return { x: physicalX, y: physicalY };
}

/**
 * バウンディングボックスから顔までの距離を推定
 *
 * 簡易的な推定方法:
 * - 顔が近い → バウンディングボックスが大きい
 * - 顔が遠い → バウンディングボックスが小さい
 *
 * 実際は顔の実際のサイズや焦点距離も考慮すべきだが、
 * ここでは簡易的に逆数で推定
 *
 * @param {number} bboxWidth - バウンディングボックスの幅（正規化座標）
 * @param {number} bboxHeight - バウンディングボックスの高さ（正規化座標）
 * @returns {number} - 推定距離（cm単位）
 */
function estimateDistance(bboxWidth, bboxHeight) {
  // バウンディングボックスの幅を使用（高さは顔の向きで変わりやすいため）
  // 典型的な値:
  // - 近い（40cm）: width ≈ 0.4-0.5
  // - 普通（60cm）: width ≈ 0.25-0.3
  // - 遠い（100cm）: width ≈ 0.15-0.2

  // 簡易的な逆数モデル: distance = k / width
  // キャリブレーション: width=0.3 → 60cm を基準とする
  // k = 60 * 0.3 = 18
  const k = 18;
  const rawDistance = k / bboxWidth;

  // デバッグ用: 生の計算値をログに出力
  if (Math.random() < 0.1) { // 10%の確率で出力
    console.log(`🔍 Distance Debug: width=${bboxWidth.toFixed(3)}, rawDistance=${rawDistance.toFixed(1)}cm`);
  }

  // 範囲を制限（30cm - 120cm）
  const estimatedDistance = Math.max(30, Math.min(120, rawDistance));

  return estimatedDistance;
}

// =====================================
// 顔検出処理（座標変換を追加）
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

  // 🆕 Phase 4: 座標変換を実行
  if (detections && detections.detections && detections.detections.length > 0) {
    const detection = detections.detections[0];
    const bbox = detection.boundingBox;

    // 🔍 デバッグ: bbox座標が正規化座標かピクセル座標か判定
    // ビデオサイズと比較して判定
    const isNormalized = bbox.originX <= 1 && bbox.originY <= 1 && bbox.width <= 1 && bbox.height <= 1;

    let normalizedX, normalizedY, normalizedWidth, normalizedHeight;

    if (isNormalized) {
      // 既に正規化座標 [0, 1] の場合
      normalizedX = bbox.originX + bbox.width / 2;
      normalizedY = bbox.originY + bbox.height / 2;
      normalizedWidth = bbox.width;
      normalizedHeight = bbox.height;
    } else {
      // ピクセル座標の場合は正規化
      normalizedX = (bbox.originX + bbox.width / 2) / videoElement.videoWidth;
      normalizedY = (bbox.originY + bbox.height / 2) / videoElement.videoHeight;
      normalizedWidth = bbox.width / videoElement.videoWidth;
      normalizedHeight = bbox.height / videoElement.videoHeight;
    }

    // 物理座標に変換
    const physical = convertToPhysicalCoordinates(normalizedX, normalizedY);
    eyeX = physical.x;
    eyeY = physical.y;

    // 距離を推定
    eyeZ = estimateDistance(normalizedWidth, normalizedHeight);

    // 🆕 2フレームに1回だけコンソールに出力（ログの氾濫を防ぐ）
    if (Math.random() < 0.5) { // 50%の確率で出力
      console.log(`👁️ Eye Position (Physical): X=${eyeX.toFixed(1)}cm, Y=${eyeY.toFixed(1)}cm, Z=${eyeZ.toFixed(1)}cm`);
      console.log(`   Debug - BBox raw: originX=${bbox.originX.toFixed(3)}, originY=${bbox.originY.toFixed(3)}, width=${bbox.width.toFixed(3)}, height=${bbox.height.toFixed(3)}`);
      console.log(`   Debug - Is normalized: ${isNormalized}, Video size: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
      console.log(`   Debug - Normalized coords: (${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)}), size: ${normalizedWidth.toFixed(3)} × ${normalizedHeight.toFixed(3)}`);
    }
  }

  updateDetectionInfo(detections);
}

// =====================================
// 描画処理（Phase 4用に拡張）
// =====================================

function drawDetections(detections) {
  if (!detections || !detections.detections || detections.detections.length === 0) {
    return;
  }

  const detection = detections.detections[0];
  const bbox = detection.boundingBox;

  // MediaPipe Tasks Vision APIのboundingBoxは既にピクセル座標
  // そのまま使用する
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

  // 🆕 Phase 4: 物理座標を表示
  canvasCtx.fillStyle = '#00ffff'; // シアン色
  canvasCtx.font = 'bold 12px monospace';
  canvasCtx.fillText(
    `Physical: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)}) cm`,
    x,
    y + height + 15
  );

  // 🆕 座標変換の方向を示す矢印を描画
  drawCoordinateArrows(centerX, centerY);
}

/**
 * 🆕 Phase 4: 座標変換の方向を示す矢印を描画
 * ユーザーの頭の動きと物理座標の関係を可視化
 */
function drawCoordinateArrows(centerX, centerY) {
  const arrowLength = 30;

  // X軸矢印（左右）- ミラーリングされている
  canvasCtx.strokeStyle = '#ff00ff'; // マゼンタ
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();

  // 左矢印（eyeX負の方向 = 頭を右に動かす）
  canvasCtx.moveTo(centerX - arrowLength, centerY);
  canvasCtx.lineTo(centerX - arrowLength - 10, centerY - 5);
  canvasCtx.moveTo(centerX - arrowLength, centerY);
  canvasCtx.lineTo(centerX - arrowLength - 10, centerY + 5);

  // 右矢印（eyeX正の方向 = 頭を左に動かす）
  canvasCtx.moveTo(centerX + arrowLength, centerY);
  canvasCtx.lineTo(centerX + arrowLength + 10, centerY - 5);
  canvasCtx.moveTo(centerX + arrowLength, centerY);
  canvasCtx.lineTo(centerX + arrowLength + 10, centerY + 5);

  canvasCtx.stroke();

  // Y軸矢印（上下）- 反転されている
  canvasCtx.strokeStyle = '#ffff00'; // 黄色
  canvasCtx.beginPath();

  // 上矢印（eyeY正の方向 = 頭を上に動かす）
  canvasCtx.moveTo(centerX, centerY - arrowLength);
  canvasCtx.lineTo(centerX - 5, centerY - arrowLength - 10);
  canvasCtx.moveTo(centerX, centerY - arrowLength);
  canvasCtx.lineTo(centerX + 5, centerY - arrowLength - 10);

  // 下矢印（eyeY負の方向 = 頭を下に動かす）
  canvasCtx.moveTo(centerX, centerY + arrowLength);
  canvasCtx.lineTo(centerX - 5, centerY + arrowLength + 10);
  canvasCtx.moveTo(centerX, centerY + arrowLength);
  canvasCtx.lineTo(centerX + 5, centerY + arrowLength + 10);

  canvasCtx.stroke();
}

// =====================================
// デバッグ情報更新（Phase 4用に拡張）
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
    const bbox = detection.boundingBox;

    debugInfo['Faces Detected'] = `✅ ${detections.detections.length}`;
    debugInfo['Confidence'] = `${(detection.categories[0].score * 100).toFixed(1)}%`;

    // 正規化座標
    const centerX = bbox.originX + bbox.width / 2;
    const centerY = bbox.originY + bbox.height / 2;
    debugInfo['Face Center (norm)'] = `(${centerX.toFixed(3)}, ${centerY.toFixed(3)})`;

    // 🆕 Phase 4: 物理座標を追加
    debugInfo['Eye Position (cm)'] = `(${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})`;

    // バウンディングボックスのサイズ
    debugInfo['BBox Size'] = `${(bbox.width * 100).toFixed(1)}% × ${(bbox.height * 100).toFixed(1)}%`;
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
    debugInfo['Eye Position (cm)'] = 'N/A';
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
    console.log('🚀 Phase 4: Initializing Coordinate Transform...');

    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    // Three.jsシーンを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();

    console.log('');
    console.log('🆕 Phase 4の新機能: 座標変換（MediaPipe → Three.js）');
    console.log('');
    console.log('📊 物理パラメータ:');
    console.log(`   - 画面サイズ: ${PHYSICAL_PARAMS.screenWidth} × ${PHYSICAL_PARAMS.screenHeight} cm`);
    console.log(`   - デフォルト視聴距離: ${PHYSICAL_PARAMS.viewingDistance} cm`);
    console.log(`   - スケール係数: ${PHYSICAL_PARAMS.scale}`);

    await initFaceDetector();

    toggleLoadingScreen(true, 'カメラアクセス中...');

    await initWebcam();
    initCanvas();

    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene + Webcam + Face Detection + Coordinate Transform ready!');
    }, 500);

    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - Three.jsシーン（回転するキューブ）');
    console.log('   - 画面右下のビデオプレビュー');
    console.log('   - ビデオ上に緑色のバウンディングボックス');
    console.log('   - 顔の中心に赤い十字マーク');
    console.log('   - 🆕 物理座標（cm単位）がシアン色で表示');
    console.log('   - 🆕 座標軸を示すマゼンタ（X軸）と黄色（Y軸）の矢印');
    console.log('   - 🆕 Info Panelに"Eye Position (cm)"が表示');
    console.log('');
    console.log('💡 座標変換の仕組み:');
    console.log('   1. MediaPipe正規化座標 [0,1] を取得');
    console.log('   2. 中心基準 [-1,1] に変換');
    console.log('   3. X軸ミラーリング（左右反転）');
    console.log('   4. Y軸反転（上下の向きを統一）');
    console.log('   5. 物理座標（cm単位）にスケーリング');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   ✅ 頭を左に動かす → eyeX が増加（正の値）');
    console.log('   ✅ 頭を右に動かす → eyeX が減少（負の値）');
    console.log('   ✅ 頭を上に動かす → eyeY が増加（正の値）');
    console.log('   ✅ 頭を下に動かす → eyeY が減少（負の値）');
    console.log('   ✅ 顔を近づける → eyeZ が減少（40cm付近）');
    console.log('   ✅ 顔を遠ざける → eyeZ が増加（80cm以上）');
    console.log('');
    console.log('📝 コンソールログ:');
    console.log('   - 2フレームに1回、物理座標が出力されます');
    console.log('   - 期待範囲: X±20cm, Y±15cm, Z 40-100cm');

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
 * 🎯 Challenge 1: スケール係数を変更
 * - PHYSICAL_PARAMS.scaleを変更してみよう
 * - 例: 1.0 (感度低), 3.0 (感度高)
 * - 頭の動きに対する座標変化の大きさを観察
 *
 * 🎯 Challenge 2: ミラーリングをON/OFF
 * - convertToPhysicalCoordinates関数でmirroredXの符号を変更
 * - mirroredX = centeredX (ミラーリングOFF)
 * - どちらが自然に感じるか比較しよう
 *
 * 🎯 Challenge 3: Y軸反転をON/OFF
 * - flippedYの符号を変更してみよう
 * - flippedY = centeredY (反転OFF)
 * - 頭を上に動かしたときの座標変化を確認
 *
 * 🎯 Challenge 4: 距離推定の改善
 * - estimateDistance関数のマジックナンバー0.05を調整
 * - 実際にメジャーで距離を測って精度を確認
 * - より正確な推定式を考えてみよう
 *
 * 🎯 Challenge 5: 座標範囲のクランプ
 * - eyeXとeyeYに範囲制限を追加
 * - 例: eyeX = Math.max(-20, Math.min(20, eyeX))
 * - 極端な値を防ぐ効果を確認
 *
 * 🎯 Challenge 6: グリッドの色を座標で変える
 * - eyeXの値に応じてグリッドの色を変更
 * - 例: gridHelper.material.color.setRGB(...)
 * - 座標変換が正しく動作しているか視覚的に確認
 *
 * 🎯 Challenge 7: 座標の移動平均
 * - eyeX, eyeY, eyeZに簡易的なスムージングを追加
 * - 例: eyeX = eyeX * 0.7 + newX * 0.3
 * - ジッター（ガタつき）の減少を観察
 *   （Phase 5で本格的なEMAを実装します）
 */
