/**
 * Phase 1: Three.js基本シーンセットアップ
 *
 * このフェーズで学ぶこと:
 * - Three.jsの基本的な構成要素(Scene, Camera, Renderer)
 * - グリッドと3Dオブジェクトの追加
 * - アニメーションループの実装
 * - ウィンドウリサイズへの対応
 *
 * 成功基準:
 * ✅ グリッド床の上で回転するキューブが表示される
 * ✅ 60fpsでスムーズにレンダリングされる
 * ✅ ウィンドウリサイズに対応する
 */

import * as THREE from 'three';

// =====================================
// フェーズ情報を更新
// =====================================
updatePhaseInfo('1', 'Three.js基本シーン');

// =====================================
// ブラウザ互換性チェック
// =====================================
if (!checkBrowserCompatibility()) {
  throw new Error('Browser not compatible');
}

// =====================================
// グローバル変数
// =====================================
let scene, camera, renderer;
let cube, cubeWireframe;
let gridHelper;
let animationId;

// アニメーション用の回転速度
const ROTATION_SPEED = 0.01;

// =====================================
// 初期化処理
// =====================================

/**
 * Three.jsシーンの初期化
 */
function initScene() {
  // --- Scene(シーン) ---
  // 3Dオブジェクトを配置する空間
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1e); // ダークネイビー背景

  console.log('✅ Scene created');
}

/**
 * カメラの初期化
 */
function initCamera() {
  // --- PerspectiveCamera(透視投影カメラ) ---
  // 引数: FOV, aspect ratio, near plane, far plane
  const fov = 50; // 視野角(度)
  const aspect = window.innerWidth / window.innerHeight; // アスペクト比
  const near = 0.1; // ニアクリップ面(これより近いものは描画されない)
  const far = 1000; // ファークリップ面(これより遠いものは描画されない)

  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

  // カメラを(0, 2, 10)の位置に配置
  // Y=2で少し上から、Z=10で手前に配置
  camera.position.set(0, 2, 10);

  // カメラを原点(0, 0, 0)に向ける
  camera.lookAt(0, 0, 0);

  console.log('✅ Camera initialized at position:', camera.position);
}

/**
 * レンダラーの初期化
 */
function initRenderer() {
  // --- WebGLRenderer ---
  // WebGLを使って3Dシーンをレンダリング
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('three-canvas'),
    antialias: true // アンチエイリアス有効化(滑らかな描画)
  });

  // レンダラーのサイズをウィンドウサイズに合わせる
  renderer.setSize(window.innerWidth, window.innerHeight);

  // デバイスのピクセル比を設定(Retinaディスプレイ対応)
  renderer.setPixelRatio(window.devicePixelRatio);

  console.log('✅ Renderer initialized');
}

/**
 * グリッド(床)の追加
 */
function addGrid() {
  // --- GridHelper ---
  // 引数: サイズ, 分割数, 中央線の色, グリッド線の色
  const size = 20;
  const divisions = 20;
  const colorCenterLine = 0xff8844; // オレンジ(中央線)
  const colorGrid = 0xdd6633; // 濃いオレンジ(グリッド線)

  gridHelper = new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);

  // グリッドをY=-2の位置に配置(カメラの少し下)
  gridHelper.position.y = -2;

  scene.add(gridHelper);

  console.log('✅ Grid added at Y =', gridHelper.position.y);
}

/**
 * 3Dオブジェクト(キューブ)の追加
 */
function addCube() {
  // --- Geometry(形状) ---
  // BoxGeometry: 直方体の形状
  // 引数: 幅, 高さ, 奥行き
  const geometry = new THREE.BoxGeometry(2, 2, 2);

  // --- Material(材質) ---
  // MeshStandardMaterial: 光の影響を受ける標準的なマテリアル
  const material = new THREE.MeshStandardMaterial({
    color: 0x4488ff, // 青色
    metalness: 0.3, // 金属感
    roughness: 0.4 // 粗さ
  });

  // --- Mesh(メッシュ) ---
  // Geometry + Material を組み合わせたオブジェクト
  cube = new THREE.Mesh(geometry, material);

  // キューブを原点より少し上(Y=0)に配置
  cube.position.set(0, 0, 0);

  scene.add(cube);

  // --- ワイヤーフレーム追加(エッジを見やすくする) ---
  const wireframeGeometry = new THREE.EdgesGeometry(geometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff, // 白色
    linewidth: 2
  });
  cubeWireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);

  // ワイヤーフレームをキューブの子として追加
  // (キューブと一緒に回転するように)
  cube.add(cubeWireframe);

  console.log('✅ Cube added with wireframe overlay');
}

/**
 * ライティングの追加
 */
function addLights() {
  // --- AmbientLight(環境光) ---
  // シーン全体を均等に照らす光
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  // --- DirectionalLight(平行光源) ---
  // 太陽光のような、特定方向からの平行な光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // --- PointLight(点光源) ---
  // 電球のような、特定位置から放射状に広がる光
  const pointLight = new THREE.PointLight(0xffffff, 1.5);
  pointLight.position.set(0, 5, 10);
  scene.add(pointLight);

  console.log('✅ Lights added (Ambient + Directional + Point)');
}

