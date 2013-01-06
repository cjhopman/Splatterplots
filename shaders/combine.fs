#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D points0;
uniform sampler2D points1;

uniform sampler2D shapes0;
uniform sampler2D shapes1;

uniform float strokeSize;
uniform float textureWidth;

uniform float lightness;
uniform float chroma;
uniform float attenuateLightness;
uniform float attenuateChroma;
uniform float numGroups;

uniform float stripeWidth;
uniform float stripePeriod;

uniform vec4 groups0;
uniform vec4 groups1;

varying vec2 vPos;

float f(float n, float eps, float k) {
	if (n > eps) {
		return pow(n, 1.0 / 3.0);
	} else {
		return (k * n + 16.0) / 116.0;
	}
}

vec3 xyzToRgb(vec3 xyz, bool c) {
	vec3 m0 = vec3( 3.2404542, -1.5371385, -0.4985314);
	vec3 m1 = vec3(-0.9692660,  1.8760108,  0.0415560);
	vec3 m2 = vec3( 0.0556434, -0.2040259,  1.0572252);

	vec3 rgb = vec3(dot(xyz, m0), dot(xyz, m1), dot(xyz, m2));

	return c ? clamp(rgb, 0.0, 1.0) : rgb;
}

vec3 rgbToXyz(vec3 rgb) {
	vec3 m0 = vec3(0.4124564, 0.3575761, 0.1804375);
	vec3 m1 = vec3(0.2126729, 0.7151522, 0.0721750);
	vec3 m2 = vec3(0.0193339, 0.1191920, 0.9503041);

	return vec3(dot(rgb, m0), dot(rgb, m1), dot(rgb, m2));
}

vec3 xyzToLab(vec3 xyz) {
	float Xr = 0.95047;
	float Yr = 1.0;
	float Zr = 1.08883;

	float eps = 216.0 / 24389.0;
	float k = 24389.0 / 27.0;

	float xr = xyz.x / Xr;
	float yr = xyz.y / Yr;
	float zr = xyz.z / Zr;

	xr = f(xr, eps, k);
	yr = f(yr, eps, k);
	zr = f(zr, eps, k);

	float l = 116.0 * yr - 16.0;
	float a = 500.0 * (xr - yr);
	float b = 200.0 * (yr - zr);

	return vec3(l, a, b);
}
vec3 labToXyz(vec3 lab) {
	float Xr = 0.95047;
	float Yr = 1.0;
	float Zr = 1.08883;

	float eps = 216.0 / 24389.0;
	float k = 24389.0 / 27.0;

	float l = lab.x;
	float a = lab.y;
	float b = lab.z;

	float fy = (l + 16.0) / 116.0;
	float fx = a / 500.0 + fy;
	float fz = -b / 200.0 + fy;

	float xr = (fx * fx * fx > eps) ? fx * fx * fx : (116.0 * fx - 16.0) / k;
	float lt = (l + 16.0) / 116.0;
	float yr = (l > k * eps) ? lt * lt * lt : l / k;
	float zr = (fz * fz * fz > eps) ? fz * fz * fz : (116.0 * fz - 16.0) / k;

	float x = xr * Xr;
	float y = yr * Yr;
	float z = zr * Zr;

	return vec3(x, y, z);
}
vec3 labToLch(vec3 lab) {
	return vec3(lab.x, sqrt(lab.y * lab.y + lab.z * lab.z), atan(lab.z, lab.y));
}
vec3 lchToLab(vec3 lch) {
	return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));
}
vec3 labToRgb(vec3 lab) {
	return xyzToRgb(labToXyz(lab), true);
}
vec3 rgbToLab(vec3 rgb) {
	return rgbToXyz(xyzToLab(rgb));
}

mat4 getColors(float o) {
	float pi = 3.14159265358979323846264;
	float hueStep = 2.0 * pi / numGroups;
	mat4 colors = mat4(
			vec4(lchToLab(vec3(lightness, chroma, hueStep * (o + 0.0))), 1.0),
			vec4(lchToLab(vec3(lightness, chroma, hueStep * (o + 1.0))), 1.0),
			vec4(lchToLab(vec3(lightness, chroma, hueStep * (o + 2.0))), 1.0),
			vec4(lchToLab(vec3(lightness, chroma, hueStep * (o + 3.0))), 1.0));
	return colors;
}

