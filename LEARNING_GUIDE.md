# Off-Axis Projection デモ 学習ガイド

## はじめに

このプロジェクトは、**カメラで顔をトラッキング**し、その位置に応じて**3D空間の見え方を変える**技術デモです。ディスプレイが「3D空間への窓」のように見える体験を実現しています。

このガイドでは、特に以下の2つの核心的な技術について詳しく解説します：

1. **MediaPipe Face Detection** - どうやって顔の位置を検出するのか
2. **Off-Axis Projection** - どうやって立体的に見せるのか

---

## 目次

1. [プロジェクトの全体像](#1-プロジェクトの全体像)
2. [MediaPipe Face Detection の仕組み](#2-mediapipe-face-detection-の仕組み)
3. [Off-Axis Projection の仕組み](#3-off-axis-projection-の仕組み)
4. [座標変換の詳細](#4-座標変換の詳細)
5. [スムージング処理](#5-スムージング処理)
6. [実装を読み解く](#6-実装を読み解く)
7. [応用アイデア](#7-応用アイデア)

---

## 1. プロジェクトの全体像

### 処理の流れ

```
┌─────────────────┐
│  Webカメラ起動  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ MediaPipe Face Detection│ ← 【重要1】顔の位置を検出
│  (30fps で処理)         │
└────────┬────────────────┘
         │
         │ 検出結果（顔の座標）
         ▼
┌─────────────────────────┐
│  座標変換 & スムージング  │
│  (MediaPipe → Three.js) │
└────────┬────────────────┘
         │
         │ 変換後の座標
         ▼
┌─────────────────────────┐
│  Off-Axis Projection    │ ← 【重要2】カメラ視点を調整
│  (setViewOffset)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│  Three.js描画   │
│  (60fps)        │
└─────────────────┘
```

### なぜ立体的に見えるのか？

人間の目は**左右に離れて**います。この視差によって立体感を感じます。
このプロジェクトでは、**顔の位置を検出**することで、ユーザーがディスプレイのどこから見ているかを把握し、その視点に合わせて3D空間を描画します。

**例えば：**
- 顔を左に動かす → 3Dオブジェクトの右側が見える
- 顔を上に動かす → 3Dオブジェクトの下側が見える
- 顔を近づける → 視野が広がる

これによって、**ディスプレイが窓のように**見えるのです。

---

## 2. MediaPipe Face Detection の仕組み

### MediaPipe とは？

**MediaPipe** は Google が開発した機械学習ベースの視覚認識ライブラリです。
顔検出、手の認識、ポーズ推定など、様々な機能を**ブラウザ上で**リアルタイムに実行できます。

### このプロジェクトでの使い方

#### 2.1 初期化

```javascript
// faceDetector.js より抜粋

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// WebAssembly版のモデルを読み込む
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
);

// Face Detectorを作成
const faceDetector = await FaceDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/blaze_face_short_range.tflite',
    delegate: 'GPU' // GPU使用で高速化
  },
  runningMode: 'VIDEO', // ビデオストリーム用
  minDetectionConfidence: 0.5, // 検出の信頼度閾値
  minSuppressionThreshold: 0.3  // 重複検出の抑制
});
```

**重要なポイント：**

- **`runningMode: 'VIDEO'`**: 連続したフレームを処理する設定（静止画用の`IMAGE`モードもある）
- **`minDetectionConfidence: 0.5`**: 50%以上の信頼度で検出されたもののみ採用
- **`blaze_face_short_range.tflite`**: 近距離用の軽量モデル（デスクトップ使用を想定）

#### 2.2 顔の検出

```javascript
// ビデオフレームから顔を検出
const detections = faceDetector.detectForVideo(videoElement, performance.now());

if (detections.detections.length > 0) {
  const face = detections.detections[0]; // 最初に検出された顔を使う

  // バウンディングボックス（顔を囲む矩形）
  const box = face.boundingBox;

  // 顔の中心座標を計算
  const centerX = box.originX + box.width / 2;
  const centerY = box.originY + box.height / 2;

  console.log(`顔の位置: (${centerX}, ${centerY})`);
}
```

**検出結果の構造：**

```javascript
{
  detections: [
    {
      boundingBox: {
        originX: 0.3,   // 左上のX座標（正規化: 0-1）
        originY: 0.2,   // 左上のY座標（正規化: 0-1）
        width: 0.2,     // 幅（正規化: 0-1）
        height: 0.3     // 高さ（正規化: 0-1）
      },
      categories: [
        {
          score: 0.95,  // 信頼度スコア
          categoryName: 'face'
        }
      ],
      keypoints: [...]  // 顔のランドマーク（今回は未使用）
    }
  ]
}
```

**重要：座標は正規化されている**

MediaPipeの座標は **0.0 〜 1.0** の範囲で正規化されています。
- `originX: 0.5` → 画面の中央（横方向）
- `originY: 0.0` → 画面の一番上
- `originX: 1.0` → 画面の右端

#### 2.3 パフォーマンス最適化

```javascript
// main.js より

let frameCount = 0;

function animate() {
  frameCount++;

  // 2フレームに1回だけ顔検出を実行
  if (frameCount % 2 === 0) {
    detectFace();
  }

  // Three.jsは毎フレーム描画（60fps）
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

**なぜ2フレームに1回？**

- 顔検出は計算コストが高い（特にCPUモード）
- 60fpsで毎フレーム検出すると重くなる
- 30fps（2フレームに1回）でも十分な応答性
- Three.jsの描画は60fpsを維持してヌルヌル動く

---

## 3. Off-Axis Projection の仕組み

### 通常のカメラ vs Off-Axis カメラ

#### 通常のカメラ（対称な視錐台）

```
        視点（カメラ）
           ●
          /│\
         / │ \
        /  │  \
       /   │   \
      /____|____\
     画面の中心を見ている
```

- 視錐台（見える範囲）が**対称**
- 常に画面の中心を向いている
- **ユーザーの位置は考慮されない**

#### Off-Axis Projection（非対称な視錐台）

```
  視点が左にずれた場合：

                ●（カメラ）
               /│
              / │
             /  │
            /   │
           /____|____\
          画面の右寄りを見ている
```

- 視錐台が**非対称**
- ユーザーの位置に合わせて視点が変わる
- **「窓から覗く」感覚を再現**

### Three.js での実装

#### `setViewOffset()` メソッド

```javascript
camera.setViewOffset(
  fullWidth,   // 仮想的な画面全体の幅
  fullHeight,  // 仮想的な画面全体の高さ
  x,           // 描画領域のX座標オフセット
  y,           // 描画領域のY座標オフセット
  width,       // 実際の描画幅
  height       // 実際の描画高さ
);
```

**このプロジェクトでの使い方：**

```javascript
// cameraController.js より

function updateCameraOffset(faceX, faceY) {
  // 顔の位置に応じたオフセットを計算
  const offsetX = faceX * scaleFactor;
  const offsetY = faceY * scaleFactor;

  // スムージング適用
  smoothedX = smoothedX * (1 - smoothingFactor) + offsetX * smoothingFactor;
  smoothedY = smoothedY * (1 - smoothingFactor) + offsetY * smoothingFactor;

  // カメラのビューオフセットを設定
  camera.setViewOffset(
    window.innerWidth,  // フルスクリーン幅
    window.innerHeight, // フルスクリーン高さ
    smoothedX,          // X方向のオフセット
    smoothedY,          // Y方向のオフセット
    window.innerWidth,  // 描画幅（変わらず）
    window.innerHeight  // 描画高さ（変わらず）
  );
}
```

### 視覚的な理解

実際に動かして確認してみましょう：

1. **顔を左に動かす**
   - `offsetX` がマイナスになる
   - カメラが左を向く
   - 3Dオブジェクトの**右側**が見える

2. **顔を右に動かす**
   - `offsetX` がプラスになる
   - カメラが右を向く
   - 3Dオブジェクトの**左側**が見える

3. **顔を上に動かす**
   - `offsetY` がマイナスになる
   - カメラが上を向く
   - 3Dオブジェクトの**下側**が見える

4. **顔を近づける**
   - Z距離が小さくなる（今回は未実装だが拡張可能）
   - 視野角が広がる
   - より**没入感**が増す

---

## 4. 座標変換の詳細

### MediaPipe座標 → Three.js座標

**最も重要かつ難しい部分**です。座標系の違いを理解しましょう。

#### MediaPipe の座標系

```
(0,0)───────────(1,0)
  │              │
  │   画面       │
  │              │
(0,1)───────────(1,1)
```

- 原点: **左上**
- X軸: 右方向が正（0 → 1）
- Y軸: **下方向が正**（0 → 1）
- 正規化座標（0.0 〜 1.0）

#### Three.js の座標系

```
        Y+
        │
        │
        │
────────┼────────X+
        │
        │
        │
```

- 原点: **中心**
- X軸: 右方向が正
- Y軸: **上方向が正**
- Z軸: 手前が正（右手系）

#### 変換の手順

**ステップ1: 中心を原点にする**

```javascript
// MediaPipe座標（0-1）を中心基準（-0.5 〜 +0.5）に変換
const centeredX = faceX - 0.5; // 例: 0.7 → 0.2（右寄り）
const centeredY = faceY - 0.5; // 例: 0.3 → -0.2（上寄り）
```

**ステップ2: -1 〜 +1 にスケーリング**

```javascript
const normalizedX = centeredX * 2; // -1 〜 +1
const normalizedY = centeredY * 2; // -1 〜 +1
```

**ステップ3: 物理座標に変換**

```javascript
// 画面サイズを考慮（例: 33.8cm × 19.0cm）
const screenWidth = 33.8;
const screenHeight = 19.0;

const physicalX = normalizedX * (screenWidth / 2);  // cm単位
const physicalY = normalizedY * (screenHeight / 2); // cm単位
```

**ステップ4: Y軸を反転**

```javascript
// MediaPipeは下が正、Three.jsは上が正
const offsetX = physicalX;
const offsetY = -physicalY; // マイナスで反転！
```

**完全な変換コード：**

```javascript
function convertMediaPipeToThreeJS(detection, screenWidth, screenHeight) {
  // 顔の中心座標（0-1）
  const box = detection.boundingBox;
  const faceX = box.originX + box.width / 2;
  const faceY = box.originY + box.height / 2;

  // 中心を原点にして正規化（-1 〜 +1）
  const normalizedX = (faceX - 0.5) * 2;
  const normalizedY = (faceY - 0.5) * 2;

  // 物理座標に変換
  const offsetX = normalizedX * (screenWidth / 2);
  const offsetY = -normalizedY * (screenHeight / 2); // Y軸反転

  return { offsetX, offsetY };
}
```

---

## 5. スムージング処理

### なぜスムージングが必要？

顔検出の結果は**微妙にブレる**ため、そのまま使うと：
- カメラがカクカク動く
- 酔いやすくなる
- 体験が悪い

### Exponential Moving Average (EMA)

**数式：**

```
smoothedValue = previousValue × (1 - α) + newValue × α
```

- `α`（alpha）: スムージング係数（0.0 〜 1.0）
- 小さいほど滑らか（過去の値を重視）
- 大きいほど反応が早い（新しい値を重視）

**実装例：**

```javascript
class Smoother {
  constructor(alpha = 0.1) {
    this.alpha = alpha;
    this.x = 0;
    this.y = 0;
  }

  update(newX, newY) {
    // EMA適用
    this.x = this.x * (1 - this.alpha) + newX * this.alpha;
    this.y = this.y * (1 - this.alpha) + newY * this.alpha;

    return { x: this.x, y: this.y };
  }
}

// 使い方
const smoother = new Smoother(0.1);

function onFaceDetected(offsetX, offsetY) {
  const smoothed = smoother.update(offsetX, offsetY);
  camera.setViewOffset(
    window.innerWidth,
    window.innerHeight,
    smoothed.x,
    smoothed.y,
    window.innerWidth,
    window.innerHeight
  );
}
```

### パラメータ調整

**このプロジェクトの設定：**

```javascript
{
  alphaX: 0.1,  // X軸（左右）
  alphaY: 0.1,  // Y軸（上下）
  alphaZ: 0.15  // Z軸（奥行き）- 将来的な拡張用
}
```

**調整のコツ：**

- **0.05 以下**: とても滑らか、反応が遅い
- **0.1 - 0.2**: バランスが良い（推奨）
- **0.3 以上**: 反応が早い、少しカクつく可能性

lil-gui で調整可能にすると便利：

```javascript
gui.add(smoother, 'alpha', 0.01, 0.5).name('Smoothing');
```

---

## 6. 実装を読み解く

### ファイル構成

```
src/
├── main.js                # エントリーポイント
├── modules/
│   ├── faceDetector.js    # 顔検出ロジック
│   ├── threeScene.js      # Three.jsシーン
│   ├── cameraController.js # カメラ制御
│   └── smoothing.js       # スムージング
└── style.css
```

### 読む順番

1. **[main.js](main.js)** - 全体の流れを把握
2. **[faceDetector.js](src/modules/faceDetector.js)** - MediaPipe部分
3. **[cameraController.js](src/modules/cameraController.js)** - Off-Axis Projection部分
4. **[smoothing.js](src/modules/smoothing.js)** - スムージング処理
5. **[threeScene.js](src/modules/threeScene.js)** - Three.jsシーン構築

### 重要な関数

#### `main.js`

```javascript
async function init() {
  // 1. カメラ初期化
  await initCamera();

  // 2. MediaPipe初期化
  await initFaceDetector();

  // 3. Three.jsシーン構築
  initThreeScene();

  // 4. アニメーションループ開始
  animate();
}
```

#### `faceDetector.js`

```javascript
export async function detectFace(videoElement) {
  const detections = faceDetector.detectForVideo(
    videoElement,
    performance.now()
  );

  if (detections.detections.length > 0) {
    return detections.detections[0];
  }

  return null;
}
```

#### `cameraController.js`

```javascript
export function updateCamera(faceDetection, camera, config) {
  const { offsetX, offsetY } = convertCoordinates(faceDetection, config);
  const smoothed = applySmoothing(offsetX, offsetY);

  camera.setViewOffset(
    window.innerWidth,
    window.innerHeight,
    smoothed.x,
    smoothed.y,
    window.innerWidth,
    window.innerHeight
  );
}
```

---

## 7. 応用アイデア

このプロジェクトをベースに、以下のような拡張が可能です：

### 初級

1. **3Dオブジェクトを追加**
   - グリッドだけでなく、立方体や球体を配置
   - より立体感が分かりやすくなる

2. **背景色の変更**
   - 顔の位置に応じて背景色をグラデーション

3. **デバッグUIの改善**
   - 検出された顔の位置を画面に表示
   - FPSカウンター追加

### 中級

4. **奥行き（Z軸）の検出**
   - 顔のサイズから距離を推定
   - 近づくと視野角が広がる効果

5. **複数人対応**
   - 複数の顔を検出して平均位置を使う
   - または最も中心に近い顔を優先

6. **ジェスチャー認識**
   - MediaPipe Hand Detection と組み合わせ
   - 手で3Dオブジェクトを操作

### 上級

7. **ARコンテンツの配置**
   - 実空間に仮想オブジェクトを配置
   - 顔の向きに応じてオブジェクトが見える/隠れる

8. **マルチディスプレイ対応**
   - 複数のディスプレイで連続した3D空間を表現
   - 各ディスプレイの物理位置を設定

9. **VR/AR ヘッドセットとの連携**
   - WebXR API と組み合わせ
   - より没入感のある体験

---

## デバッグのコツ

### 座標変換が正しいか確認

```javascript
function debugCoordinates(detection) {
  const box = detection.boundingBox;
  const faceX = box.originX + box.width / 2;
  const faceY = box.originY + box.height / 2;

  console.log('MediaPipe座標:', faceX, faceY);
  console.log('変換後:', offsetX, offsetY);
  console.log('スムージング後:', smoothedX, smoothedY);
}
```

### 視覚的なデバッグ

```javascript
// Canvas上に検出位置を描画
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function drawFacePosition(detection) {
  const box = detection.boundingBox;
  const x = box.originX * canvas.width;
  const y = box.originY * canvas.height;
  const w = box.width * canvas.width;
  const h = box.height * canvas.height;

  ctx.strokeStyle = 'red';
  ctx.strokeRect(x, y, w, h);
}
```

### パフォーマンス測定

```javascript
const stats = {
  faceDetectionTime: 0,
  renderTime: 0
};

function measurePerformance() {
  const start = performance.now();
  detectFace();
  stats.faceDetectionTime = performance.now() - start;

  console.log(`顔検出: ${stats.faceDetectionTime.toFixed(2)}ms`);
}
```

---

## まとめ

### 重要な概念

1. **MediaPipe Face Detection**
   - 機械学習ベースの顔検出
   - ブラウザ上でリアルタイム処理
   - 正規化座標（0-1）で結果を返す

2. **Off-Axis Projection**
   - 非対称な視錐台を使った描画
   - ユーザーの視点に合わせてカメラを調整
   - `setViewOffset()` で実装

3. **座標変換**
   - MediaPipe → Three.js への変換が重要
   - Y軸の反転を忘れずに
   - 物理座標（cm）での計算

4. **スムージング**
   - EMAでブレを抑制
   - パラメータ調整で体験が変わる

### 次のステップ

- コードを実際に動かして確認
- パラメータを変えて体感する
- 自分なりの3Dシーンを作ってみる
- 他のMediaPipe機能も試す（Hand Detection など）

---

## 参考資料

- [MediaPipe Documentation](https://developers.google.com/mediapipe)
- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [Off-Axis Projection 論文](https://en.wikipedia.org/wiki/Off-axis_projection)

---

**Happy Coding! 🚀**
