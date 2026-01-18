# Off-Axis Projection Demo 実装 TODO List

## プロジェクト概要
MediaPipe Face Detection と Three.js を使用した off-axis projection デモアプリケーションの実装計画

---

## Phase 1: プロジェクト基盤整備

### 1.1 設定ファイルの更新
- [ ] `vite.config.js` に GitHub Pages 用の base URL 設定を追加
  - `base: '/off_axis_projection_demo/'` を設定
- [ ] `package.json` のスクリプトを確認
  - `dev`, `build`, `preview` が正しく動作するか確認

### 1.2 既存ボイラープレートコードの削除
- [ ] `src/counter.js` を削除（不要なデモコード）
- [ ] `src/javascript.svg` を削除（不要なアセット）
- [ ] `src/style.css` を整理（必要な基本スタイルのみ残す）
- [ ] `src/main.js` のボイラープレートコードをクリア

---

## Phase 2: モジュール構造の構築

### 2.1 ディレクトリ作成
- [ ] `src/modules/` ディレクトリを作成

### 2.2 基本モジュールファイルの作成
- [ ] `src/modules/smoothing.js` を作成
  - EMA (Exponential Moving Average) スムージングクラスを実装
  - `update(newValue, alpha)` メソッド
  - X, Y, Z 軸それぞれの平滑化値を管理

- [ ] `src/modules/faceDetector.js` を作成
  - MediaPipe Face Detection の初期化
  - VIDEO モードでの設定
  - 顔検出結果の取得メソッド
  - エラーハンドリング（モデル読み込み失敗時）

- [ ] `src/modules/threeScene.js` を作成
  - Three.js シーンのセットアップ
  - GridHelper の作成（サイズ20、分割20）
  - ライティング設定（Ambient + Directional）
  - レンダラーの初期化
  - ウィンドウリサイズ対応

- [ ] `src/modules/cameraController.js` を作成
  - PerspectiveCamera の初期化（FOV 50）
  - 顔位置からカメラオフセットへの変換ロジック
  - `setViewOffset()` の計算と適用
  - デフォルト視点への復帰アニメーション

---

## Phase 3: コアロジックの実装

### 3.1 スムージングモジュール (`smoothing.js`)
- [ ] EMA アルゴリズムの実装
  ```javascript
  class Smoother {
    constructor(initialValue = 0) {
      this.value = initialValue;
    }
    update(newValue, alpha) {
      this.value = this.value * (1 - alpha) + newValue * alpha;
      return this.value;
    }
    reset(value = 0) {
      this.value = value;
    }
  }
  ```
- [ ] X, Y, Z 軸用の Smoother インスタンスを管理するクラスを実装

### 3.2 顔検出モジュール (`faceDetector.js`)
- [ ] MediaPipe Face Detection の初期化関数
  - CDN から WASM モデルを読み込み
  - `FaceDetector.createFromOptions()` で VIDEO モード設定
  - `minDetectionConfidence: 0.5`
  - `minTrackingConfidence: 0.5`

- [ ] 顔検出実行関数
  - ビデオフレームを受け取り、検出結果を返す
  - 複数顔検出時は `detections[0]` のみ使用
  - 信頼度 < 0.5 の場合は null を返す

- [ ] エラーハンドリング
  - モデル読み込み失敗時のエラーメッセージ表示

### 3.3 Three.js シーンモジュール (`threeScene.js`)
- [ ] シーン初期化
  - `new THREE.Scene()` 作成
  - 背景色設定（黒または濃いグレー）

- [ ] グリッド作成
  - `new THREE.GridHelper(20, 20, 0x444444, 0x222222)`
  - Y = -2 に配置

- [ ] ライティング設定
  - `AmbientLight(0x404040)` を追加
  - `DirectionalLight(0xffffff, 1.0)` を位置 (5, 10, 7.5) に追加

- [ ] レンダラー設定
  - `WebGLRenderer({ antialias: true })`
  - ピクセル比を `window.devicePixelRatio` に設定
  - サイズを `window.innerWidth × window.innerHeight` に設定

- [ ] ウィンドウリサイズハンドラ
  - カメラのアスペクト比更新
  - レンダラーサイズ更新
  - `camera.updateProjectionMatrix()` 呼び出し

### 3.4 カメラコントローラモジュール (`cameraController.js`)
- [ ] PerspectiveCamera 初期化
  - FOV: 50, Aspect: 自動計算, Near: 0.1, Far: 1000
  - デフォルト位置: (0, 0, 60)
  - LookAt: (0, 0, 0)

- [ ] 座標変換関数
  - MediaPipe 正規化座標 [0, 1] → Three.js オフセット座標
  - Y 軸反転処理
  - スケール係数の適用（デフォルト: 2.0）

