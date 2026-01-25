import { resolve } from 'path'
import glsl from 'vite-plugin-glsl'

export default {
  root: './', // ルートをプロジェクトルートに変更
  publicDir: 'static/',
  base: process.env.NODE_ENV === 'production' ? '/off_axis_projection_demo/' : '/',
  server:
  {
    host: true, // Open to local network and display URL
    open: '/src/index.html' // Campfireバージョンを開く
  },
  build:
  {
    outDir: 'dist', // Output in the dist/ folder
    emptyOutDir: true, // Empty the folder first
    sourcemap: true,    // Add sourcemap
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'), // 元のCubeバージョンをmain
        skybox: resolve(__dirname, 'src/index-campfire.html'),
        tutorials: resolve(__dirname, 'tutorials/index.html'),
        step1: resolve(__dirname, 'tutorials/step1.html'),
        step2: resolve(__dirname, 'tutorials/step2.html'),
        // 今後のフェーズを追加予定
        // step3: resolve(__dirname, 'tutorials/step3.html'),
        // step4: resolve(__dirname, 'tutorials/step4.html'),
        // step5: resolve(__dirname, 'tutorials/step5.html'),
        // step6: resolve(__dirname, 'tutorials/step6.html'),
        // step7: resolve(__dirname, 'tutorials/step7.html'),
        // step8: resolve(__dirname, 'tutorials/step8.html'),
        // step9: resolve(__dirname, 'tutorials/step9.html'),
        // step10: resolve(__dirname, 'tutorials/step10.html'),
      }
    }
  },
  // Three.jsでよく使うアセット形式を追加
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr', '**/*.exr'],
  // Plugins の追加
  plugins:
    [
      glsl() // Handle shader files
    ]
}