/**
 * Phase 2: Webカメラアクセス
 *
 * このフェーズで学ぶこと:
 * - getUserMedia APIを使ったカメラアクセス
 * - ビデオストリームの表示とミラーリング
 * - カメラ許可エラーのハンドリング
 * - Phase 1のThree.jsシーンとの統合
 *
 * 成功基準:
 * ✅ 画面右下にミラーリングされたWebカメラプレビューが表示される
 * ✅ カメラアクセスエラー時に適切なメッセージ表示
 * ✅ Phase 1のキューブアニメーションが継続する
 */

import * as THREE from 'three';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('2', 'Webカメラアクセス + Three.jsシーン');

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

// 設定
const ROTATION_SPEED = 0.01;
const VIDEO_CONFIG = {
  width: 640,
  height: 480,
  frameRate: 30
};

// =====================================
// Three.jsシーン初期化(Phase 1と同じ)
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
// Webカメラアクセス(新規)
// =====================================

/**
 * Webカメラを初期化してビデオストリームを開始
 * @returns {Promise<MediaStream>} ビデオストリーム
 */
async function initWebcam() {
  console.log('📹 Requesting camera access...');

  try {
    // getUserMedia APIでカメラアクセスをリクエスト
    // constraintsでビデオの解像度やフレームレートを指定
    const constraints = {
      video: {
        width: { ideal: VIDEO_CONFIG.width },
        height: { ideal: VIDEO_CONFIG.height },
        frameRate: { ideal: VIDEO_CONFIG.frameRate },
        facingMode: 'user' // フロントカメラを使用(スマホ対応)
      },
      audio: false // 音声は不要
    };

    // カメラストリームを取得
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);

    // video要素を取得
    videoElement = document.getElementById('video');

    // video要素にストリームを設定
    videoElement.srcObject = videoStream;

    // ビデオメタデータ読み込み完了を待つ
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        console.log('✅ Video metadata loaded');
        console.log(`   Resolution: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        resolve();
      };
    });

    // ビデオ再生を開始
    await videoElement.play();

    // ビデオプレビューを表示(utils.jsの関数を使用)
    toggleVideoPreview(true);

    console.log('✅ Webcam initialized and playing');
    console.log(`   Stream settings:`, videoStream.getVideoTracks()[0].getSettings());

    return videoStream;

  } catch (error) {
    console.error('❌ Camera access error:', error);

    // エラータイプに応じて適切なメッセージを表示
    // (utils.jsのhandleCameraError関数を使用)
    handleCameraError(error);

    throw error;
  }
}

/**
 * カメラストリームを停止
 */
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
// アニメーションループ
// =====================================

function animate() {
  animationId = requestAnimationFrame(animate);

  // キューブを回転
  cube.rotation.y += ROTATION_SPEED;
  cube.rotation.x += ROTATION_SPEED * 0.5;

  // レンダリング
  renderer.render(scene, camera);

  // デバッグ情報を更新
  const debugInfo = {
    'Camera Position': `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`,
    'Cube Rotation Y': `${(cube.rotation.y % (Math.PI * 2)).toFixed(2)} rad`,
    'Objects in Scene': scene.children.length
  };

  // Webカメラの情報も追加
  if (videoElement && videoElement.readyState >= 2) {
    debugInfo['Video Status'] = '📹 Active';
    debugInfo['Video Resolution'] = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
  } else {
    debugInfo['Video Status'] = '⏸️ Not ready';
  }

  updateDebugInfo(debugInfo);
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
    console.log('🚀 Phase 2: Initializing Three.js scene + Webcam...');

    toggleLoadingScreen(true, 'カメラアクセスを要求中...');

    // Three.jsシーンを初期化(Phase 1と同じ)
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();

    console.log('');
    console.log('📹 Phase 2の新機能: Webカメラアクセス');

    // Webカメラを初期化(新機能!)
    await initWebcam();

    // ローディング画面を非表示
    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene + Webcam ready!');
    }, 500);

    // アニメーションループを開始
    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - Phase 1と同じThree.jsシーン(回転するキューブ)');
    console.log('   - 画面右下にミラーリングされたWebカメラプレビュー');
    console.log('   - 左上のInfo Panelに"Video Status: 📹 Active"と表示');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - カメラアクセスを許可してください');
    console.log('   - ビデオはCSSで左右反転(mirror)されています');
    console.log('   - コンソールでビデオ解像度を確認できます');

  } catch (error) {
    console.error('❌ Initialization error:', error);

    // カメラエラー以外のエラーはここで表示
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
 * 🎯 Challenge 1: ビデオ解像度を変更
 * - VIDEO_CONFIGのwidthとheightを変更してみよう
 * - 例: 1280x720 (HD), 320x240 (低解像度)
 * - 解像度とパフォーマンスのトレードオフを観察しよう
 *
 * 🎯 Challenge 2: ビデオプレビューの位置を変更
 * - assets/base.cssの#video{}スタイルを変更してみよう
 * - 例: 左下(left: 20px, bottom: 20px)
 *       上部中央(top: 20px, left: 50%, transform: translateX(-50%))
 *
 * 🎯 Challenge 3: ビデオのミラーリングを解除
 * - assets/base.cssの#videoから `transform: scaleX(-1);` を削除
 * - ミラーリングあり/なしでの使い心地を比較しよう
 *
 * 🎯 Challenge 4: カメラ切り替え(スマホ向け)
 * - constraintsのfacingModeを変更してみよう
 *   - 'user': フロントカメラ
 *   - 'environment': バックカメラ
 *
 * 🎯 Challenge 5: ビデオにフィルターをかける
 * - CSSフィルターを追加してみよう(base.cssに追加)
 *   例: filter: grayscale(100%); (グレースケール)
 *       filter: sepia(100%); (セピア調)
 *       filter: blur(5px); (ぼかし)
 *
 * 🎯 Challenge 6: エラーハンドリングをテスト
 * - カメラアクセスを拒否してエラーメッセージを確認
 * - 他のアプリでカメラを使用中にアクセスしてみる
 * - utils.jsのhandleCameraError関数の動作を確認
 */
