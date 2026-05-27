export class Noise {
  constructor(seed = 1) {
    this.seed = seed;
    const src = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(this._hash(i) * (i + 1));
      [src[i], src[j]] = [src[j], src[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = src[i & 255];
  }

  _hash(n) {
    const x = Math.sin(n * 127.1 + this.seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  _lerp(a, b, t) { return a + t * (b - a); }

  _grad(h, x, y) {
    switch (h & 3) {
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      default: return -x - y;
    }
  }

  _grad3d(h, x, y, z) {
    const u = (h & 8) ? y : x;
    const v = (h & 4) ? ((h & 2) ? x : z) : y;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  get3d(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this._fade(x), v = this._fade(y), w = this._fade(z);
    const A  = this.perm[X]     + Y, AA = this.perm[A]     + Z, AB = this.perm[A + 1] + Z;
    const B  = this.perm[X + 1] + Y, BA = this.perm[B]     + Z, BB = this.perm[B + 1] + Z;
    return this._lerp(
      this._lerp(
        this._lerp(this._grad3d(this.perm[AA],     x,     y,     z    ),
                   this._grad3d(this.perm[BA],     x - 1, y,     z    ), u),
        this._lerp(this._grad3d(this.perm[AB],     x,     y - 1, z    ),
                   this._grad3d(this.perm[BB],     x - 1, y - 1, z    ), u), v),
      this._lerp(
        this._lerp(this._grad3d(this.perm[AA + 1], x,     y,     z - 1),
                   this._grad3d(this.perm[BA + 1], x - 1, y,     z - 1), u),
        this._lerp(this._grad3d(this.perm[AB + 1], x,     y - 1, z - 1),
                   this._grad3d(this.perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }

  octave3d(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2) {
    let value = 0, amplitude = 1, frequency = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
      value    += this.get3d(x * frequency, y * frequency, z * frequency) * amplitude;
      total    += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return value / total;
  }

  get(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this._fade(x);
    const v = this._fade(y);
    const aa = this.perm[X]     + Y;
    const ba = this.perm[X + 1] + Y;
    return this._lerp(
      this._lerp(this._grad(this.perm[aa],     x,     y    ),
                 this._grad(this.perm[ba],     x - 1, y    ), u),
      this._lerp(this._grad(this.perm[aa + 1], x,     y - 1),
                 this._grad(this.perm[ba + 1], x - 1, y - 1), u),
      v
    );
  }

  octave(x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
    let value = 0, amplitude = 1, frequency = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
      value    += this.get(x * frequency, y * frequency) * amplitude;
      total    += amplitude;
      amplitude  *= persistence;
      frequency  *= lacunarity;
    }
    return value / total;
  }
}
