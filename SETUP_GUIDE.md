# セットアップガイド - Off-Axis Projection Demo

このドキュメントでは、プロジェクトを **ゼロから構築する手順** を詳しく解説します。
特にMediaPipe Face Detectionの導入に必要な設定を重点的に説明します。

---

## 目次

1. [前提条件](#1-前提条件)
2. [プロジェクトの初期化](#2-プロジェクトの初期化)
3. [必要なパッケージのインストール](#3-必要なパッケージのインストール)
4. [Viteの設定](#4-viteの設定)
5. [MediaPipeの設定](#5-mediapipeの設定)
6. [プロジェクト構造の作成](#6-プロジェクト構造の作成)
7. [開発サーバーの起動](#7-開発サーバーの起動)
8. [デプロイ設定](#8-デプロイ設定)
9. [トラブルシューティング](#9-トラブルシューティング)

---

## 1. 前提条件

### 必要な環境

- **Node.js**: v18.0.0 以上（推奨: v20以上）
- **Yarn**: v1.22.0 以上
- **ブラウザ**: Google Chrome 最新版
- **Webカメラ**: フロントカメラ必須
- **OS**: macOS, Windows, Linux（いずれでも可）

### 確認コマンド

```bash
# Node.jsのバージョン確認
node -v
# v20.x.x などが表示されればOK

# Yarnのバージョン確認
yarn -v
# 1.22.x などが表示されればOK
```

Yarnがインストールされていない場合：

```bash
npm install -g yarn
```

---

## 2. プロジェクトの初期化

### ステップ1: Viteプロジェクトの作成

```bash
# プロジェクトフォルダに移動（または作成）
mkdir off_axis_projection_demo
cd off_axis_projection_demo

# Vite + Vanilla JSでプロジェクトを初期化
yarn create vite . --template vanilla

# 質問が出た場合の回答例：
# ? Select a framework: › Vanilla
# ? Select a variant: › JavaScript
```

**重要:** `yarn create vite` は対話形式で進みます。以下を選択してください：

1. **Framework**: `Vanilla` を選択
2. **Variant**: `JavaScript` を選択（TypeScriptでも可）

### ステップ2: 初期ファイルの確認

Viteが以下のファイルを自動生成します：

```
off_axis_projection_demo/
├── index.html          # HTMLエントリーポイント
├── main.js             # JavaScriptエントリーポイント
├── style.css           # スタイルシート
├── package.json        # パッケージ管理
├── .gitignore          # Git除外設定
└── public/             # 静的アセット用フォルダ
    └── vite.svg
```

### ステップ3: プロジェクト構造の変更

このプロジェクトでは、**src/** フォルダにソースコードを配置します。

```bash
# srcフォルダを作成
mkdir src

# 既存ファイルをsrcに移動
mv index.html src/
mv main.js src/
mv style.css src/

# staticフォルダを作成（public/の代わり）
mkdir static
mv public/vite.svg static/
rmdir public
```

**なぜこうするの？**
- `src/` にソースコードを集約すると管理しやすい
- `static/` に静的ファイル（画像など）を配置
- ビルド時に `dist/` に出力される

---

## 3. 必要なパッケージのインストール

### ステップ1: 依存関係のインストール

```bash
# まず基本的な依存関係をインストール
yarn install
```

### ステップ2: Three.jsのインストール

```bash
yarn add three
```

**Three.jsとは？**
- WebGLベースの3Dレンダリングライブラリ
- このプロジェクトの3D描画エンジン

### ステップ3: MediaPipeのインストール（最重要！）

```bash
yarn add @mediapipe/tasks-vision
```

**@mediapipe/tasks-vision とは？**
- Google製の機械学習ベースの視覚認識ライブラリ
- 顔検出、手の認識、ポーズ推定などが可能
- **WebAssembly版** でブラウザ上で動作
- GPUアクセラレーションに対応

**重要なポイント：**
- バージョン `^0.10.18` 以上を使用
- モデルファイルはCDNから自動ダウンロード
- ローカルにモデルを配置する必要はない

### ステップ4: lil-guiのインストール

```bash
yarn add lil-gui
```

**lil-guiとは？**
- パラメータ調整用のGUIライブラリ
- リアルタイムでスムージングやスケールを調整できる

### ステップ5: 開発用パッケージのインストール

```bash
# GLSLシェーダーサポート（将来的な拡張用）
yarn add -D vite-plugin-glsl

# GitHub Pagesへのデプロイ用
yarn add -D gh-pages
```

### 最終的な package.json

以下のような内容になります：

```json
{
  "name": "off_axis_projection_demo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "gh-pages -d dist"
  },
  "devDependencies": {
    "gh-pages": "^6.3.0",
    "vite": "^7.2.4",
    "vite-plugin-glsl": "^1.5.0"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.18",
    "lil-gui": "^0.20.0",
    "three": "^0.177.0"
  }
}
```

---

## 4. Viteの設定

### vite.config.js の作成

プロジェクトルートに `vite.config.js` を作成します：

```bash
touch vite.config.js
```

**ファイル内容：**

```javascript
import glsl from 'vite-plugin-glsl'

export default {
  // ソースコードのルートディレクトリ
  root: 'src/',

  // 静的ファイルのディレクトリ
  publicDir: '../static/',

  // GitHub Pagesのベースパス（リポジトリ名に合わせる）
  base: '/off_axis_projection_demo/',

  // 開発サーバー設定
  server: {
    host: true, // ローカルネットワークに公開（スマホでテスト可能）
    open: true  // 起動時にブラウザを自動で開く
  },

  // ビルド設定
  build: {
    outDir: '../dist',    // 出力先
    emptyOutDir: true,    // ビルド前にクリア
    sourcemap: true       // デバッグ用ソースマップ
  },

  // Three.jsでよく使うアセット形式を追加
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr', '**/*.exr'],

  // プラグイン
  plugins: [
    glsl() // GLSLシェーダーファイルのサポート
  ]
}
```

**設定の解説：**

| 設定項目 | 説明 |
|---------|------|
| `root: 'src/'` | ソースコードを `src/` に配置 |
| `publicDir: '../static/'` | 静的ファイルを `static/` から配信 |
| `base: '/off_axis_projection_demo/'` | GitHub Pagesのサブパス |
| `server.host: true` | ローカルネットワークに公開 |
| `server.open: true` | 自動でブラウザを開く |
| `build.outDir: '../dist'` | ビルド成果物を `dist/` に出力 |
| `assetsInclude` | 3Dモデル形式を静的アセットとして扱う |

---

## 5. MediaPipeの設定

### 重要な概念

MediaPipeを使うには、以下の3つが必要です：

1. **npm パッケージ** - `@mediapipe/tasks-vision`
2. **WebAssembly モデル** - CDNから自動ダウンロード
3. **初期化コード** - Face Detectorの設定

### ステップ1: モデルのロード方法

MediaPipeは**CDN経由**でモデルをロードします。ローカルに配置する必要はありません。

```javascript
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

// WebAssembly版のMediaPipeをCDNから読み込む
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
)
```

**なぜCDN？**
- モデルファイルが大きい（数MB）
- npm パッケージに含めるとインストールが重くなる
- CDNならキャッシュされて高速

### ステップ2: Face Detectorの初期化

```javascript
const faceDetector = await FaceDetector.createFromOptions(vision, {
  baseOptions: {
    // モデルファイルのパス
    modelAssetPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/blaze_face_short_range.tflite',
    // GPU使用で高速化
    delegate: 'GPU'
  },
  // ビデオストリーム用（連続フレーム処理）
  runningMode: 'VIDEO',
  // 検出の信頼度閾値（50%以上で採用）
  minDetectionConfidence: 0.5,
  // 重複検出の抑制
  minSuppressionThreshold: 0.3
})
```

**設定パラメータの意味：**

| パラメータ | 説明 | 推奨値 |
|-----------|------|--------|
| `modelAssetPath` | モデルファイルのURL | blaze_face_short_range.tflite |
| `delegate` | 処理デバイス（GPU/CPU） | 'GPU' |
| `runningMode` | 動作モード | 'VIDEO' |
| `minDetectionConfidence` | 検出信頼度の最小値 | 0.5 |
| `minSuppressionThreshold` | 重複検出の抑制 | 0.3 |

**モデルの選択：**

- **blaze_face_short_range.tflite** - 近距離用（0.5m〜2m）← 今回使用
- **blaze_face_long_range.tflite** - 遠距離用（2m以上）

デスクトップ/ラップトップでの使用を想定しているため、short_rangeを選択しています。

### ステップ3: 顔検出の実行

```javascript
// ビデオ要素から顔を検出
const detections = faceDetector.detectForVideo(
  videoElement,           // <video>要素
  performance.now()       // タイムスタンプ（ms）
)

// 結果の取得
if (detections.detections.length > 0) {
  const face = detections.detections[0] // 最初の顔
  const box = face.boundingBox          // バウンディングボックス

  console.log('顔の位置:', box.originX, box.originY)
  console.log('サイズ:', box.width, box.height)
}
```

**検出結果の構造：**

```javascript
{
  detections: [
    {
      boundingBox: {
        originX: 0.3,  // 左上X（0-1）
        originY: 0.2,  // 左上Y（0-1）
        width: 0.2,    // 幅（0-1）
        height: 0.3,   // 高さ（0-1）
        angle: 0       // 回転角度
      },
      categories: [
        {
          score: 0.95,        // 信頼度
          index: 0,
          categoryName: 'face'
        }
      ],
      keypoints: [...]  // 顔のランドマーク（6点）
    }
  ]
}
```

### ステップ4: パフォーマンス最適化

顔検出は計算コストが高いため、**2フレームに1回**実行します。

```javascript
let frameCount = 0

function animate() {
  frameCount++

  // 2フレームに1回だけ顔検出
  if (frameCount % 2 === 0) {
    const detections = faceDetector.detectForVideo(video, performance.now())
    // ... 検出結果を処理
  }

  // Three.jsは毎フレーム描画（60fps）
  renderer.render(scene, camera)

  requestAnimationFrame(animate)
}
```

**結果：**
- 顔検出: 30fps（33ms間隔）
- 描画: 60fps（16.6ms間隔）
- スムーズな体験を維持

---

## 6. プロジェクト構造の作成

### 最終的なフォルダ構成

```
off_axis_projection_demo/
├── src/
│   ├── index.html              # HTMLエントリーポイント
│   ├── main.js                 # アプリケーションメイン
│   ├── style.css               # スタイルシート
│   └── modules/
│       ├── faceDetector.js     # MediaPipe Face Detection
│       ├── threeScene.js       # Three.jsシーン構築
│       ├── cameraController.js # Off-Axis Projection
│       └── smoothing.js        # EMAスムージング
├── static/
│   └── vite.svg                # 静的アセット
├── dist/                       # ビルド出力（自動生成）
├── node_modules/               # 依存パッケージ
├── package.json
├── vite.config.js
├── .gitignore
├── README.md
├── CLAUDE.md                   # プロジェクト仕様
├── LEARNING_GUIDE.md           # 学習ガイド
└── SETUP_GUIDE.md              # このファイル
```

### モジュールフォルダの作成

```bash
# modulesフォルダを作成
mkdir -p src/modules

# 各モジュールファイルを作成
touch src/modules/faceDetector.js
touch src/modules/threeScene.js
touch src/modules/cameraController.js
touch src/modules/smoothing.js
```

### 各モジュールの役割

| ファイル | 役割 |
|---------|------|
| `faceDetector.js` | MediaPipe Face Detectorの管理 |
| `threeScene.js` | Three.jsシーンの構築（カメラ、照明、グリッド） |
| `cameraController.js` | Off-Axis Projectionの計算と適用 |
| `smoothing.js` | EMAスムージングの実装 |

---

## 7. 開発サーバーの起動

### ステップ1: 開発サーバーを起動

```bash
yarn dev
```

以下のような出力が表示されます：

```
  VITE v7.2.4  ready in 500 ms

  ➜  Local:   http://localhost:5173/off_axis_projection_demo/
  ➜  Network: http://192.168.1.10:5173/off_axis_projection_demo/
  ➜  press h + enter to show help
```

ブラウザが自動で開きます（`server.open: true` の設定）。

### ステップ2: カメラアクセスの許可

初回アクセス時、ブラウザがカメラへのアクセスを求めます。

```
┌─────────────────────────────────────┐
│ localhost がカメラへのアクセスを    │
│ 求めています                        │
│                                     │
│  [ブロック]  [許可]                 │
└─────────────────────────────────────┘
```

**必ず「許可」をクリック**してください。

### ステップ3: 動作確認

以下が表示されればOK：

1. ✅ ローディング画面が表示される
2. ✅ MediaPipeモデルが読み込まれる
3. ✅ カメラ映像が取得される（画面には非表示）
4. ✅ 顔が検出される
5. ✅ 3Dグリッドが表示される
6. ✅ 頭を動かすと視点が変わる

### トラブルシューティング

**カメラが起動しない場合：**

```javascript
// main.jsで確認
navigator.mediaDevices.getUserMedia({
  video: {
    width: 640,
    height: 480,
    facingMode: 'user'
  }
})
.then(stream => {
  console.log('カメラ起動成功！')
  videoElement.srcObject = stream
})
.catch(error => {
  console.error('カメラエラー:', error.name, error.message)
})
```

**よくあるエラー：**

- `NotAllowedError` → カメラアクセスがブロックされている
- `NotFoundError` → カメラが見つからない
- `NotReadableError` → カメラが他のアプリで使用中

---

## 8. デプロイ設定

### GitHub Pagesへのデプロイ

#### ステップ1: ビルド

```bash
yarn build
```

`dist/` フォルダに成果物が生成されます：

```
dist/
├── index.html
├── assets/
│   ├── index-abc123.js
│   └── index-def456.css
└── vite.svg
```

#### ステップ2: プレビュー

```bash
yarn preview
```

ローカルでビルド結果を確認できます。

#### ステップ3: デプロイ

```bash
yarn deploy
```

`gh-pages` ブランチに自動デプロイされます。

#### GitHubリポジトリの設定

1. GitHubリポジトリの **Settings** を開く
2. **Pages** セクションに移動
3. **Source** を `gh-pages` ブランチに設定
4. 数分後、以下のURLでアクセス可能：

```
https://[ユーザー名].github.io/off_axis_projection_demo/
```

**重要:** HTTPSでないとカメラアクセスができません。GitHub PagesはデフォルトでHTTPSです。

---

## 9. トラブルシューティング

### MediaPipe関連のエラー

#### エラー1: "Failed to load model"

```
Error: Failed to load model from https://cdn.jsdelivr.net/...
```

**原因:**
- ネットワークエラー
- CDNが一時的にダウン

**解決策:**
1. インターネット接続を確認
2. ブラウザのキャッシュをクリア
3. 別のCDNを試す（unpkgなど）

#### エラー2: "WebAssembly is not supported"

**原因:**
- ブラウザがWebAssemblyに非対応

**解決策:**
- Google Chrome 最新版を使用
- ブラウザを更新

#### エラー3: "GPU delegate is not supported"

```
Warning: GPU delegate is not supported, falling back to CPU
```

**原因:**
- GPUが利用できない環境

**解決策:**
- CPUモードにフォールバック（自動）
- パフォーマンスは低下するが動作する

```javascript
baseOptions: {
  delegate: 'CPU' // CPUモードに明示的に変更
}
```

### Three.js関連のエラー

#### エラー4: "Cannot read property 'setViewOffset' of undefined"

**原因:**
- カメラが初期化されていない

**解決策:**
- Three.jsシーンの初期化を先に実行
- カメラオブジェクトの存在を確認

```javascript
if (camera && camera.setViewOffset) {
  camera.setViewOffset(...)
}
```

### カメラアクセスのエラー

#### エラー5: "NotAllowedError"

**原因:**
- ユーザーがカメラアクセスを拒否
- HTTPSでない環境（localhostは除く）

**解決策:**
1. ブラウザの設定でカメラアクセスを許可
2. HTTPSで配信（GitHub Pages推奨）
3. localhost での開発を継続

#### エラー6: カメラが真っ暗

**原因:**
- カメラが他のアプリで使用中
- ビデオ要素の設定ミス

**解決策:**
```javascript
// autoplay と playsinline を必ず設定
<video id="webcam" autoplay playsinline></video>
```

```javascript
// JavaScriptでも明示的に再生
videoElement.play()
```

### パフォーマンスの問題

#### 症状: FPSが低い（24fps以下）

**原因:**
- 毎フレーム顔検出を実行している
- GPUが使えていない

**解決策:**
1. 顔検出を2フレームに1回に制限
2. GPU delegateを有効化
3. ビデオ解像度を下げる（640x480）

```javascript
// カメラ解像度を下げる
video: {
  width: { ideal: 640 },
  height: { ideal: 480 }
}
```

---

## まとめ

### セットアップの流れ（チェックリスト）

- [ ] Node.js と Yarn をインストール
- [ ] `yarn create vite` でプロジェクト作成
- [ ] `src/` と `static/` にファイルを移動
- [ ] `yarn add three @mediapipe/tasks-vision lil-gui` でパッケージインストール
- [ ] `vite.config.js` を作成・設定
- [ ] `src/modules/` フォルダ作成
- [ ] 各モジュールファイルを実装
- [ ] `yarn dev` で開発サーバー起動
- [ ] カメラアクセスを許可
- [ ] 動作確認
- [ ] `yarn build && yarn deploy` でデプロイ

### MediaPipe使用の重要ポイント

1. **CDNからモデルを読み込む** - ローカル配置不要
2. **GPU delegateを優先** - パフォーマンス向上
3. **VIDEO モードを使用** - 連続フレーム処理用
4. **2フレームに1回実行** - 60fps維持のため
5. **信頼度0.5以上を採用** - 誤検出を防ぐ

### 次のステップ

- [LEARNING_GUIDE.md](LEARNING_GUIDE.md) で技術的な詳細を学ぶ
- [CLAUDE.md](CLAUDE.md) で仕様を確認
- 実際にコードを書いて動かしてみる
- パラメータをlil-guiで調整して体感する

---

**Happy Coding! 🚀**

問題が発生した場合は、ブラウザの開発者ツール（F12）でコンソールを確認してください。
