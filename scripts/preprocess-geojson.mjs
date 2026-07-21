#!/usr/bin/env node
/**
 * Preprocess Tunisian sector (secteur / imada) boundaries.
 *
 * Input (source: HDX COD-AB Tunisia, admin level 4 = secteurs/imadas):
 *   https://data.humdata.org/dataset/cod-ab-tun
 *   File: tun_admin4.geojson (saved here as raw-sectors.geojson)
 *
 *   Feature properties include:
 *     - adm4_name / adm4_ref_name / adm4_name1 : sector name (Latin / Arabic)
 *     - adm4_pcode                             : unique sector code (e.g. "TN115151")
 *     - adm3_name / adm3_pcode                 : parent delegation
 *     - adm2_name / adm2_pcode                 : parent governorate
 *
 * Output: normalized GeoJSON at public/data/tn-sectors.geojson
 *   - id           : adm4_pcode  (unique sector id, used as selection key)
 *   - name         : sector (imada) name
 *   - delegation   : parent delegation name
 *   - delegationId : adm3_pcode  (used as the Firestore report zoneId — reports
 *                    and map coloring are aggregated at the delegation level)
 *   - governorate  : parent governorate name
 *
 * Also:
 *   - Douglas-Peucker simplification (tolerance in degrees)
 *   - Coordinate rounding (~11 m precision with 4 decimals)
 *   - Strips all other properties to keep the file small
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(__dirname, 'raw-sectors.geojson');
const OUTPUT = resolve(__dirname, '..', 'public', 'data', 'tn-sectors.geojson');

// Sectors are much smaller than delegations, so a tighter tolerance preserves
// the shape of small urban imadas while still trimming redundant vertices.
// ~0.0008 degrees ~= 80 m.
const TOLERANCE = 0.0008;
const COORD_DECIMALS = 4;

function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function round(n) {
  const p = 10 ** COORD_DECIMALS;
  return Math.round(n * p) / p;
}

// Perpendicular distance from point p to line segment ab (in degrees).
function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const tc = Math.max(0, Math.min(1, t));
  const cx = a[0] + tc * dx;
  const cy = a[1] + tc * dy;
  const ex = p[0] - cx;
  const ey = p[1] - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

// Douglas-Peucker on a ring/line of [x,y] points. Preserves endpoints.
function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push([round(points[i][0]), round(points[i][1])]);
  }
  // Ensure valid ring (min 4 points, closed) - if degenerated, keep original endpoints.
  if (out.length < 4) {
    return points.slice(0, Math.max(4, points.length)).map(([x, y]) => [round(x), round(y)]);
  }
  return out;
}

function simplifyGeometry(geom, tolerance) {
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring) => simplifyRing(ring, tolerance)),
    };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly) =>
        poly.map((ring) => simplifyRing(ring, tolerance)),
      ),
    };
  }
  return geom;
}

function main() {
  const raw = JSON.parse(readFileSync(INPUT, 'utf8'));
  if (raw.type !== 'FeatureCollection') {
    throw new Error('Expected a FeatureCollection');
  }

  const seenIds = new Set();
  const features = raw.features.map((f, index) => {
    const p = f.properties ?? {};
    const name = String(
      p.adm4_name ?? p.adm4_ref_name ?? p.adm4_name1 ?? p.adm4_pcode ?? 'Unknown',
    ).trim();
    const delegation = String(p.adm3_name ?? p.adm3_name1 ?? '').trim();
    const governorate = String(p.adm2_name ?? p.adm2_name1 ?? '').trim();

    const delegationId = String(p.adm3_pcode ?? slugify(`${governorate}-${delegation}`)).trim();

    let id = String(p.adm4_pcode ?? '').trim();
    if (!id) id = slugify(`${delegationId}-${name}`) || `sector-${index}`;
    let uniqueId = id;
    let i = 2;
    while (seenIds.has(uniqueId)) uniqueId = `${id}-${i++}`;
    seenIds.add(uniqueId);

    return {
      type: 'Feature',
      properties: { id: uniqueId, name, delegation, delegationId, governorate },
      geometry: simplifyGeometry(f.geometry, TOLERANCE),
    };
  });

  const out = { type: 'FeatureCollection', features };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(out));

  const inSize = readFileSync(INPUT).length;
  const outSize = readFileSync(OUTPUT).length;
  const delegations = new Set(features.map((f) => f.properties.delegationId));
  const govs = new Set(features.map((f) => f.properties.governorate));
  let points = 0;
  const countPoints = (arr) => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number') points += 1;
    else arr.forEach(countPoints);
  };
  features.forEach((f) => countPoints(f.geometry.coordinates));
  console.log(`Sectors         : ${features.length}`);
  console.log(`Delegations     : ${delegations.size}`);
  console.log(`Governorates    : ${govs.size}`);
  console.log(`Coordinate pts  : ${points.toLocaleString('en-US')}`);
  console.log(`Input size      : ${(inSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Output size     : ${(outSize / 1024).toFixed(1)} KB`);
  console.log(`Reduction       : ${(100 - (outSize / inSize) * 100).toFixed(1)}%`);
  console.log(`Written         : ${OUTPUT}`);
}

main();
