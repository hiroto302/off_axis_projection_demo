/**
 * Phase 3: MediaPipe顔検出
 *
 * このフェーズで学ぶこと:
 * - MediaPipe Face Detection モデルの読み込みと初期化
 * - ビデオフレームからのリアルタイム顔検出(30fps)
 * - 正規化座標 [0,1] の取得と可視化
 * - バウンディングボックスと信頼度スコアの表示
 *
 * 成功基準:
 * ✅ リアルタイムで顔が検出される
 * ✅ ビデオオーバーレイにバウンディングボックスが表示される
 * ✅ 信頼度スコアが表示される
 * ✅ 複数顔検出時は最初の顔のみ使用
 */

import * as THREE from 'three';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('3', 'MediaPipe顔検出 + Webカメラ + Three.js');

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

// =====================================
// Three.jsシーン初期化(Phase 2と同じ)
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
// Webカメラアクセス(Phase 2と同じ)
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
// キャンバスオーバーレイ初期化(新規)
// =====================================

/**
 * ビデオの上に描画するキャンバスを初期化
 * 顔検出結果(バウンディングボックスなど)を描画するために使用
 */
function initCanvas() {
  canvasElement = document.getElementById('overlay-canvas');
  canvasCtx = canvasElement.getContext('2d');

  // キャンバスのサイズをビデオと同じにする
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  // キャンバスを表示
  canvasElement.classList.add('visible');

  console.log('✅ Canvas overlay initialized');
  console.log(`   Canvas size: ${canvasElement.width}x${canvasElement.height}`);
}

// =====================================
// MediaPipe Face Detection初期化(新規)
// =====================================

/**
 * MediaPipe Face Detectorを初期化
 * @returns {Promise<FaceDetector>} 初期化されたFace Detector
 */
