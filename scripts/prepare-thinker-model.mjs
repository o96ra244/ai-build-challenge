import fs from "node:fs";
import path from "node:path";

import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Uint32BufferAttribute,
} from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const DEFAULT_INPUT = "/tmp/thinker-original.stl";
const DEFAULT_OUTPUT = "public/models/09-thinker/the-thinker-optimized.stl";
const GRID_CELL_SIZE = 1.1;

const [inputPath = DEFAULT_INPUT, outputPath = DEFAULT_OUTPUT] = process.argv.slice(2);

function parseStl(filePath) {
  const data = fs.readFileSync(filePath);
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return {
    bytes: data.byteLength,
    geometry: new STLLoader().parse(arrayBuffer),
  };
}

function getGridKey(x, y, z) {
  return [x, y, z].map((value) => Math.round(value / GRID_CELL_SIZE)).join(",");
}

function reduceBySpatialGrid(sourceGeometry) {
  const sourcePosition = sourceGeometry.getAttribute("position");
  const clusters = new Map();
  const sums = [];
  const triangles = [];
  const triangleKeys = new Set();

  function getClusterId(x, y, z) {
    const key = getGridKey(x, y, z);
    const existing = clusters.get(key);
    if (existing !== undefined) {
      const sum = sums[existing];
      sum.x += x;
      sum.y += y;
      sum.z += z;
      sum.count += 1;
      return existing;
    }

    const id = sums.length;
    clusters.set(key, id);
    sums.push({ x, y, z, count: 1 });
    return id;
  }

  for (let index = 0; index < sourcePosition.count; index += 3) {
    const a = getClusterId(sourcePosition.getX(index), sourcePosition.getY(index), sourcePosition.getZ(index));
    const b = getClusterId(sourcePosition.getX(index + 1), sourcePosition.getY(index + 1), sourcePosition.getZ(index + 1));
    const c = getClusterId(sourcePosition.getX(index + 2), sourcePosition.getY(index + 2), sourcePosition.getZ(index + 2));
    if (a === b || b === c || a === c) {
      continue;
    }

    const triangleKey = [a, b, c].sort((left, right) => left - right).join(",");
    if (triangleKeys.has(triangleKey)) {
      continue;
    }
    triangleKeys.add(triangleKey);
    triangles.push(a, b, c);
  }

  const positions = new Float32Array(sums.length * 3);
  sums.forEach((sum, index) => {
    positions[index * 3] = sum.x / sum.count;
    positions[index * 3 + 1] = sum.y / sum.count;
    positions[index * 3 + 2] = sum.z / sum.count;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(new Uint32BufferAttribute(triangles, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function assertFiniteGeometry(geometry) {
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.array.length; index += 1) {
    if (!Number.isFinite(position.array[index])) {
      throw new Error(`Non-finite model position at index ${index}`);
    }
  }
  if (!geometry.boundingBox || !geometry.boundingSphere) {
    throw new Error("Model bounds were not generated");
  }
}

const source = parseStl(inputPath);
const sourceGeometry = source.geometry;
sourceGeometry.computeBoundingBox();
sourceGeometry.computeBoundingSphere();
assertFiniteGeometry(sourceGeometry);

const optimizedGeometry = reduceBySpatialGrid(sourceGeometry);
assertFiniteGeometry(optimizedGeometry);

const mesh = new Mesh(optimizedGeometry);
mesh.updateMatrixWorld(true);
const exported = new STLExporter().parse(mesh, { binary: true });
if (typeof exported === "string") {
  throw new Error("Expected binary STL output");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const exportedBuffer = Buffer.from(exported.buffer, exported.byteOffset, exported.byteLength);
fs.writeFileSync(outputPath, exportedBuffer);

const result = {
  inputPath,
  outputPath,
  sourceBytes: source.bytes,
  sourceTriangles: sourceGeometry.getAttribute("position").count / 3,
  optimizedBytes: exportedBuffer.byteLength,
  optimizedTriangles: optimizedGeometry.index.count / 3,
  optimizedVertices: optimizedGeometry.getAttribute("position").count,
  gridCellSize: GRID_CELL_SIZE,
  bounds: {
    min: optimizedGeometry.boundingBox.min.toArray(),
    max: optimizedGeometry.boundingBox.max.toArray(),
  },
};
console.log(JSON.stringify(result));

sourceGeometry.dispose();
optimizedGeometry.dispose();
