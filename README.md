# Off-Axis Projection Demo

MediaPipe Face Detection と Three.js を使用した **off-axis projection（非対称視錐台投影）** のデモアプリケーションです。ユーザーの顔位置をリアルタイムでトラッキングし、ディスプレイがあたかも3D空間への「窓」のように見える効果を実現します。

![Off-Axis Projection Demo](https://img.shields.io/badge/status-deployed-success)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🎥 デモ

**Live Demo:** [https://snsnap1159.github.io/off_axis_projection_demo/](https://snsnap1159.github.io/off_axis_projection_demo/)

> ⚠️ **注意:** カメラアクセスが必須です。Google Chrome（最新版）の使用を推奨します。

## ✨ 特徴

- 📹 **リアルタイム顔トラッキング**: MediaPipe Face Detectionによる高精度な顔位置検出
- 🎬 **Off-Axis Projection**: 頭の動きに応じて3D空間の視点が動的に変化
- 🎮 **インタラクティブなデバッグUI**: lil-guiによるリアルタイムパラメータ調整
- ⚡ **高パフォーマンス**: 60fps安定動作（顔検出30fps + レンダリング60fps）
- 📱 **HTTPS対応**: GitHub Pagesでセキュアにデプロイ

## 🚀 使い方

1. デモページにアクセス
2. カメラアクセスを許可
3. 顔をカメラに向ける
4. 頭を左右・前後に動かして3D空間を探索！

## 🛠 技術スタック

- **[Three.js](https://threejs.org/)** (r161以降) - 3Dレンダリングエンジン
- **[MediaPipe Face Detection](https://developers.google.com/mediapipe/solutions/vision/face_detector)** - 顔トラッキング
- **[Vite](https://vitejs.dev/)** - 開発サーバー＆ビルドツール
- **[lil-gui](https://lil-gui.georgealways.com/)** - パラメータ調整UI
- **Vanilla JavaScript** - フレームワークレス実装

## 📦 ローカル開発

### 前提条件

- Node.js 18以降
- npm または yarn
- Webカメラ搭載デバイス

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/snsnap1159/off_axis_projection_demo.git
cd off_axis_projection_demo

# 依存関係をインストール
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```
ブラウザで `http://localhost:5173` を開きます。
> ⚠️ **HTTPS注意:** カメラアクセスには通常HTTPSが必要ですが、`localhost`は例外として許可されます。

### ビルド

```bash
npm run build
```

`dist/` ディレクトリにプロダクションビルドが生成されます。

### プレビュー

```bash
npm run preview
```

ビルドされたアプリケーションをローカルでプレビューできます。

## 🎛 パラメータ調整

画面右上のlil-guiパネルから以下のパラメータを調整できます：

| パラメータ | 範囲 | デフォルト | 説明 |
|----------|------|-----------|------|
| **Smoothing** | 0.01 - 0.5 | 0.1 | 頭部移動のスムージング強度（低い=滑らか、高い=反応速） |
| **Scale** | 0.5 - 5.0 | 2.0 | 頭部移動とカメラオフセットの倍率 |
| **Viewing Distance** | 30 - 100cm | 60cm | 想定視聴距離（ディスプレイからの距離） |
| **Screen Width** | 20 - 50cm | 33.8cm | ディスプレイの物理幅 |
| **Show Video** | - | OFF | カメラ映像を画面に表示（デバッグ用） |
| **Show Stats** | - | OFF | FPSカウンターを表示 |

## 🏗 プロジェクト構成

```
off_axis_projection_demo/
├── src/
│   ├── main.js                    # アプリケーションエントリーポイント
│   ├── style.css                  # スタイル定義
│   ├── modules/
│   │   ├── faceDetector.js       # MediaPipe Face Detection管理
│   │   ├── threeScene.js         # Three.jsシーン構築
│   │   ├── cameraController.js   # Off-axis projection計算
│   │   └── smoothing.js          # EMAスムージング実装
├── index.html                     # HTMLエントリーポイント
├── vite.config.js                # Vite設定
├── package.json                  # 依存関係
├── TODO.md                       # 実装計画
├── CLAUDE.md                     # プロジェクト仕様書
└── README.md                     # このファイル
```

## 🔬 技術仕様

### Off-Axis Projection実装

**カスタムFrustum計算方式**を採用（`PerspectiveCamera.setViewOffset()`は使用せず）：

- 視点位置に基づいてカスタム視錐台（frustum）を計算
- `camera.projectionMatrix.makePerspective()`で直接プロジェクション行列を設定
- カメラ位置を視点位置に移動し、スクリーン平面（Z=0）を見るように設定

**物理パラメータ（デフォルト）:**
- 画面サイズ: 33.8cm × 19.0cm（15.4インチ、16:9想定）
- 視聴距離: 60cm
- 視野角（FOV）: 50度

### 座標変換

MediaPipe正規化座標 `[0, 1]` → Three.js物理座標（cm単位）：

```javascript
// 顔中心座標を取得
const faceX = detection.boundingBox.originX + detection.boundingBox.width / 2;
const faceY = detection.boundingBox.originY + detection.boundingBox.height / 2;

// 正規化座標 [-1, 1] に変換
const normalizedX = (faceX - 0.5) * 2;
const normalizedY = (faceY - 0.5) * 2;

// 物理座標に変換（Y軸反転に注意）
const offsetX = normalizedX * (screenWidth / 2) * scale;
const offsetY = -normalizedY * (screenHeight / 2) * scale;
```

### スムージング

**アルゴリズム:** Exponential Moving Average (EMA)

```javascript
smoothedValue = previousValue × (1 - alpha) + newValue × alpha
```

- X/Y軸: alpha = 0.1
- Z軸: alpha = 0.15（より強めのスムージング）

## 🎯 動作要件

- **ブラウザ:** Google Chrome（最新版）推奨
- **カメラ:** Webカメラ必須
- **環境:** HTTPS接続（localhost除く）
- **WebGL:** 対応必須

## 🐛 トラブルシューティング

### カメラアクセスできない

- ブラウザのカメラ許可設定を確認
- HTTPS接続であることを確認（localhost除く）
- 他のアプリケーションがカメラを使用していないか確認

### 顔検出が不安定

- 照明条件を改善（明るい環境推奨）
- lil-guiでSmoothingを大きく（0.2-0.3）
- 正面からカメラを見る

### パフォーマンスが悪い

- 他のタブやアプリケーションを閉じる
- ハードウェアアクセラレーションが有効か確認
- lil-guiでScaleを小さく調整

## 📄 ライセンス

MIT License

Copyright (c) 2026 Hiroto302

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🙏 謝辞

- [Three.js](https://threejs.org/) - 3Dグラフィックスライブラリ
- [MediaPipe](https://developers.google.com/mediapipe) - 機械学習ソリューション
- [Johnny Lee's Head Tracking Demo](https://www.youtube.com/watch?v=Jd3-eiid-Uw) - インスピレーション元

## 📚 参考資料

- [Off-Axis Projection (Wikipedia)](https://en.wikipedia.org/wiki/Off-axis_projection)
- [Three.js Documentation](https://threejs.org/docs/)
- [MediaPipe Face Detection Guide](https://developers.google.com/mediapipe/solutions/vision/face_detector)

---
