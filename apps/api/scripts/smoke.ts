import { buildApp } from '../src/app.js';

const app = buildApp();
await app.ready();

const health = await app.inject({ method: 'GET', url: '/health' });
console.log('HEALTH', health.statusCode, health.body);

// Validação Zod: payload inválido deve retornar 400
const bad = await app.inject({
  method: 'POST',
  url: '/api/auth/login',
  payload: { email: 'nao-email', password: '' },
});
console.log('LOGIN_INVALID', bad.statusCode);

// Rota protegida sem token deve retornar 401
const noauth = await app.inject({ method: 'GET', url: '/api/auth/me' });
console.log('ME_NO_TOKEN', noauth.statusCode);

// Rota inexistente -> 404 padronizado
const notfound = await app.inject({ method: 'GET', url: '/api/inexistente' });
console.log('NOT_FOUND', notfound.statusCode);

await app.close();
console.log('SMOKE_OK');
