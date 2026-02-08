import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'fs'

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'))

// Plugin to inject version into version.ts
const versionPlugin = (): Plugin => {
  return {
    name: 'inject-version',
    transformIndexHtml(html) {
      // This doesn't help with the version.ts file
      return html
    },
    transform(code, id) {
      if (id.includes('config/version.ts')) {
        return code.replace(
          "export const APP_VERSION = '0.1.0'",
          `export const APP_VERSION = '${packageJson.version}'`
        )
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), versionPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5178,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared')
    }
  }
})
