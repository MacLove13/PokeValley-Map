const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const { app, authorizedDiscordIds } = require('../src/server');
const { stateFilePath } = require('../src/stateStore');

function resetState() {
  fs.writeFileSync(stateFilePath, JSON.stringify({ markers: [], images: [] }, null, 2));
}

test.beforeEach(() => {
  resetState();
});

async function fetchCsrf(agent, discordId) {
  const meResponse = await agent.get('/api/me').set('x-test-discord-id', discordId);
  return meResponse.body.csrfToken;
}

test('blocks unauthenticated access to map state', async () => {
  const response = await request(app).get('/api/state');
  assert.equal(response.statusCode, 401);
});

test('blocks unauthorized discord ids', async () => {
  const response = await request(app).get('/api/state').set('x-test-discord-id', '1');
  assert.equal(response.statusCode, 403);
});

test('allows authorized discord id to create marker and read shared state', async () => {
  const allowedId = authorizedDiscordIds[0];
  const agent = request.agent(app);
  const csrfToken = await fetchCsrf(agent, allowedId);

  const markerResponse = await agent
    .post('/api/markers')
    .set('x-test-discord-id', allowedId)
    .set('x-csrf-token', csrfToken)
    .send({ lat: -23.5, lng: -46.6, label: 'Centro' });

  assert.equal(markerResponse.statusCode, 201);

  const stateResponse = await agent
    .get('/api/state')
    .set('x-test-discord-id', allowedId);

  assert.equal(stateResponse.statusCode, 200);
  assert.equal(stateResponse.body.markers.length, 1);
  assert.equal(stateResponse.body.markers[0].label, 'Centro');
});

test('accepts png image upload only', async () => {
  const allowedId = authorizedDiscordIds[0];
  const pngPath = path.join(__dirname, 'fixtures', 'tiny.png');
  const agent = request.agent(app);
  const csrfToken = await fetchCsrf(agent, allowedId);

  const response = await agent
    .post('/api/images')
    .set('x-test-discord-id', allowedId)
    .set('x-csrf-token', csrfToken)
    .field('lat', '-23.5')
    .field('lng', '-46.6')
    .field('label', 'Sprite')
    .attach('image', pngPath, { contentType: 'image/png' });

  assert.equal(response.statusCode, 201);

  const stateResponse = await agent
    .get('/api/state')
    .set('x-test-discord-id', allowedId);

  assert.equal(stateResponse.body.images.length, 1);
  assert.match(stateResponse.body.images[0].imageUrl, /^\/uploads\//);
});