// =====================================
// アニメーションループ
// =====================================

/**
 * メインアニメーションループ
 * ブラウザのリフレッシュレートに同期して呼ばれる(通常60fps)
 */
function animate() {
  // 次のフレームでanimate関数を再度呼び出す
  animationId = requestAnimationFrame(animate);

  // --- キューブを回転させる ---
  // Y軸(縦軸)を中心に回転
  cube.rotation.y += ROTATION_SPEED;

  // X軸(横軸)も少し回転させて立体感を出す
  cube.rotation.x += ROTATION_SPEED * 0.5;

  // --- レンダリング実行 ---
  // シーンをカメラの視点でレンダリング
  renderer.render(scene, camera);

  // デバッグ情報を更新(任意)
  updateDebugInfo({
    'Camera Position': `(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`,
    'Cube Rotation Y': `${(cube.rotation.y % (Math.PI * 2)).toFixed(2)} rad`,
    'Objects in Scene': scene.children.length
  });
}

// =====================================
// ウィンドウリサイズ対応
// =====================================

/**
 * ウィンドウリサイズ時の処理
 */
function onWindowResize() {
  // カメラのアスペクト比を更新
  camera.aspect = window.innerWidth / window.innerHeight;

  // カメラの投影行列を更新(必須!)
  camera.updateProjectionMatrix();

  // レンダラーのサイズを更新
  renderer.setSize(window.innerWidth, window.innerHeight);

  console.log('📐 Window resized:', window.innerWidth, 'x', window.innerHeight);
}

// リサイズイベントリスナーを登録
window.addEventListener('resize', onWindowResize);

// =====================================
// クリーンアップ処理
// =====================================

/**
 * リソースの解放
 */
function dispose() {
  // アニメーションループを停止
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // ジオメトリとマテリアルを破棄
  if (cube) {
    cube.geometry.dispose();
    cube.material.dispose();
  }

  if (cubeWireframe) {
    cubeWireframe.geometry.dispose();
    cubeWireframe.material.dispose();
  }

  // レンダラーを破棄
  if (renderer) {
    renderer.dispose();
  }

  // イベントリスナーを削除
  window.removeEventListener('resize', onWindowResize);

  console.log('🧹 Resources cleaned up');
}

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', dispose);

// =====================================
// メイン実行
// =====================================

/**
 * アプリケーションのエントリーポイント
 */
async function main() {
  try {
    console.log('🚀 Phase 1: Initializing Three.js scene...');

    // ローディング画面を表示
    toggleLoadingScreen(true, 'Three.jsシーンを初期化中...');

    // 各コンポーネントを初期化
    initScene();
    initCamera();
    initRenderer();
    addGrid();
    addCube();
    addLights();

    // 少し待ってからローディング画面を非表示
    // (視覚的なフィードバックのため)
    setTimeout(() => {
      toggleLoadingScreen(false);
      console.log('✨ Scene ready!');
    }, 500);

    // アニメーションループを開始
    animate();

    console.log('🎬 Animation loop started');
    console.log('');
    console.log('👀 期待される表示:');
    console.log('   - オレンジ色のグリッド床');
    console.log('   - 青色のキューブ(白いワイヤーフレーム付き)');
    console.log('   - キューブがY軸とX軸で回転');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - ブラウザのコンソールでデバッグ情報を確認');
    console.log('   - ウィンドウをリサイズしてみてください');

  } catch (error) {
    console.error('❌ Initialization error:', error);
    showError('初期化エラー', error.message);
  }
}

// DOMContentLoaded後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// =====================================
// 学習チャレンジ(コメントアウト部分)
// =====================================

/*
 * 🎯 Challenge 1: キューブの色を変更
 * - cube作成時のmaterial.colorを別の色に変更してみよう
 * - 例: 0xff0000 (赤), 0x00ff00 (緑), 0xffff00 (黄色)
 *
 * 🎯 Challenge 2: 回転速度を調整
 * - ROTATION_SPEEDの値を変更して、回転を速く/遅くしてみよう
 * - 0.005 (遅い) ~ 0.03 (速い)
 *
 * 🎯 Challenge 3: カメラ位置を変更
 * - camera.position.set()の値を変えて、別の角度から見てみよう
 * - 例: (5, 5, 5) - 斜め上から
 *       (0, 10, 0) - 真上から
 *       (15, 2, 0) - 横から
 *
 * 🎯 Challenge 4: 複数のキューブを追加
 * - addCube()関数を参考に、2個目、3個目のキューブを追加
 * - position.set()で異なる位置に配置しよう
 *
 * 🎯 Challenge 5: 別のジオメトリを試す
 * - BoxGeometry以外のジオメトリを試してみよう:
 *   - new THREE.SphereGeometry(1, 32, 32) - 球
 *   - new THREE.ConeGeometry(1, 2, 32) - 円錐
 *   - new THREE.TorusGeometry(1, 0.4, 16, 100) - トーラス(ドーナツ型)
 */
