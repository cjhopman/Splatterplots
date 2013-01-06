#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture;
uniform float off;

varying vec2 vPos;

const float sqrt2 = 1.4142135623731;

vec4 getValue(float offx, float offy) {
	return texture2D(texture, vPos + vec2(offx, offy) * off);
}

void main(void) 
{
	vec4 color;
	color = max(color, getValue(-1.0, -1.0) - sqrt2 * off);
	color = max(color, getValue(-1.0,  0.0) - 1.0 * off);
	color = max(color, getValue(-1.0,  1.0) - sqrt2 * off);
	color = max(color, getValue( 0.0, -1.0) - 1.0 * off);
	color = max(color, getValue( 0.0,  0.0) - 0.0 * off);
	color = max(color, getValue( 0.0,  1.0) - 1.0 * off);
	color = max(color, getValue( 1.0, -1.0) - sqrt2 * off);
	color = max(color, getValue( 1.0,  0.0) - 1.0 * off);
	color = max(color, getValue( 1.0,  1.0) - sqrt2 * off);

	gl_FragColor = color;
}
