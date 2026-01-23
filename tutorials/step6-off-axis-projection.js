/**
 * Phase 6: Off-Axis Projection
 *
 * このフェーズで学ぶこと:
 * - 非対称視錐台(frustum)の計算方法
 * - カスタム投影行列の構築（makePerspective）
 * - カメラ位置と視線方向の動的更新
 * - 真のOff-Axis Projection実装
 *
 * 視覚効果（窓から覗き込む効果）:
 * - 頭を左に動かす → シーンの右側が見える（窓から右を覗く）
 * - 頭を右に動かす → シーンの左側が見える（窓から左を覗く）
 * - 頭を上に動かす → シーンの下側が見える（窓から下を覗く）
 * - 頭を下に動かす → シーンの上側が見える（窓から上を覗く）
 * - 近づく → パースペクティブが誇張され、視野が狭くなる
 * - 遠ざかる → より広い範囲が見える
 *
 * 成功基準:
 * ✅ グリッドが画面の「奥」に存在し、頭の動きで「回り込んで」見える
 * ✅ キューブが頭の動きに応じて異なる面が見える
 * ✅ 視差効果が顕著に確認できる（画像例を参照）
 * ✅ 中心位置で歪みがなく自然に見える
 */

import * as THREE from 'three';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('6', 'Off-Axis Projection: 非対称視錐台による3D視差');

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

// 🆕 Phase 6: 顔検出状態の管理
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

// MediaPipe設定
const MEDIAPIPE_CONFIG = {
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  runningMode: 'VIDEO',
  minDetectionConfidence: 0.5,
  minSuppressionThreshold: 0.5
};

// 顔検出の頻度(2フレームに1回 = 30fps)
const DETECTION_INTERVAL_MS = 33; // 約30fps

// 物理パラメータ（調整済み）
const PHYSICAL_PARAMS = {
  screenWidth: 16.59,     // 画面の物理幅（cm）FOV=50°相当
  screenHeight: 9.33,     // 画面の物理高さ（cm）FOV=50°相当
  viewingDistance: 10,    // デフォルト視聴距離（cm）※カメラZ=10に対応
  cameraY: 2,             // カメラのY位置オフセット（cm）
  scale: 1.0              // 座標スケール（感度調整）※近距離なので控えめに
};

