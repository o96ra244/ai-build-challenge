import type { BufferGeometry, Mesh } from "three";

export declare class GaussianSplatMesh extends Mesh {
  readonly isGaussianSplatMesh: boolean;
  readonly splatGeometry: BufferGeometry;
  autoSort: boolean;

  constructor(splatGeometry: BufferGeometry, options?: { readonly autoSort?: boolean });
}
