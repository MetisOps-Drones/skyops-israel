/** Builds a Mapbox Static Images API URL showing a flight bubble, for lightweight non-interactive previews (Module B's request detail drawer). */
export function buildStaticBubbleMapUrl(params: {
  center: [number, number];
  geojsonOverlay: GeoJSON.Feature;
  width?: number;
  height?: number;
}): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const { center, geojsonOverlay, width = 600, height = 320 } = params;

  const overlay = encodeURIComponent(
    JSON.stringify({
      ...geojsonOverlay,
      properties: { stroke: "#dc2626", "stroke-width": 2, fill: "#dc2626", "fill-opacity": 0.25 },
    })
  );

  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/geojson(${overlay})/${center[0]},${center[1]},12,0/${width}x${height}@2x?access_token=${token}`;
}
