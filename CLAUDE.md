# Off-Axis Projection Demo with Three.js & MediaPipe

## プロジェクト概要
MediaPipe Face Detectionを使用してユーザーの顔位置をトラッキングし、
その位置に基づいてThree.jsのカメラ視点を動的に調整する「off-axis projection」のデモアプリケーション。
ディスプレイがあたかも3D空間への窓のように見える効果を実現する。

## 技術スタック
- **Three.js** (r161以降): 3Dレンダリングエンジン
- **MediaPipe Face Detection**: 顔のリアルタイムトラッキング
- **Vite**: 開発サーバーとビルドツール
- **Vanilla JavaScript**: フレームワークなしのピュアJS
- **lil-gui**: パラメータ調整用GUI
- **GitHub Pages**: デプロイ先

## ターゲットブラウザ
- **Google Chrome (最新版)** - 推奨
- **カメラアクセス必須**
- WebGL対応必須

---

## 技術仕様詳細

### 1. Off-Axis Projection設定

**実装方法:**
- Three.js `PerspectiveCamera.setViewOffset()` を使用した非対称視錐台による実装

**物理パラメータ（デフォルト値）:**
```
画面サイズ: 33.8cm × 19.0cm（15.4インチ、16:9想定）
デフォルト視聴距離: 60cm（Z軸方向）
視野角（FOV）: 50度
Near plane: 0.1
Far plane: 1000
```

**頭部移動可能範囲:**
```
X軸（左右）: ±20cm
Y軸（上下）: ±15cm
Z軸（奥行き）: 40-80cm
```

### 2. MediaPipe Face Detection設定

**基本設定:**
```
Running Mode: VIDEO
Model: blaze_face_short_range.tflite
Min Detection Confidence: 0.5
Min Tracking Confidence: 0.5
使用するランドマーク: 顔中心（bounding box中央）
フレームレート: 30fps（レンダリングループの2フレームに1回実行）
モデルパス: https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm
```

**複数顔検出時の処理:**
- 最初に検出された顔（`detections[0]`）のみ使用
- 信頼度が0.5未満の検出は無視

### 3. Webカメラ設定

**推奨設定:**
```
解像度: 640×480（パフォーマンス優先）
フレームレート: 30fps
Facing mode: user（フロントカメラ）
ミラーリング: 有効（ユーザーの直感に合わせる）
ビデオ要素: hidden（デバッグモードでのみ表示可能）
```

---

## パフォーマンス要件

### フレームレート目標
```
Three.js レンダリング: 60fps
顔検出処理: 30fps（2フレームに1回実行）
最小許容FPS: 24fps（これを下回る場合は警告表示を検討）
```

### スムージング設定

**アルゴリズム:** Exponential Moving Average (EMA)

**スムージング係数（alpha）:**
```
X軸（左右）: 0.1
Y軸（上下）: 0.1
Z軸（奥行き）: 0.15（少し強めにスムージング）
```

**数式:**
```javascript
smoothedValue = previousValue × (1 - alpha) + newValue × alpha
```

### 座標変換

**MediaPipe → Three.js座標変換:**

MediaPipeは正規化座標 `[0, 1]` を出力。これをThree.jsのカメラオフセットに変換：

```javascript
// 顔の中心座標を取得
const faceX = detection.boundingBox.originX + detection.boundingBox.width / 2;
const faceY = detection.boundingBox.originY + detection.boundingBox.height / 2;

// 中心を0とした正規化座標に変換 [-1, 1]
const normalizedX = (faceX - 0.5) * 2;
const normalizedY = (faceY - 0.5) * 2;

// 物理座標に変換（cm単位）
const offsetX = normalizedX * (screenWidth / 2) * scale;
const offsetY = -normalizedY * (screenHeight / 2) * scale;  // Y軸反転

// スムージング適用
smoothedX = smoothedX * (1 - alpha) + offsetX * alpha;
smoothedY = smoothedY * (1 - alpha) + offsetY * alpha;
```

**重要:** MediaPipeは左上が(0,0)、Three.jsは上方向が正のY軸のため、Y軸を反転すること。

**setViewOffset計算:**
```javascript
camera.setViewOffset(
  window.innerWidth,   // fullWidth
  window.innerHeight,  // fullHeight
  smoothedX,           // x offset
  smoothedY,           // y offset
  window.innerWidth,   // width
  window.innerHeight   // height
);
```

---

## 3Dシーン仕様

### グリッド設定
```
タイプ: GridHelper
サイズ: 20（単位: メートル想定）
分割数: 20
中央線の色: 0x444444
グリッド線の色: 0x222222
配置: Y = -2（カメラの下）
```

### 照明設定
```
Ambient Light:
  - 色: 0x404040
  - 柔らかい全体照明

Directional Light:
  - 色: 0xffffff
  - 強度: 1.0
  - 位置: (5, 10, 7.5)

影: 無効（パフォーマンス優先）
```