// スムージングパラメータ
const SMOOTHING_PARAMS = {
  alphaX: 0.1,   // X軸のスムージング係数
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

  // 🆕 Phase 6: デフォルト視点でOff-Axis Projectionを初期化
  // カメラ位置と投影行列は applyOffAxisProjection() で設定される
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
  gridHelper.position.y = -2; // Phase 5と同じ位置に配置
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
  cube.position.set(0, 0, 0); // Phase 5と同じ位置に配置
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
// 🆕 Phase 6: Off-Axis Projection実装
// =====================================

/**
 * Off-Axis Projectionを適用
 *
 * 真のOff-Axis Projection実装:
 * - カメラの投影行列を直接計算して非対称視錐台を構築
 * - カメラ位置を目の位置に配置
 * - 視線方向を画面平面上の対応点に向ける
 *
 * これにより、ディスプレイが3D空間への「窓」のように見える効果を実現する。
 * 頭を左に動かす → シーンの右側が見える（窓から右を覗き込む）
 * 頭を右に動かす → シーンの左側が見える（窓から左を覗き込む）
 *
 * 理論:
 * - 画面を3D空間の「窓」として扱う
 * - ユーザーの目の位置から窓を通して見える視錐台を計算
 * - 視錐台の左右上下の境界は、目の位置に依存して変化する
 *
 * @param {number} eyeX - 目の物理X座標（cm、画面中心を0とする）
 * @param {number} eyeY - 目の物理Y座標（cm、画面中心を0とする）
 * @param {number} eyeZ - 目の物理Z座標（cm、視聴距離）
 */
function applyOffAxisProjection(eyeX, eyeY, eyeZ) {
  // 画面の物理サイズ（cm単位）
  const halfWidth = PHYSICAL_PARAMS.screenWidth / 2;
  const halfHeight = PHYSICAL_PARAMS.screenHeight / 2;

  // 画面の境界（画面平面はZ=0に配置）
  const left = -halfWidth;
  const right = halfWidth;
  const bottom = -halfHeight;
  const top = halfHeight;

  // Near/Far clipping planes
  const near = 0.1;
  const far = 1000;

  // 目の位置から見た視錐台を計算
  // 視錐台の境界は、目の位置から画面の端までの角度によって決まる
  // near平面での視錐台の大きさ = (画面の境界 - 目の位置) * (near / 目の距離)
  const frustumLeft = (left - eyeX) * near / eyeZ;
  const frustumRight = (right - eyeX) * near / eyeZ;
  const frustumBottom = (bottom - eyeY) * near / eyeZ;
  const frustumTop = (top - eyeY) * near / eyeZ;

  // カメラの投影行列を直接設定（非対称視錐台）
  camera.projectionMatrix.makePerspective(
    frustumLeft, frustumRight,
    frustumTop, frustumBottom,
    near, far
  );

  // 投影行列の逆行列も更新
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  // カメラ位置を目の位置に配置（Three.jsの座標系）
  // 1 Three.js単位 = 1cm
  camera.position.set(eyeX, eyeY, eyeZ);

  // カメラを画面平面上の対応点に向ける
  // これにより、目の位置から画面を通して正しく見える
  camera.lookAt(eyeX, eyeY, 0);

  // デバッグ情報（10%の確率で出力）
  if (Math.random() < 0.1) {
    console.log(`🎥 Off-Axis Projection:`);
    console.log(`   Eye Position: (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)}) cm`);
    console.log(`   Camera Position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
    console.log(`   Frustum: L=${frustumLeft.toFixed(2)}, R=${frustumRight.toFixed(2)}, B=${frustumBottom.toFixed(2)}, T=${frustumTop.toFixed(2)}`);
  }
}

/**
 * 🆕 Phase 6: デフォルト視点へ戻る
 *
 * 顔が検出されなくなった場合、スムーズにデフォルト視点に戻る。
 * アニメーションは `applyEMA` を利用して自然な動きを実現。
 */
function returnToDefaultView() {
  const defaultX = 0;
  const defaultY = PHYSICAL_PARAMS.cameraY;
  const defaultZ = PHYSICAL_PARAMS.viewingDistance;

  // デフォルト位置に向かってスムージング
  smoothedX = applyEMA(defaultX, smoothedX, 0.05); // ゆっくり戻る
  smoothedY = applyEMA(defaultY, smoothedY, 0.05);
  smoothedZ = applyEMA(defaultZ, smoothedZ, 0.05);

  eyeX = smoothedX;
  eyeY = smoothedY;
  eyeZ = smoothedZ;

  applyOffAxisProjection(eyeX, eyeY, eyeZ);

  // ほぼデフォルト位置に戻ったか確認
  const isNearDefault =
    Math.abs(smoothedX - defaultX) < 0.1 &&
    Math.abs(smoothedY - defaultY) < 0.1 &&
    Math.abs(smoothedZ - defaultZ) < 0.5;

  if (isNearDefault && Math.random() < 0.1) {
    console.log('🏠 Returned to default view');
  }
}

// =====================================
// 顔検出処理（Off-Axis Projectionを追加）
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
    faceDetected = true;
    lastFaceDetectionTime = now;

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

    // スムージングを適用
    smoothCoordinates(rawX, rawY, rawZ);

    // スムージング後の座標を使用
    eyeX = smoothedX;
    eyeY = smoothedY;
    eyeZ = smoothedZ;

    // 🆕 Phase 6: Off-Axis Projectionを適用
    applyOffAxisProjection(eyeX, eyeY, eyeZ);

    // 50%の確率でコンソールに出力
    if (Math.random() < 0.5) {
      console.log(`👁️ Eye Position: X=${eyeX.toFixed(1)}cm, Y=${eyeY.toFixed(1)}cm, Z=${eyeZ.toFixed(1)}cm`);
    }
  } else {
    // 🆕 Phase 6: 顔未検出の処理
    faceDetected = false;

    // 2秒間顔が検出されていない場合、デフォルト視点に戻る
    if (now - lastFaceDetectionTime > FACE_LOST_TIMEOUT) {
      returnToDefaultView();
    }
  }

  updateDetectionInfo(detections);
}

// =====================================
// 描画処理
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

  // スムージング後の座標を表示
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
    debugInfo['Eye Position (cm)'] = `(${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})`;

    // 🆕 Phase 6: Off-Axis Projection情報
    debugInfo['Off-Axis Active'] = '✅ Yes';
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
    debugInfo['Eye Position (cm)'] = 'N/A';
    debugInfo['Off-Axis Active'] = '❌ No (Returning to default)';
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
  // アスペクト比を更新
  camera.aspect = window.innerWidth / window.innerHeight;

  // レンダラーのサイズを更新
  renderer.setSize(window.innerWidth, window.innerHeight);

  // 🆕 Phase 6: リサイズ後もOff-Axis Projectionを再適用
  // 投影行列はapplyOffAxisProjection()で再計算されるため、
  // updateProjectionMatrix()は呼ばない
  if (faceDetected) {
    applyOffAxisProjection(eyeX, eyeY, eyeZ);
  } else {
    // 顔が検出されていない場合はデフォルト投影を再適用
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
    console.log('🚀 Phase 6: Initializing Off-Axis Projection...');

    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    // Three.jsシーンを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();

    console.log('');
    console.log('🆕 Phase 6の新機能: Off-Axis Projection（非対称視錐台）');
    console.log('');
    console.log('⚙️ カメラ設定:');
    console.log(`   - 初期位置: (0, ${PHYSICAL_PARAMS.cameraY}, ${PHYSICAL_PARAMS.viewingDistance}) cm`);
    console.log(`   - 画面サイズ: ${PHYSICAL_PARAMS.screenWidth} x ${PHYSICAL_PARAMS.screenHeight} cm`);
    console.log(`   - 感度スケール: ${PHYSICAL_PARAMS.scale}`);
    console.log('');
    console.log('📊 Off-Axis Projection原理:');
    console.log('   - 投影行列を直接計算して非対称な視錐台を構築');
    console.log('   - カメラ位置を目の位置に配置');
    console.log('   - 視線方向を画面平面上の対応点に向ける');
    console.log('   - 画面が3D空間への「窓」として機能');
    console.log('');
    console.log('🎯 期待される視覚効果:');
    console.log('   - 頭を左に動かす → シーンの右側が見える（窓から右を覗き込む）');
    console.log('   - 頭を右に動かす → シーンの左側が見える（窓から左を覗き込む）');
    console.log('   - 頭を上に動かす → シーンの下側が見える（窓から下を覗き込む）');
    console.log('   - 頭を下に動かす → シーンの上側が見える（窓から上を覗き込む）');
    console.log('   - 近づく → パースペクティブが誇張され、より狭い範囲が見える');
    console.log('   - 遠ざかる → より広い範囲が見える');

    await initFaceDetector();

    toggleLoadingScreen(true, 'カメラアクセス中...');

    await initWebcam();
    initCanvas();

    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene + Webcam + Face Detection + Off-Axis Projection ready!');
    }, 500);

    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - Three.jsシーン（回転するキューブとグリッド）');
    console.log('   - 画面右下のビデオプレビュー');
    console.log('   - ビデオ上に緑色のバウンディングボックス');
    console.log('   - 🆕 頭の動きに応じてシーンの視点が変化');
    console.log('   - 🆕 グリッドが画面の「奥」に存在するように見える');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   ✅ 頭を左右に動かす → グリッド/キューブの見える角度が変化');
    console.log('   ✅ 頭を上下に動かす → グリッドの上下部分がより見える');
    console.log('   ✅ カメラに近づく → パースペクティブが強調される');
    console.log('   ✅ 顔を隠す → 2秒後にデフォルト視点に戻る（スムーズ）');
    console.log('');
    console.log('💡 視差効果の確認ポイント:');
    console.log('   - キューブの側面が頭の動きで見えるようになる');
    console.log('   - グリッド線が「奥行き」を持って見える');
    console.log('   - 画面が3D空間の一部を切り取った「窓」のように感じる');

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
 * 🎯 Challenge 1: 視差効果を体感
 * - 頭を左右に動かしてキューブの異なる面が見えることを確認
 * - グリッドが「画面の奥」に存在し、「窓から覗き込む」ように見えるか確認
 * - 提供された画像例（ex0, ex1, ex2）と同じ効果が再現できているか比較
 *
 * 🎯 Challenge 2: パラメータ調整
 * - PHYSICAL_PARAMS.scale を変更（0.5 ~ 5.0）
 * - scale=0.5: 頭を大きく動かしても視点変化が小さい（控えめな効果）
 * - scale=5.0: わずかな頭の動きで大きく視点が変化（過剰な効果）
 * - 最適なscale値を見つける
 *
 * 🎯 Challenge 3: 視聴距離の影響
 * - カメラに近づく/遠ざかるで視差効果がどう変化するか観察
 * - 近い距離（30cm）: 視差効果が非常に強く、パースペクティブが誇張される
 * - 遠い距離（100cm）: 視差効果が弱まり、ほぼ通常の視点に近づく
 * - estimateDistance()の計算式（k値）を調整してみる
 *
 * 🎯 Challenge 4: デフォルト復帰時間の調整
 * - FACE_LOST_TIMEOUT を変更（500ms ~ 5000ms）
 * - 500ms: 顔が一瞬隠れるだけで即座にリセット（敏感すぎる）
 * - 5000ms: 長時間顔が隠れてもリセットされない（鈍感すぎる）
 * - 最も自然に感じる時間を見つける
 *
 * 🎯 Challenge 5: 視錐台の可視化（高度）
 * - CameraHelperを追加してカメラの視錐台を可視化
 * - 注意: Off-Axis Projectionでは視錐台が非対称なので、
 *   CameraHelperの表示も非対称になる
 * - 実装例:
 *   ```javascript
 *   const helper = new THREE.CameraHelper(camera);
 *   scene.add(helper);
 *   // animate()内で更新
 *   helper.update();
 *   ```
 *
 * 🎯 Challenge 6: 複数オブジェクトで視差確認
 * - Z軸方向に異なる距離の複数のキューブを配置
 * - 例: Z = -10, 0, 10, 20, 30 にキューブを配置
 * - 頭を動かした時、近いオブジェクトほど視差が大きいことを確認
 * - これは現実世界の視差と同じ原理
 *
 * 🎯 Challenge 7: 手動モードの追加
 * - キーボード入力で視点位置を手動調整
 * - ArrowキーでeyeX, eyeYを変更し、視差効果をゆっくり確認
 * - 実装例:
 *   ```javascript
 *   window.addEventListener('keydown', (e) => {
 *     const step = 1; // 1cm刻み
 *     if (e.key === 'ArrowLeft') eyeX -= step;
 *     if (e.key === 'ArrowRight') eyeX += step;
 *     if (e.key === 'ArrowUp') eyeY += step;
 *     if (e.key === 'ArrowDown') eyeY -= step;
 *     applyOffAxisProjection(eyeX, eyeY, eyeZ);
 *   });
 *   ```
 *
 * 🎯 Challenge 8: リアルタイム視錐台調整（高度）
 * - lil-guiで画面サイズ、視聴距離、near/farを調整可能にする
 * - 投影行列のパラメータ変更が視差効果に与える影響を確認
 * - 特に、画面サイズの変更は視錐台の形状に直接影響する
 *
 * 🎯 Challenge 9: 比較モード（setViewOffsetとの違い）
 * - ボタンで元のsetViewOffset実装と新しいmakePerspective実装を切り替え
 * - 両方の実装の視覚的な違いを比較
 * - 真のOff-Axis Projectionの優位性を体感
 */
