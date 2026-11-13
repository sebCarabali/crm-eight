// Función serverless de Vercel: usa la app de NestJS compilada (npm run build → dist/).
// Todas las rutas /api/* y /docs se redirigen aquí (ver vercel.json).
module.exports = require('../dist/vercel').default;