vec4 blend(bvec4 b0, bvec4 b1, vec3 attenBase) {
	mat4 colors0 = getColors(0.0);
	mat4 colors1 = getColors(4.0);
	
	float ncolors = dot(vec4(b0) + vec4(b1), vec4(1.0, 1.0, 1.0, 1.0));
	vec3 color = (colors0 * vec4(b0) + colors1 * vec4(b1)).rgb / ncolors;
	
	vec3 atten = vec3(pow(attenuateLightness, (ncolors - 1.0)), pow(attenuateChroma, (ncolors - 1.0)), 1.0);
	return vec4(labToRgb(lchToLab(labToLch(color) * atten * attenBase)), 1.0);
}

void main(void) 
{
	vec4 p0 = texture2D(points0, vPos) * groups0;
	vec4 p1 = texture2D(points1, vPos) * groups1;

	bvec4 b0 = greaterThan(p0, vec4(0.0, 0.0, 0.0, 0.0));
	bvec4 b1 = greaterThan(p1, vec4(0.0, 0.0, 0.0, 0.0));

	vec4 s0 = texture2D(shapes0, vPos) * groups0;
	vec4 s1 = texture2D(shapes1, vPos) * groups1;
	vec4 d0 = (1.0 - s0) * textureWidth;
	vec4 d1 = (1.0 - s1) * textureWidth;

	bvec4 c0 = lessThanEqual(d0, vec4(0.5, 0.5, 0.5, 0.5));
	bvec4 c1 = lessThanEqual(d1, vec4(0.5, 0.5, 0.5, 0.5));

	b0 = bvec4(vec4(b0) * vec4(not(c0)));
	b1 = bvec4(vec4(b1) * vec4(not(c1)));

	if (any(b0) || any(b1)) {
		gl_FragColor = blend(b0, b1, vec3(1.0, 1.0, 1.0));
	} else {
		bvec4 str0 = lessThanEqual(d0, vec4(1.0, 1.0, 1.0, 1.0) * strokeSize);
		bvec4 str1 = lessThanEqual(d1, vec4(1.0, 1.0, 1.0, 1.0) * strokeSize);

		str0 = bvec4(vec4(str0) * vec4(not(c0)));
		str1 = bvec4(vec4(str1) * vec4(not(c1)));
		//str0 *= not(c0);
		//str1 *= not(c1);

		if (any(str0) || any(str1)) {
			gl_FragColor = blend(str0, str1, vec3(0.7, 0.7, 1.0));
		} else if (any(c0) || any(c1)) {
            float pi = 3.14159265358979323846264;
            vec4 angle0 = vec4(
                    0.0 * pi / numGroups,
                    1.0 * pi / numGroups,
                    2.0 * pi / numGroups,
                    3.0 * pi / numGroups);
            vec4 angle1 = vec4(
                    4.0 * pi / numGroups,
                    5.0 * pi / numGroups,
                    6.0 * pi / numGroups,
                    7.0 * pi / numGroups);

            vec4 cos0 = cos(angle0);
            vec4 cos1 = cos(angle1);
            vec4 sin0 = sin(angle0);
            vec4 sin1 = sin(angle1);

            vec4 p0 = vPos.x * cos0 + vPos.y * sin0;
            vec4 p1 = vPos.x * cos1 + vPos.y * sin1;
            p0 = mod(p0, stripePeriod);
            p1 = mod(p1, stripePeriod);

            bvec4 s0 = lessThan(p0, stripeWidth * vec4(c0));
            bvec4 s1 = lessThan(p1, stripeWidth * vec4(c1));

            if (any(s0) || any(s1)) {
                gl_FragColor = blend(s0, s1, vec3(1.7, 1.7, 1.0));
            } else {
                gl_FragColor = blend(c0, c1, vec3(1.0, 1.0, 1.0));
            }
		} else {
			gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
		}
	}
}
