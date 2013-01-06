#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture;
uniform float textureWidth;

varying vec2 vPos;

void main(void) 
{
	vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
	vec2 pos = vPos - vec2(0.5, 0.5) / textureWidth;
	for (int i = 0; i < 8; i++) {
		for (int j = 0; j < 8; j++) {
			color = max(color, texture2D(texture, pos * 8.0 + vec2(float(i) + 0.5, float(j) + 0.5) / textureWidth));
		}
	}
	gl_FragColor = color;
}
