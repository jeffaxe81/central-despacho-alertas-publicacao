import { MapView } from "@/components/Map";
import { Crosshair, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export type Coordinates = { latitude: number; longitude: number };

export function normalizeCoordinates(coordinates: Coordinates): Coordinates {
  return {
    latitude: Number(coordinates.latitude.toFixed(6)),
    longitude: Number(coordinates.longitude.toFixed(6)),
  };
}

export function coordinatesFromStaticMapClick(input: {
  center: Coordinates;
  clickX: number;
  clickY: number;
  width: number;
  height: number;
  zoom?: number;
}): Coordinates {
  const zoom = input.zoom ?? 14;
  const worldSize = 256 * 2 ** zoom;
  const centerX = ((input.center.longitude + 180) / 360) * worldSize;
  const centerLatitudeRadians = (input.center.latitude * Math.PI) / 180;
  const centerY = (1 - Math.log(Math.tan(centerLatitudeRadians) + 1 / Math.cos(centerLatitudeRadians)) / Math.PI) * worldSize / 2;
  const mapX = centerX + ((input.clickX / input.width) - 0.5) * 640;
  const mapY = centerY + ((input.clickY / input.height) - 0.5) * 360;
  const longitude = (mapX / worldSize) * 360 - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * mapY) / worldSize))) * 180) / Math.PI;
  return normalizeCoordinates({ latitude, longitude });
}

const SUGGESTED_LOCATION: Coordinates = {
  latitude: -15.793889,
  longitude: -47.882778,
};

type CoordinatePickerProps = {
  value: Coordinates;
  onChange: (coordinates: Coordinates) => void;
  title?: string;
  description?: string;
  markerTitle?: string;
};

export function CoordinatePicker({ value, onChange, title = "Localização do alerta", description = "Clique no mapa ou arraste o marcador para definir a posição enviada à central.", markerTitle = "Coordenada do alerta" }: CoordinatePickerProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const onChangeRef = useRef(onChange);
  const [interactiveUnavailable, setInteractiveUnavailable] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !window.google) return;
    const position = { lat: value.latitude, lng: value.longitude };
    markerRef.current.position = position;
    mapRef.current.panTo(position);
  }, [value.latitude, value.longitude]);

  const setCoordinates = (coordinates: Coordinates) => {
    onChangeRef.current(normalizeCoordinates(coordinates));
  };

  const staticMapUrl = `/api/maps/static?lat=${encodeURIComponent(value.latitude)}&lng=${encodeURIComponent(value.longitude)}`;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30">
      <div className="flex flex-col gap-3 border-b border-slate-700 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-200"><MapPin className="h-4 w-4 text-cyan-300" />{title}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setCoordinates(SUGGESTED_LOCATION)} className="border-cyan-300/25 bg-cyan-300/5 text-cyan-200 hover:bg-cyan-300/10">
          <Crosshair className="mr-2 h-3.5 w-3.5" />Usar sugestão
        </Button>
      </div>
      {interactiveUnavailable ? (
        <div className="space-y-3 p-3"><img src={staticMapUrl} alt="Mapa estático da coordenada selecionada" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setCoordinates(coordinatesFromStaticMapClick({ center: value, clickX: event.clientX - rect.left, clickY: event.clientY - rect.top, width: rect.width, height: rect.height })); }} className="h-64 w-full cursor-crosshair rounded-lg object-cover sm:h-80" /><p className="text-xs text-amber-200">Clique no mapa para definir a coordenada. Se preferir precisão numérica, ajuste os campos abaixo; o marcador será atualizado.</p><div className="grid grid-cols-2 gap-3"><Input aria-label="Latitude" type="number" step="0.000001" value={value.latitude} onChange={event => setCoordinates({ ...value, latitude: Number(event.target.value) })} className="border-slate-700 bg-slate-950/40 text-slate-100" /><Input aria-label="Longitude" type="number" step="0.000001" value={value.longitude} onChange={event => setCoordinates({ ...value, longitude: Number(event.target.value) })} className="border-slate-700 bg-slate-950/40 text-slate-100" /></div></div>
      ) : <MapView
        className="h-64 sm:h-80"
        initialCenter={{ lat: value.latitude, lng: value.longitude }}
        initialZoom={14}
        onMapError={() => setInteractiveUnavailable(true)}
        onMapReady={map => {
          mapRef.current = map;
          const marker = new window.google!.maps.marker.AdvancedMarkerElement({
            map,
            position: { lat: value.latitude, lng: value.longitude },
            title: markerTitle,
            gmpDraggable: true,
          });
          markerRef.current = marker;
          map.addListener("click", (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;
            setCoordinates({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
          });
          marker.addListener("dragend", (event: google.maps.MapMouseEvent) => {
            const position = event.latLng;
            if (!position) return;
            setCoordinates({ latitude: position.lat(), longitude: position.lng() });
          });
        }}
      />}
    </section>
  );
}
