const initialCoordinates = { latitude: -15.793889, longitude: -47.882778 };
const latitudeInput = document.querySelector("#latitude");
const longitudeInput = document.querySelector("#longitude");
const output = document.querySelector("#coordinates");

let map;
let marker;

function normalizedCoordinates(latitude, longitude) {
  return { latitude: Number(Number(latitude).toFixed(6)), longitude: Number(Number(longitude).toFixed(6)) };
}

function showCoordinates(coordinates) {
  latitudeInput.value = coordinates.latitude;
  longitudeInput.value = coordinates.longitude;
  output.textContent = JSON.stringify({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    coordinates: `${coordinates.latitude},${coordinates.longitude}`,
  }, null, 2);
}

function updateSelection(latitude, longitude, pan = true) {
  const coordinates = normalizedCoordinates(latitude, longitude);
  marker.position = { lat: coordinates.latitude, lng: coordinates.longitude };
  if (pan) map.panTo(marker.position);
  showCoordinates(coordinates);
}

function readNumericFields() {
  const latitude = Number(latitudeInput.value);
  const longitude = Number(longitudeInput.value);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
  updateSelection(latitude, longitude);
}

export function initCoordinateSelector() {
  if (!window.google?.maps) {
    output.textContent = "Google Maps não foi carregado. Na aplicação Manus, use o componente MapView para inicializar o proxy de mapas.";
    return;
  }
  const position = { lat: initialCoordinates.latitude, lng: initialCoordinates.longitude };
  map = new window.google.maps.Map(document.querySelector("#map"), { center: position, zoom: 14, mapTypeControl: false, streetViewControl: false });
  marker = new window.google.maps.marker.AdvancedMarkerElement({ map, position, title: "Coordenada da ocorrência", gmpDraggable: true });
  map.addListener("click", event => { if (event.latLng) updateSelection(event.latLng.lat(), event.latLng.lng(), false); });
  marker.addListener("dragend", event => { if (event.latLng) updateSelection(event.latLng.lat(), event.latLng.lng(), false); });
  latitudeInput.addEventListener("change", readNumericFields);
  longitudeInput.addEventListener("change", readNumericFields);
  showCoordinates(initialCoordinates);
}

initCoordinateSelector();
