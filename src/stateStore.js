const fs = require('fs');
const path = require('path');

const stateFilePath = path.join(__dirname, '..', 'data', 'map-state.json');

function ensureStateFile() {
  if (!fs.existsSync(stateFilePath)) {
    fs.writeFileSync(stateFilePath, JSON.stringify({ markers: [], images: [] }, null, 2));
  }
}

function readState() {
  ensureStateFile();
  const raw = fs.readFileSync(stateFilePath, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    images: Array.isArray(parsed.images) ? parsed.images : [],
  };
}

function writeState(nextState) {
  fs.writeFileSync(stateFilePath, JSON.stringify(nextState, null, 2));
}

function addMarker(marker) {
  const state = readState();
  state.markers.push(marker);
  writeState(state);
  return marker;
}

function addImage(image) {
  const state = readState();
  state.images.push(image);
  writeState(state);
  return image;
}

module.exports = {
  readState,
  addMarker,
  addImage,
  stateFilePath,
};
