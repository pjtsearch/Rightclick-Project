import { defineConfig } from "vite"

export default defineConfig({
  server: {
    proxy: {
      "/customers": "http://localhost:3000",
      "/equipment": "http://localhost:3000",
      "/laborRates": "http://localhost:3000",
      "/quotes": "http://localhost:3000",
    },
  },
})