async function initFaceDetector() {
  console.log('🤖 Initializing MediaPipe Face Detector...');

  try {
    // MediaPipe Visionタスクのwasmファイルをロード
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    console.log('   Vision tasks loaded');

    // Face Detectorを作成
    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_CONFIG.modelAssetPath,
        delegate: 'GPU' // GPU加速を有効化(パフォーマンス向上)
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
// 顔検出処理(新規)
// =====================================

/**
 * ビデオフレームから顔を検出
 * 30fpsで実行されるように調整(2フレームに1回)
 */
function detectFaces() {
  // ビデオが準備できていない場合はスキップ
  if (!videoElement || videoElement.readyState < 2) {
    return;
  }

  // 前回の検出から十分な時間が経過していない場合はスキップ
  const now = performance.now();
  if (now - lastDetectionTime < DETECTION_INTERVAL_MS) {
    return;
  }

  lastDetectionTime = now;

  // MediaPipe Face Detectorで顔を検出
  const detections = faceDetector.detectForVideo(videoElement, now);

  // キャンバスをクリア
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // 検出結果を描画
  drawDetections(detections);

  // デバッグ情報を更新
  updateDetectionInfo(detections);
}

/**
 * 顔検出結果をキャンバスに描画
 * @param {Object} detections - MediaPipeの検出結果
 */
function drawDetections(detections) {
  if (!detections || !detections.detections || detections.detections.length === 0) {
    return;
  }

  // 複数顔検出時は最初の顔のみ使用
  const detection = detections.detections[0];

  // バウンディングボックスの座標を取得
  // MediaPipe Tasks Vision APIのboundingBoxは既にピクセル座標
  const bbox = detection.boundingBox;

  // そのまま使用（既にピクセル座標）
  const x = bbox.originX;
  const y = bbox.originY;
  const width = bbox.width;
  const height = bbox.height;

  // 顔の中心座標を計算
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // バウンディングボックスを描画
  canvasCtx.strokeStyle = '#00ff00'; // 緑色
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeRect(x, y, width, height);

  // 顔の中心に十字マークを描画
  canvasCtx.strokeStyle = '#ff0000'; // 赤色
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

  // 正規化座標を表示(デバッグ用)
  // ピクセル座標から正規化座標 [0, 1] に変換
  canvasCtx.fillStyle = '#ffff00'; // 黄色
  canvasCtx.font = '12px monospace';
  const normalizedX = centerX / canvasElement.width;
  const normalizedY = centerY / canvasElement.height;
  canvasCtx.fillText(
    `Norm: (${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)})`,
    x,
    y + height + 15
  );
}

/**
 * デバッグ情報パネルを更新
 * @param {Object} detections - MediaPipeの検出結果
 */
function updateDetectionInfo(detections) {
  const debugInfo = {
    'Camera Position': `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`,
    'Objects in Scene': scene.children.length
  };

  // ビデオ情報
  if (videoElement && videoElement.readyState >= 2) {
    debugInfo['Video Status'] = '📹 Active';
    debugInfo['Video Resolution'] = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
  }

  // 顔検出情報(新規!)
  if (detections && detections.detections && detections.detections.length > 0) {
    const detection = detections.detections[0];
    const bbox = detection.boundingBox;

    debugInfo['Faces Detected'] = `✅ ${detections.detections.length}`;
    debugInfo['Confidence'] = `${(detection.categories[0].score * 100).toFixed(1)}%`;

    // 顔の中心座標(正規化座標)
    const centerX = bbox.originX + bbox.width / 2;
    const centerY = bbox.originY + bbox.height / 2;
    debugInfo['Face Center (norm)'] = `(${centerX.toFixed(3)}, ${centerY.toFixed(3)})`;

    // バウンディングボックスのサイズ
    debugInfo['BBox Size'] = `${(bbox.width * 100).toFixed(1)}% × ${(bbox.height * 100).toFixed(1)}%`;
  } else {
    debugInfo['Faces Detected'] = '❌ 0';
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

  // 顔検出を実行(30fps)
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
  // アニメーションループを停止
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // Webカメラを停止
  stopWebcam();

  // Face Detectorをクローズ
  if (faceDetector) {
    faceDetector.close();
    console.log('🛑 Face Detector closed');
  }

  // Three.jsリソースを破棄
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
    console.log('🚀 Phase 3: Initializing MediaPipe Face Detection...');

    toggleLoadingScreen(true, 'MediaPipeモデル読み込み中...');

    // Three.jsシーンを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();

    console.log('');
    console.log('🤖 Phase 3の新機能: MediaPipe顔検出');

    // MediaPipe Face Detectorを初期化(新機能!)
    await initFaceDetector();

    toggleLoadingScreen(true, 'カメラアクセス中...');

    // Webカメラを初期化
    await initWebcam();

    // キャンバスオーバーレイを初期化(新機能!)
    initCanvas();

    // ローディング画面を非表示
    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene + Webcam + Face Detection ready!');
    }, 500);

    // アニメーションループを開始
    animate();

    console.log('🎬 Animation loop started (with face detection @ 30fps)');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - Three.jsシーン(回転するキューブ)');
    console.log('   - 画面右下のビデオプレビュー');
    console.log('   - ビデオ上に緑色のバウンディングボックス');
    console.log('   - 顔の中心に赤い十字マーク');
    console.log('   - 信頼度スコア(%)の表示');
    console.log('   - 左上のInfo Panelに"Faces Detected: ✅ 1"と表示');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - カメラに顔を向けてください');
    console.log('   - 正規化座標は [0, 1] の範囲で出力されます');
    console.log('   - 複数人が映っても最初の顔のみ追跡します');
    console.log('   - 信頼度が50%未満の検出は無視されます');
    console.log('');
    console.log('🧪 試してみよう:');
    console.log('   - 頭を左右に動かして正規化座標の変化を観察');
    console.log('   - 顔を近づける/遠ざけてバウンディングボックスのサイズ変化を確認');
    console.log('   - 横を向いたり照明を変えて信頼度スコアの変化を見る');

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
 * 🎯 Challenge 1: 信頼度しきい値を変更
 * - MEDIAPIPE_CONFIG.minDetectionConfidenceを変更してみよう
 * - 例: 0.3 (検出しやすくなる), 0.7 (厳しくなる)
 * - どのように検出結果が変わるか観察しよう
 *
 * 🎯 Challenge 2: バウンディングボックスのスタイル変更
 * - drawDetections関数の色や線の太さを変更してみよう
 * - 例: strokeStyle = '#ff00ff' (紫色)
 *       lineWidth = 5 (太い線)
 *
 * 🎯 Challenge 3: 検出頻度を変更
 * - DETECTION_INTERVAL_MSを変更してみよう
 * - 例: 16 (60fps), 66 (15fps)
 * - パフォーマンスと応答性のトレードオフを観察
 *
 * 🎯 Challenge 4: 複数顔の検出を表示
 * - drawDetections関数を修正して全ての検出結果を描画
 * - ヒント: detections.detections.forEach() を使用
 * - 複数人で試してみよう
 *
 * 🎯 Challenge 5: 顔の位置でキューブの色を変える
 * - 顔が左側 → 青、右側 → 赤、中央 → 緑
 * - ヒント: 正規化座標のX値で判定
 * - cube.material.color.setHex() を使用
 *
 * 🎯 Challenge 6: 顔のサイズを計測
 * - バウンディングボックスの面積から顔までの距離を推定
 * - ヒント: 近づくとbbox.width * bbox.heightが大きくなる
 * - コンソールに距離の推定値を表示してみよう
 */
