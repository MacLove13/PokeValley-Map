const authStatus = document.getElementById('auth-status');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const controls = document.getElementById('controls');
const markerForm = document.getElementById('marker-form');
const imageForm = document.getElementById('image-form');
const toggleMarkers = document.getElementById('toggle-markers');
const toggleImages = document.getElementById('toggle-images');

const markerLat = document.getElementById('marker-lat');
const markerLng = document.getElementById('marker-lng');
const imageLat = document.getElementById('image-lat');
const imageLng = document.getElementById('image-lng');

const map = L.map('map').setView([-23.55, -46.63], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const imageLayer = L.layerGroup().addTo(map);

function fillCoordinates(lat, lng) {
  markerLat.value = lat.toFixed(6);
  markerLng.value = lng.toFixed(6);
  imageLat.value = lat.toFixed(6);
  imageLng.value = lng.toFixed(6);
}

map.on('click', (event) => {
  fillCoordinates(event.latlng.lat, event.latlng.lng);
});

loginBtn.addEventListener('click', () => {
  window.location.href = '/auth/discord';
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.reload();
});

async function loadState() {
  const response = await fetch('/api/state');
  if (!response.ok) {
    throw new Error('Falha ao carregar dados do mapa.');
  }

  const state = await response.json();

  markerLayer.clearLayers();
  imageLayer.clearLayers();

  state.markers.forEach((marker) => {
    const leafletMarker = L.marker([marker.lat, marker.lng]);
    if (marker.label) {
      leafletMarker.bindPopup(marker.label);
    }
    markerLayer.addLayer(leafletMarker);
  });

  state.images.forEach((image) => {
    const icon = L.icon({
      iconUrl: image.imageUrl,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    });

    const imageMarker = L.marker([image.lat, image.lng], { icon });
    imageMarker.bindPopup(
      `<strong>${image.label || 'Imagem'}</strong><br><img src="${image.imageUrl}" alt="${image.label || 'Imagem'}" style="max-width:200px;max-height:200px;">`,
    );
    imageLayer.addLayer(imageMarker);
  });
}

toggleMarkers.addEventListener('change', () => {
  if (toggleMarkers.checked) {
    map.addLayer(markerLayer);
  } else {
    map.removeLayer(markerLayer);
  }
});

toggleImages.addEventListener('change', () => {
  if (toggleImages.checked) {
    map.addLayer(imageLayer);
  } else {
    map.removeLayer(imageLayer);
  }
});

markerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const response = await fetch('/api/markers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: markerLat.value,
      lng: markerLng.value,
      label: document.getElementById('marker-label').value,
    }),
  });

  if (!response.ok) {
    alert('Não foi possível salvar o marcador.');
    return;
  }

  markerForm.reset();
  await loadState();
});

imageForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData();
  formData.set('lat', imageLat.value);
  formData.set('lng', imageLng.value);
  formData.set('label', document.getElementById('image-label').value);

  const fileInput = document.getElementById('image-file');
  if (!fileInput.files[0]) {
    alert('Selecione um arquivo PNG.');
    return;
  }

  formData.set('image', fileInput.files[0]);

  const response = await fetch('/api/images', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    alert('Não foi possível salvar a imagem. Use PNG.');
    return;
  }

  imageForm.reset();
  await loadState();
});

async function bootstrap() {
  const meResponse = await fetch('/api/me');
  const me = await meResponse.json();

  if (!me.authenticated) {
    controls.hidden = true;
    loginBtn.hidden = false;
    logoutBtn.hidden = true;

    if (!me.oauthConfigured) {
      authStatus.textContent = 'Configure DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e DISCORD_CALLBACK_URL no servidor.';
    } else {
      authStatus.textContent = 'Faça login com Discord para acessar o mapa.';
    }
    return;
  }

  authStatus.textContent = `Logado como ${me.user.username} (${me.user.id})`;
  controls.hidden = false;
  loginBtn.hidden = true;
  logoutBtn.hidden = false;

  await loadState();
}

bootstrap().catch((error) => {
  authStatus.textContent = error.message;
});
