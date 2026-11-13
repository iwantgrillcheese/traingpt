// Google/Strava encoded polylines use latitude/longitude deltas at 1e5 precision.
export type RouteCoordinate = readonly [latitude: number, longitude: number];

export function decodeRouteCoordinates(encoded: string): RouteCoordinate[] | null {
  if (!encoded || encoded.length > 100000) return null;

  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const points: RouteCoordinate[] = [];

  const read = () => {
    let value = 0;
    let shift = 0;
    let byte = 0;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid polyline');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid polyline');
      value |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  };

  try {
    while (index < encoded.length) {
      latitude += read();
      longitude += read();
      if (Math.abs(latitude / 1e5) > 90 || Math.abs(longitude / 1e5) > 180) return null;

      // Unwrap the date line so both Leaflet and our SVG fit the shorter path.
      let lng = longitude / 1e5;
      const previousLng = points[points.length - 1]?.[1];
      if (previousLng !== undefined) lng += 360 * Math.round((previousLng - lng) / 360);
      points.push([latitude / 1e5, lng]);
    }
  } catch {
    return null;
  }

  if (points.length < 2 || points.every(point => point[0] === points[0][0] && point[1] === points[0][1])) return null;
  return points;
}

// Lightweight fallback when third-party street-map tiles are unavailable.
export function routeGeometry(encoded: string) {
  const coordinates = decodeRouteCoordinates(encoded);
  if (!coordinates) return null;

  const points: Array<[number, number]> = coordinates.map(([latitude, longitude]) => {
    const mercatorLatitude = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180;
    return [longitude, -Math.log(Math.tan(Math.PI / 4 + mercatorLatitude / 2)) * 180 / Math.PI];
  });

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }

  const scale = Math.min(520 / Math.max(maxX - minX, .000001), 220 / Math.max(maxY - minY, .000001));
  const project = ([x, y]: [number, number]) => [
    300 + (x - (minX + maxX) / 2) * scale,
    140 + (y - (minY + maxY) / 2) * scale,
  ];
  const step = Math.max(1, Math.ceil(points.length / 2500));
  const sampled = points
    .filter((_, i) => i % step === 0 || i === points.length - 1)
    .map(project);

  return {
    path: sampled.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)).join(' '),
    start: sampled[0],
    end: sampled[sampled.length - 1],
  };
}
