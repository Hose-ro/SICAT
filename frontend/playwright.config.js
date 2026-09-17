import { defineConfig } from '@playwright/test'
export default defineConfig({
 testDir:'tests/e2e',fullyParallel:false,workers:1,timeout:30000,
 use:{baseURL:'http://127.0.0.1:4175',serviceWorkers:'block',trace:'retain-on-failure',reducedMotion:'reduce'},
 reporter:[['list'],['json',{outputFile:'audit/e2e-results.json'}]],
 webServer:[
  {command:'npx vite --config vite.audit.config.js',url:'http://127.0.0.1:4175',reuseExistingServer:false},
  {command:'node scripts/serve-audit.mjs',url:'http://127.0.0.1:4176',reuseExistingServer:false},
 ],
})
