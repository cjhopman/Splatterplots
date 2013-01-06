#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture;

uniform vec4 textureRect;

varying vec2 vPos;

void main(void) 
{
	gl_FragColor = texture2D(texture, textureRect.xy + vPos * textureRect.zw);
}
