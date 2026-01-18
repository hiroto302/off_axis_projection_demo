import glsl from 'vite-plugin-glsl'

export default {
  root: 'src/',
  publicDir: '../static/',
  base: './',
  server:
  {
    host: true, // Open to local network and display URL
    open: true  // Open
  },
  build:
  {
    outDir: '../dist', // Output in the dist/ folder
    emptyOutDir: true, // Empty the folder first
    sourcemap: true    // Add sourcemap
  },
  // Three.jsでよく使うアセット形式を追加
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr', '**/*.exr'],
  // Plugins の追加
  plugins:
    [
      glsl() // Handle shader files
    ]
}