- [ ] `setViewOffset()` 適用関数
  ```javascript
  camera.setViewOffset(
    window.innerWidth,
    window.innerHeight,
    smoothedX,
    smoothedY,
    window.innerWidth,
    window.innerHeight
  );
  ```

- [ ] デフォルト視点への復帰関数
  - 2秒間顔未検出時にトリガー
  - スムーズにオフセットを (0, 0) に戻す

---

## Phase 4: メインアプリケーションの統合

### 4.1 HTML 構造の更新 (`index.html`)
- [ ] 基本HTML構造を整備
  - `<div id="app">` をレンダリングコンテナに
  - `<video id="webcam">` 要素を追加（hidden）
  - ローディングメッセージ用 `<div id="loading">`
  - 顔未検出警告用 `<div id="no-face-warning">`

### 4.2 CSS スタイルの実装 (`style.css`)
- [ ] 基本レイアウトスタイル
  - `body, html` を margin: 0, overflow: hidden に
  - `#app` を全画面表示に

- [ ] ローディング画面スタイル
  - 中央配置、半透明背景
  - 「MediaPipeモデル読み込み中...」テキスト

- [ ] 顔未検出警告スタイル
  - 画面上部、薄い警告色
  - 「カメラに顔を向けてください」テキスト
  - デフォルトは非表示（`.hidden` クラス）

- [ ] ビデオ要素スタイル
  - デフォルト: `display: none`
  - デバッグモード時に右下に小さく表示

### 4.3 メインアプリケーション (`main.js`)
- [ ] 初期化フロー実装
  1. ローディング画面表示
  2. MediaPipe Face Detector 初期化
  3. カメラアクセス取得（640×480、30fps）
  4. Three.js シーン構築
  5. ローディング画面非表示
  6. アニメーションループ開始

- [ ] カメラアクセス関数
  ```javascript
  navigator.mediaDevices.getUserMedia({
    video: {
      width: 640,
      height: 480,
      frameRate: 30,
      facingMode: 'user'
    }
  })
  ```

- [ ] エラーハンドリング
  - カメラアクセス拒否時: メッセージ表示
  - MediaPipe 初期化失敗時: メッセージ表示
  - WebGL 非対応時: メッセージ表示

- [ ] アニメーションループ実装
  - `requestAnimationFrame` でループ
  - フレームカウンタで2フレームに1回顔検出
  - 顔検出結果をスムージング
  - カメラオフセット更新
  - シーンレンダリング

- [ ] 顔未検出タイマー
  - 顔が2秒間検出されない場合、デフォルト視点に復帰
  - 警告メッセージ表示/非表示の切り替え

---

## Phase 5: デバッグ UI の実装

### 5.1 lil-gui セットアップ
- [ ] lil-gui インスタンス作成
- [ ] GUI パネルの右上配置
- [ ] 折りたたみ可能に設定

### 5.2 パラメータコントロール追加
- [ ] Smoothing スライダー（0.01 - 0.5、デフォルト: 0.1）
- [ ] Scale スライダー（0.5 - 5.0、デフォルト: 2.0）
- [ ] Viewing Distance スライダー（30 - 100cm、デフォルト: 60）
- [ ] Screen Width スライダー（20 - 50cm、デフォルト: 33.8）

### 5.3 デバッグ機能
- [ ] Show Video チェックボックス
  - ON: ビデオ要素を右下に表示
  - OFF: ビデオ要素を非表示

- [ ] Show Stats チェックボックス
  - ON: FPS カウンター表示（stats.js または自作）
  - OFF: 非表示

---

## Phase 6: テストとデバッグ

### 6.1 機能テスト
- [ ] カメラアクセスが正常に動作するか
- [ ] 顔検出が安定して動作するか（正面、左右、上下）
- [ ] カメラオフセットが自然に更新されるか
- [ ] 顔が見失われた時にデフォルト視点に戻るか
- [ ] lil-gui のパラメータ調整が正しく反映されるか
- [ ] ウィンドウリサイズに対応しているか

### 6.2 パフォーマンステスト
- [ ] Chrome DevTools で FPS を確認（60fps 目標）
- [ ] 顔検出処理が30fps（33ms間隔）で実行されているか確認
- [ ] メモリリークがないか（長時間実行テスト）

### 6.3 視覚的検証
- [ ] グリッドの奥行きが自然に見えるか
- [ ] 頭を左右に動かすとグリッドが期待通りに動くか
- [ ] 近づく/遠ざかるでパースペクティブが変化するか
- [ ] スムージングがジッター抑制に効いているか

### 6.4 エラーケーステスト
- [ ] カメラアクセス拒否時のエラー表示
- [ ] MediaPipe モデル読み込み失敗時のエラー表示
- [ ] 複数人が映った場合の挙動
- [ ] 顔が画面外に出た場合の挙動

---

## Phase 7: 最適化と仕上げ

