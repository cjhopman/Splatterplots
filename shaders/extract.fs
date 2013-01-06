#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture;
uniform int target;
uniform float scale;

varying vec2 vPos;

void main(void) 
{
	vec4 mc = texture2D(texture, vPos);
	float val = (target == 0 ? mc.r : target == 1 ? mc.g : mc.b) * scale;
	gl_FragColor = vec4(val, val, val, 1.0);
}
