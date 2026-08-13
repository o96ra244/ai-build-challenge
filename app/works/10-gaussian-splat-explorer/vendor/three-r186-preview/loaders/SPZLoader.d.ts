import type { BufferGeometry, Loader } from "three";

export declare class SPZLoader extends Loader {
  parse(buffer: ArrayBuffer): BufferGeometry | Promise<BufferGeometry>;
}
