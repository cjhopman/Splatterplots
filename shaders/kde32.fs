#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture;
uniform int kWindow;
uniform float sigma;
uniform vec2 off;
uniform float blockWidth;
uniform float pixWidth;

varying vec2 vPos;

void main(void) 
{
	vec2 pos;

    vec2 lo = floor(vPos / blockWidth) * blockWidth;
    vec2 hi = floor(vPos / blockWidth + 1.0) * blockWidth - pixWidth;

    float co = any(lessThan(vPos, lo)) || any(greaterThan(vPos, hi)) ? 0.0 : 1.0;
	float sum = co;
    vec4 color = texture2D(texture, vPos) * co;

	for(float i = 1.0; i < 32.0; i += 1.0) {
		float gY = exp(-i*i/(2.0*sigma*sigma));

		pos = i * off + vPos;
        co = any(lessThan(pos, lo)) || any(greaterThan(pos, hi)) ? 0.0 : gY;
		sum += co;
		color += texture2D(texture, pos) * co;

		pos = -i * off + vPos;
        co = any(lessThan(pos, lo)) || any(greaterThan(pos, hi)) ? 0.0 : gY;
		sum += co;
		color += texture2D(texture, pos) * co;
	}

	color /= sum;

	gl_FragColor = color;
}
