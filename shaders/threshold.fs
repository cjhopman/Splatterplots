#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture;
uniform sampler2D maximum0;
uniform sampler2D maximum1;
uniform float threshold;
uniform float textureWidth;
uniform float blockSize;

varying vec2 vPos;

void main(void) 
{
    vec2 base = floor(vPos / blockSize) * 2.0;
	vec4 m = vec4(0.000001, 0.000001, 0.000001, 0.000001);
	m = max(m, texture2D(maximum0, (base + vec2(0.5, 0.5)) / textureWidth));
	m = max(m, texture2D(maximum0, (base + vec2(0.5, 1.5)) / textureWidth));
	m = max(m, texture2D(maximum0, (base + vec2(1.5, 0.5)) / textureWidth));
	m = max(m, texture2D(maximum0, (base + vec2(1.5, 1.5)) / textureWidth));
	//m = max(m, texture2D(maximum1, (base + vec2(0.5, 0.5)) / textureWidth));
	//m = max(m, texture2D(maximum1, (base + vec2(0.5, 1.5)) / textureWidth));
	//m = max(m, texture2D(maximum1, (base + vec2(1.5, 0.5)) / textureWidth));
	//m = max(m, texture2D(maximum1, (base + vec2(1.5, 1.5)) / textureWidth));
    //float t = threshold * max(max(m.x, m.y), max(m.z, m.w));
    //vec4 tv = vec4(t, t, t, t);
    vec4 tv = m * threshold;
	gl_FragColor = vec4(lessThan(tv, texture2D(texture, vPos)));
}
