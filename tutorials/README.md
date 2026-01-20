# Off-Axis Projection Demo - Learning Tutorials

このチュートリアルシリーズでは、MediaPipe Face Detectionと Three.jsを使った「off-axis projection」デモを1から構築する方法を学びます。

## 🎯 対象者

- **レベル**: 中級者(Three.js基礎経験あり)
- **前提知識**: JavaScript ES6+、基本的な3Dグラフィックスの概念
- **学習目標**: MediaPipe統合、off-axis projection理論、視線追跡の可視化

---

## 📚 チュートリアル構成(全10フェーズ)

### Phase 1: Three.js基本シーンセットアップ
**ファイル**: [step1-basic-scene.js](step1-basic-scene.js)

**学ぶこと**:
- Three.jsレンダラー、シーン、カメラの初期化
- グリッドと3Dオブジェクトの追加
- アニメーションループの実装

**成功基準**:
- グリッド床の上で回転するキューブが表示される
- 60fpsでスムーズにレンダリングされる
- ウィンドウリサイズに対応

---

### Phase 2: Webカメラアクセス
**ファイル**: [step2-camera-access.js](step2-camera-access.js)

**学ぶこと**:
- `getUserMedia` APIでカメラアクセス
- ビデオストリームの表示とミラーリング
- エラーハンドリング(カメラ許可拒否など)

**成功基準**:
- 画面右下にミラーリングされたWebカメラプレビューが表示される
- カメラアクセスエラー時に適切なメッセージ表示

---

### Phase 3: MediaPipe顔検出
**ファイル**: [step3-face-detection.js](step3-face-detection.js)

**学ぶこと**:
- MediaPipe Face Detection モデルの読み込み
- ビデオフレームからの顔検出(30fps)
- 正規化座標 [0,1] の取得

**成功基準**:
- リアルタイムで顔が検出される
- ビデオオーバーレイにバウンディングボックス表示
- 信頼度スコアが表示される

---

### Phase 4: 座標変換
**ファイル**: [step4-coordinate-transform.js](step4-coordinate-transform.js)

**学ぶこと**:
- MediaPipe正規化座標 → Three.js物理座標への変換
- ミラーリング(X軸反転)
- Y軸の反転(MediaPipe: 左上原点 vs Three.js: 中心原点)

**成功基準**:
- 頭を左に動かす → eyeX増加(ミラー効果)
- 頭を上に動かす → eyeY増加(Y軸反転)
- コンソールに物理座標(cm単位)が表示される

---

### Phase 5: スムージング (EMA)
**ファイル**: [step5-smoothing.js](step5-smoothing.js)

**学ぶこと**:
- Exponential Moving Average (EMA) アルゴリズム
- X, Y, Z軸それぞれの独立したスムージング
- Alpha値による強度調整

**成功基準**:
- ジッターする生座標 → スムーズなカメラ移動
- GUIスライダーでスムージング強度を調整可能
- Alpha = 0.1で遅延を感じない

---

### Phase 6: Off-Axis Projection
**ファイル**: [step6-off-axis-projection.js](step6-off-axis-projection.js)

**学ぶこと**:
- 非対称視錐台(frustum)の計算
- カスタム投影行列の構築
- カメラ位置と視線方向の動的更新

**視覚効果**:
- 頭を左に動かす → シーンの右側がより見える
- 頭を上に動かす → シーンの下側がより見える
- 近づく → パースペクティブが誇張される

**成功基準**:
- グリッドが画面の「奥」に存在するように見える
- 視差効果が頭の動きで確認できる
- 中心位置で歪みがない

---

### Phase 7: 視線方向の可視化 🆕
**ファイル**: [step7-gaze-visualization.js](step7-gaze-visualization.js)

**学ぶこと**:
- MediaPipe **Face Landmarker** へのアップグレード(478ランドマーク)
- 目のランドマーク(左右の虹彩中心)の抽出
- 視線ベクトルの計算

**実装内容**:

