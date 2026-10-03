// 位置に固定された滑らかなノイズ(バリューノイズ)。同じ座標・seedなら常に同じ値(0〜1)を返す。

function latticeValue(ix: number, iy: number, seed: number): number {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483629);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = latticeValue(ix, iy, seed) * (1 - sx) + latticeValue(ix + 1, iy, seed) * sx;
    const bottom = latticeValue(ix, iy + 1, seed) * (1 - sx) + latticeValue(ix + 1, iy + 1, seed) * sx;
    return top * (1 - sy) + bottom * sy;
}