### 7.1 パフォーマンス最適化
- [ ] 不要なオブジェクトの削除
- [ ] ジオメトリとマテリアルの使い回し確認
- [ ] 顔検出フレームレートの調整（必要に応じて）

### 7.2 UI/UX 改善
- [ ] 初回アクセス時のカメラ許可説明を追加
- [ ] デバッグ UI を折りたたみ可能に（デフォルト: 閉じた状態）
- [ ] モバイル非対応メッセージの追加（オプション）

### 7.3 コードクリーンアップ
- [ ] console.log のデバッグコードを削除
- [ ] コメントを整理（必要な箇所のみ）
- [ ] 未使用のインポートや変数を削除

---

## Phase 8: デプロイ準備

### 8.1 ビルド設定の確認
- [ ] `npm run build` が正常に動作するか確認
- [ ] `dist/` ディレクトリが正しく生成されるか確認
- [ ] アセットパスが正しく解決されるか確認

### 8.2 GitHub Pages デプロイ
- [ ] GitHub リポジトリに変更をプッシュ
- [ ] GitHub Pages を有効化（Settings → Pages）
- [ ] ソースを `gh-pages` ブランチまたは `main` の `/dist` に設定
- [ ] デプロイ後、HTTPS で動作確認（カメラアクセス必須）

### 8.3 デプロイ後の動作確認
- [ ] GitHub Pages URL でアクセス
- [ ] カメラアクセスが正常に動作するか
- [ ] 顔検出とoff-axis projection が正常に動作するか
- [ ] 各種エラーハンドリングが機能するか

---

## Phase 9: ドキュメント整備

### 9.1 README.md 作成
- [ ] プロジェクト概要
- [ ] デモ URL
- [ ] ローカル開発手順
- [ ] 使用技術
- [ ] ライセンス情報

### 9.2 CHANGELOG.md 作成（オプション）
- [ ] 初回リリース（v1.0.0）の記録

---

## 実装順序の推奨

1. **Phase 1-2**: プロジェクト基盤整備とモジュール構造構築（1-2時間）
2. **Phase 3**: コアロジック実装（3-4時間）
3. **Phase 4**: メインアプリケーション統合（2-3時間）
4. **Phase 5**: デバッグ UI 実装（1-2時間）
5. **Phase 6**: テストとデバッグ（2-3時間）
6. **Phase 7**: 最適化と仕上げ（1-2時間）
7. **Phase 8**: デプロイ準備（1時間）
8. **Phase 9**: ドキュメント整備（1時間）

**合計推定工数**: 12-18時間

---

## 重要な実装ポイント

### 座標系の変換（Phase 3.4）
```javascript
// MediaPipe [0,1] → Three.js offset
const faceX = detection.boundingBox.originX + detection.boundingBox.width / 2;
const faceY = detection.boundingBox.originY + detection.boundingBox.height / 2;

const normalizedX = (faceX - 0.5) * 2;  // [-1, 1]
const normalizedY = (faceY - 0.5) * 2;  // [-1, 1]

const offsetX = normalizedX * (screenWidth / 2) * scale;
const offsetY = -normalizedY * (screenHeight / 2) * scale;  // Y軸反転！
```

### 顔検出のフレームレート制御（Phase 4.3）
```javascript
let frameCount = 0;
function animate() {
  requestAnimationFrame(animate);

  frameCount++;
  if (frameCount % 2 === 0) {
    // 2フレームに1回顔検出
    detectFace();
  }

  renderer.render(scene, camera);
}
```

### デフォルト視点への復帰（Phase 3.4）
```javascript
let noFaceTimer = 0;
const NO_FACE_TIMEOUT = 2000; // 2秒

function checkFaceDetection(detected) {
  if (!detected) {
    noFaceTimer += deltaTime;
    if (noFaceTimer > NO_FACE_TIMEOUT) {
      // デフォルト視点に復帰
      returnToDefaultView();
    }
  } else {
    noFaceTimer = 0;
  }
}
```

---

## トラブルシューティング

### カメラアクセスできない
- HTTPS で動作しているか確認（localhost は例外）
- ブラウザのカメラ許可設定を確認
- 他のアプリケーションがカメラを使用していないか確認

### 顔検出が不安定
- 照明条件を確認（明るい環境推奨）
- スムージング係数を大きくする（0.2-0.3）
- 信頼度閾値を下げる（0.3-0.4）

### パフォーマンスが悪い
- 顔検出フレームレートを下げる（3-4フレームに1回）
- カメラ解像度を下げる（320×240）
- グリッドの分割数を減らす（10×10）

---

## 完了基準

✅ すべての機能が正常に動作する
✅ 60fps で安定して動作する
✅ カメラアクセス、顔検出、off-axis projection が期待通りに動作
✅ エラーハンドリングが適切に機能する
✅ GitHub Pages にデプロイ済み
✅ README.md が整備されている