### カメラ設定
```
タイプ: PerspectiveCamera
FOV: 50度
Aspect: window.innerWidth / window.innerHeight
Near: 0.1
Far: 1000
デフォルト位置: (0, 0, 60)（60cm想定）
LookAt: (0, 0, 0)
```

---

## ユーザーエクスペリエンス

### 初期化フロー
1. ローディング画面表示（「MediaPipeモデル読み込み中...」）
2. MediaPipe Face Detector初期化
3. カメラアクセス許可リクエスト
4. ビデオストリーム開始
5. Three.jsシーン構築
6. 「顔を検出中...」メッセージ表示
7. 顔検出成功でoff-axis projection開始

### 視覚フィードバック
```
顔未検出時: 画面上部に薄い警告「カメラに顔を向けてください」
顔検出時: フィードバックなし（自然な動作）
デフォルト視点への復帰: 顔が2秒間検出されなかった場合、スムーズにアニメーション
lil-gui パネル: 右上に配置、折りたたみ可能
```

### lil-gui 調整項目
```
Smoothing (0.01 - 0.5): スムージング強度
Scale (0.5 - 5.0): 頭部移動とカメラオフセットのスケール（デフォルト: 2.0）
Viewing Distance (30 - 100cm): 想定視聴距離
Screen Width (20 - 50cm): 画面の物理幅

Debug:
  - Show Video (boolean): カメラ映像を画面に表示
  - Show Stats (boolean): FPS表示
```

---

## エラーハンドリング

### カメラアクセスエラー
```
エラータイプ: NotAllowedError, NotFoundError
処理: 画面中央に「カメラアクセスが必要です」メッセージ表示
フォールバック: なし（カメラ必須）
```

### MediaPipeモデル読み込みエラー
```
エラータイプ: Network error, Model load failed
処理: 「モデルの読み込みに失敗しました。ページを再読み込みしてください」
リトライ: なし（手動再読み込みを推奨）
```

### 顔検出エラー
```
複数顔検出: 最初の顔（detections[0]）のみ使用
顔未検出: 2秒後にデフォルト視点へスムーズに戻る
低信頼度検出: confidence < 0.5 の場合は無視
```

### ブラウザ互換性
```
サポート対象: Google Chrome 最新版
非対応ブラウザ: 「Google Chromeを使用してください」メッセージ表示
WebGL未対応: 「このブラウザはWebGLをサポートしていません」メッセージ表示
```

---

## ファイル構成（実装時）

```
src/
├── index.html          # HTMLエントリーポイント
├── main.js             # アプリケーションメイン
├── style.css           # スタイル
├── modules/
│   ├── faceDetector.js    # MediaPipe Face Detection管理
│   ├── threeScene.js      # Three.jsシーン構築
│   ├── cameraController.js # Off-axis projection計算
│   └── smoothing.js       # EMAスムージング実装
└── static/
    └── (なし - CDNからモデル読み込み)
```

---

## GitHub Pagesデプロイ要件

```
ビルドコマンド: npm run build
出力ディレクトリ: dist/
Base URL: /off_axis_projection_demo/（リポジトリ名に合わせる）
HTTPS必須: カメラアクセスのため
vite.config.js 設定: base: '/off_axis_projection_demo/'
```

---

## テスト・検証方法

### 機能テスト
1. カメラアクセスが正常に許可されるか
2. 顔検出が安定して動作するか（正面、左右、上下移動）
3. カメラオフセットが自然に更新されるか
4. 顔が見失われた時にデフォルト視点に戻るか
5. lil-guiのパラメータ調整が反映されるか
6. ウィンドウリサイズに正しく対応するか

### パフォーマンステスト
1. Chrome DevTools Performanceタブで60fps維持を確認
2. 顔検出処理が30fps（33ms間隔）で実行されているか確認
3. メモリリークがないか（長時間実行テスト）

### 視覚的検証
1. グリッドの奥行きが自然に見えるか
2. 頭を左右に動かすとグリッドが期待通りに動くか
3. 近づく/遠ざかるでパースペクティブが変化するか
4. スムージングがジッター（ガタつき）抑制に効いているか

---

## 実装時の注意点

### 座標系の違いに注意
- **MediaPipe**: 左上が(0,0)、右下が(1,1)
- **Three.js**: 中心が(0,0,0)、Y軸は上が正
- **必ずY軸を反転して変換すること**

### パフォーマンス最適化
- 顔検出は毎フレーム実行せず、2フレームに1回
- 不要なオブジェクトはシーンから削除
- テクスチャやジオメトリは使い回す

### ユーザビリティ
- 初回アクセス時はカメラ許可の説明を表示
- デバッグUIは折りたたみ可能にして邪魔にならないように
- モバイルは非対応と明記（デスクトップ/ラップトップ専用）

### エッジケース
- 複数人が映る場合の挙動
- 顔が画面外に出た場合
- 急激な動きへの対応（スムージングで緩和）