#### 7.1 2Dオーバーレイ可視化
- ビデオキャンバスに目のランドマークを描画(シアン色の円)
- 顔の中心から視線方向への矢印
- 信頼度による色分け(緑=高、黄=中、赤=低)

#### 7.2 3Dシーンでの視線レイ
- カメラ位置から視線方向へのレイを投射
- Three.js `ArrowHelper` でレイを可視化
- シーンのジオメトリ(グリッド/キューブ)との交差点を表示

**成功基準**:
- 目のランドマークがシアンドットで正確に追跡される
- 視線矢印がユーザーの視線方向を指す
- 3Dレイがリアルタイムで更新される
- キューブを見るとレイが交差点をハイライト

---

### Phase 8: UXポリッシュ
**ファイル**: [step8-ux-polish.js](step8-ux-polish.js)

**学ぶこと**:
- ローディング画面の実装
- 「顔が検出されません」警告バナー(2秒後表示)
- デフォルトビューへの自動復帰(スムーズアニメーション)

**成功基準**:
- 初期化中にスピナー表示
- 顔未検出が2秒続くと警告表示
- カメラが滑らかに(0, 0, 60)へ戻る

---

### Phase 9: Debug UI (lil-gui)
**ファイル**: [step9-debug-ui.js](step9-debug-ui.js)

**学ぶこと**:
- lil-guiライブラリの統合
- パラメータフォルダーの作成
- `.listen()` によるリアルタイム値更新

**GUIパラメータ**:
- **Parameters**: Smoothing, Scale, Viewing Distance, Screen Width
- **Debug**: Show Video, Show Stats
- **Camera Position**: Manual X/Y, Manual Mode
- **Gaze Visualization**: Show Gaze Ray, Show Landmarks, Ray Length

**成功基準**:
- 全パラメータがリアルタイムで反映
- カメラ位置が `.listen()` でライブ更新
- フォルダーが折りたたみ可能

---

### Phase 10: パフォーマンス最適化
**ファイル**: [step10-optimization.js](step10-optimization.js)

**学ぶこと**:
- フレームカウンターによる顔検出の間引き(2フレームに1回)
- MediaPipeでのGPUデリゲーション
- Stats.js統合によるFPSモニタリング
- Page Visibility APIで非アクティブ時のスキップ

**パフォーマンス目標**:
- Three.jsレンダリング: 60fps (16.67ms/frame)
- 顔検出: 30fps (33.33ms/call)
- メモリ: 5分間安定(リークなし)

**成功基準**:
- Stats.jsパネルで一貫して60fps表示
- 頭の動きでフレームドロップなし
- メモリ使用量が安定

---

## 🚀 クイックスタート

### 各チュートリアルの実行方法

1. **開発サーバーを起動** (プロジェクトルート):
   ```bash
   npm install
   npm run dev
   ```

2. **チュートリアルファイルを開く**:
   - `tutorials/step1-basic-scene.js` などを直接ブラウザで開く
   - または `tutorials/assets/index.html` をコピーして `<script>` タグを変更

3. **各フェーズの動作確認**:
   - コンソールログを確認
   - 期待される出力と比較(`tutorials/images/` 内のスクリーンショット参照)

### 推奨学習フロー

```
Phase 1-2 (基礎)
   ↓
Phase 3-4 (MediaPipe統合)
   ↓
Phase 5-6 (off-axis projection コア)
   ↓
Phase 7 (新機能: 視線可視化) ← メイン
   ↓
Phase 8-9 (UX改善)
   ↓
Phase 10 (最適化)
```

---

## 📖 詳細ドキュメント

詳細な理論的背景やコード例は [`docs/`](docs/) フォルダ内のドキュメントを参照してください:

