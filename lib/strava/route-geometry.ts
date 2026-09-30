export function routeGeometry(encoded: string) {
  if (!encoded || encoded.length > 100000) return null;
  const points: Array<[number, number]> = []; let index = 0, lat = 0, lng = 0;
  const read = () => {
    let value = 0, shift = 0, byte = 0;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid polyline');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid polyline');
      value |= (byte & 31) << shift; shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  };
  try {
    while (index < encoded.length) {
      lat += read(); lng += read();
      if (Math.abs(lat / 1e5) > 90 || Math.abs(lng / 1e5) > 180) return null;
      const longitude = lng / 1e5;
      // Unwrap across the date line before fitting the route.
      const prior = points[points.length - 1]?.[0];
      const x = prior === undefined ? longitude : longitude + 360 * Math.round((prior - longitude) / 360);
      const latitude = Math.max(-85, Math.min(85, lat / 1e5)) * Math.PI / 180;
      points.push([x, -Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * 180 / Math.PI]);
    }
  } catch { return null; }
  if (points.length < 2) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x,y] of points) { minX = Math.min(minX,x); maxX = Math.max(maxX,x); minY = Math.min(minY,y); maxY = Math.max(maxY,y); }
  if (maxX === minX && maxY === minY) return null;
  const scale = Math.min(520 / Math.max(maxX-minX, .000001), 220 / Math.max(maxY-minY, .000001));
  const project = ([x,y]: [number,number]) => [300 + (x-(minX+maxX)/2)*scale, 140 + (y-(minY+maxY)/2)*scale];
  const step = Math.max(1, Math.ceil(points.length / 2500));
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1).map(project);
  return { path: sampled.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '), start: sampled[0], end: sampled[sampled.length-1] };
}
