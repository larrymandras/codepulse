/**
 * Minimal ambient type declarations for the three.js surface the Skill Vault uses.
 * three@0.185 ships without a `types` condition our Bundler resolution picks up, and
 * we deliberately avoid adding @types/three (version drift + a new dev dep). Mirrors
 * the existing `src/types/d3-force-3d.d.ts` precedent: declare only what we consume.
 * The Vault's 3D behavior is verified visually in-browser, not by these types.
 */
declare module "three" {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    setScalar(s: number): this;
  }
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
  }
  export class Object3D {
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    position: Vector3;
    rotation: { x: number; y: number; z: number };
    scale: Vector3;
    visible: boolean;
  }
  export class Group extends Object3D {}

  export class BufferGeometry {
    dispose(): void;
  }
  export class TorusGeometry extends BufferGeometry {
    constructor(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number);
  }
  export class CircleGeometry extends BufferGeometry {
    constructor(radius?: number, segments?: number);
  }
  export class IcosahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number);
  }
  export class OctahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number);
  }
  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class Color {
    constructor(color?: number | string);
    clone(): Color;
    copy(c: Color): this;
    multiplyScalar(s: number): this;
  }

  export class Texture {
    anisotropy: number;
    dispose(): void;
  }
  export class CanvasTexture extends Texture {
    constructor(canvas: HTMLCanvasElement);
  }

  export class Material {
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    dispose(): void;
  }
  export interface MeshBasicMaterialParams {
    color?: number | string | Color;
    transparent?: boolean;
    opacity?: number;
    side?: number;
  }
  export class MeshBasicMaterial extends Material {
    constructor(params?: MeshBasicMaterialParams);
    color: Color;
    side: number;
  }
  export interface MeshStandardMaterialParams {
    color?: number | string | Color;
    emissive?: number | string | Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    transparent?: boolean;
    opacity?: number;
  }
  export class MeshStandardMaterial extends Material {
    constructor(params?: MeshStandardMaterialParams);
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
  }
  export interface SpriteMaterialParams {
    map?: Texture | null;
    transparent?: boolean;
    depthWrite?: boolean;
    blending?: number;
    color?: number | string | Color;
  }
  export class SpriteMaterial extends Material {
    constructor(params?: SpriteMaterialParams);
    map: Texture | null;
    blending: number;
  }
  export const AdditiveBlending: number;

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
    material: Material;
    geometry: BufferGeometry;
  }
  export class Sprite extends Object3D {
    constructor(material?: SpriteMaterial);
    material: SpriteMaterial;
  }

  export const DoubleSide: number;
}

declare module "three/examples/jsm/postprocessing/UnrealBloomPass.js" {
  import { Vector2 } from "three";
  export class UnrealBloomPass {
    constructor(resolution: Vector2, strength: number, radius: number, threshold: number);
    dispose(): void;
  }
}
