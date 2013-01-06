function dot(left, right) {
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function clamp(vec3, lo, hi) {
    var ret = vec3.slice();
    for (var i = 0; i < 3; i++)
        ret[i] = ret[i] < lo ? lo : ret[i] > hi ? hi : ret[i];
    return ret;
}

function f(n, eps, k) {
	if (n > eps) {
		return Math.pow(n, 1.0 / 3.0);
	} else {
		return (k * n + 16.0) / 116.0;
	}
}

function xyzToRgb(xyz) {
	var m0 = [ 3.2404542, -1.5371385, -0.4985314];
	var m1 = [-0.9692660,  1.8760108,  0.0415560];
	var m2 = [ 0.0556434, -0.2040259,  1.0572252];

	var rgb = [dot(xyz, m0), dot(xyz, m1), dot(xyz, m2)];

	return clamp(rgb, 0.0, 1.0);
}

function labToXyz(lab) {
	var Xr = 0.95047;
	var Yr = 1.0;
	var Zr = 1.08883;

	var eps = 216.0 / 24389.0;
	var k = 24389.0 / 27.0;

	var l = lab[0];
	var a = lab[1];
	var b = lab[2];

	var fy = (l + 16.0) / 116.0;
	var fx = a / 500.0 + fy;
	var fz = -b / 200.0 + fy;

	var xr = (fx * fx * fx > eps) ? fx * fx * fx : (116.0 * fx - 16.0) / k;
	var lt = (l + 16.0) / 116.0;
	var yr = (l > k * eps) ? lt * lt * lt : l / k;
	var zr = (fz * fz * fz > eps) ? fz * fz * fz : (116.0 * fz - 16.0) / k;

	var x = xr * Xr;
	var y = yr * Yr;
	var z = zr * Zr;

	return [x, y, z];
}

function lchToLab(lch) {
	return [lch[0], lch[1] * Math.cos(lch[2]), lch[1] * Math.sin(lch[2])];
}

function labToRgb(lab) {
	return xyzToRgb(labToXyz(lab), true);
}

function lchToRgb(lch) {
    return xyzToRgb(labToXyz(lchToLab(lch)), true);
}

function getColors(lightness, chroma, numGroups) {
	var pi = 3.14159265358979323846264;
	var hueStep = 2.0 * pi / numGroups;
    var ret = [];
    for (var i = 0; i < numGroups; i++) {
        var c = lchToRgb([lightness, chroma, hueStep * i]);
        c[0] = Math.floor(c[0] * 255);
        c[1] = Math.floor(c[1] * 255);
        c[2] = Math.floor(c[2] * 255);
        ret.push(c);
    }

	return ret;
}