- **[learning-guide.md](docs/learning-guide.md)**: 各フェーズの概念説明 + コード課題
- **[challenges.md](docs/challenges.md)**: 発展課題(マルチフェイス、録画再生、ネットワーキングなど)
- **[off-axis-projection.md](docs/off-axis-projection.md)**: Off-axis projection理論と数式
- **[coordinate-systems.md](docs/coordinate-systems.md)**: MediaPipe ↔ Three.js 座標変換
- **[gaze-estimation.md](docs/gaze-estimation.md)**: 視線推定技術の詳細
- **[performance.md](docs/performance.md)**: パフォーマンス最適化戦略
- **[mediapipe-models.md](docs/mediapipe-models.md)**: MediaPipeモデル比較

---

## 🔍 各フェーズの差分確認

各ステップ間の変更点を確認するには:

```bash
# Phase 1 と Phase 2 の差分
diff tutorials/step1-basic-scene.js tutorials/step2-camera-access.js

# または Git diff形式で(もし各フェーズがコミットされていれば)
git diff phase1..phase2
```

---

## 🧪 テスト・検証方法

### Phase 1-2: 視覚的検証
- シーンが正しくレンダリングされるか
- ビデオフィードが表示されミラーリングされているか

### Phase 3-4: コンソールログ確認
- 2フレームごとに顔座標がログされるか
- 物理座標が期待範囲内(±20cm X、±15cm Y)か

### Phase 5: スムージングON/OFF比較
- 生データはジッター、スムージング後は安定

### Phase 6: 視差テスト
- 頭を左 → キューブの右側がより見える
- 頭を上 → グリッドの下側がより見える

### Phase 7: 視線可視化
- 目のランドマークが実際の目の位置を追跡
- 視線矢印がユーザーの見ている方向を指す
- 3Dレイがオブジェクトと正しく交差

### Phase 8-9: UXテスト
- ローディング画面が短時間表示
- 顔未検出2秒後に警告バナー
- GUIコントロールがスムーズに調整可能

### Phase 10: パフォーマンス計測
- Stats.jsで一貫して60fps
- Chrome DevTools Performanceで30fps検出を確認
- Memory タブで5分間メモリ増加なし

---

## 🐛 トラブルシューティング

### カメラアクセスできない
- HTTPSまたは `localhost` で実行しているか確認
- ブラウザのカメラ許可設定を確認
- 他のアプリがカメラを使用していないか確認

### MediaPipeモデル読み込みエラー
- インターネット接続を確認(CDNからモデル読み込み)
- ブラウザコンソールでネットワークエラーを確認
- CORSエラーの場合は開発サーバーを使用

### 顔が検出されない
- 照明が十分か確認
- 顔がカメラに正面から向いているか
- 信頼度しきい値(0.5)を下げてテスト

### パフォーマンスが悪い
- Chrome最新版を使用
- GPU加速が有効か確認(`chrome://gpu`)
- 他のタブを閉じてリソース確保
- ビデオ解像度を下げる(640×480推奨)

---

## 📝 解答例

各フェーズの完全な実装は [`solutions/`](solutions/) フォルダにあります:
- `step1-solution.js` ~ `step10-solution.js`
- コメント付きで設計判断を説明
- 代替アプローチも記載

---

## 🎓 学習後のNext Steps

### 発展課題([challenges.md](docs/challenges.md)参照)
1. **マルチフェイス対応**: 複数人の顔を同時追跡
2. **カスタムシーン**: GLB/GLTFモデルのロード、視線で選択するUI
3. **録画・再生**: 顔トラッキングデータの記録とJSON出力
4. **高度な視線追跡**: まばたき検出、視線ヒートマップ
5. **ネットワーク対応**: WebRTCでマルチユーザー共有空間

### 本番環境への展開
- ブラウザ互換性テスト(Safari、Firefox)
- モバイル対応検討
- アクセシビリティ対応
- パフォーマンス解析とCDN最適化

---

## 🤝 貢献・フィードバック

バグや改善提案がある場合は、プロジェクトのIssueトラッカーへ報告してください。

---

**Happy Learning! 🎉**

このチュートリアルを通じて、MediaPipe、Three.js、off-axis projectionの深い理解が得られることを願っています。
