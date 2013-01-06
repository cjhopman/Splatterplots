#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D texture0;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;

uniform float textureWidth;
uniform float gridSize;
uniform float pointRadius;

varying vec2 vPos;

float getDistanceEx(sampler2D texture, float offx, float offy) {
	vec4 data = texture2D(texture, (floor(vPos / gridSize) + vec2(offx, offy)) / textureWidth);
	return (data.a > 0.0) ? distance(data.xy, vPos) : 10000.0;
}

float getDistance(sampler2D texture) {
	float ret = 10000.0;
	ret = min(ret, getDistanceEx(texture, -1.0, -1.0));
	ret = min(ret, getDistanceEx(texture, -1.0,  0.0));
	ret = min(ret, getDistanceEx(texture, -1.0,  1.0));
	ret = min(ret, getDistanceEx(texture,  0.0, -1.0));
	ret = min(ret, getDistanceEx(texture,  0.0,  0.0));
	ret = min(ret, getDistanceEx(texture,  0.0,  1.0));
	ret = min(ret, getDistanceEx(texture,  1.0, -1.0));
	ret = min(ret, getDistanceEx(texture,  1.0,  0.0));
	ret = min(ret, getDistanceEx(texture,  1.0,  1.0));
	ret = ret * textureWidth;
	return ret < pointRadius ? 1.0 : ret < pointRadius + 1.0 ? 0.0 : 0.0;
}

void main(void) 
{
	vec4 dist = vec4(
		getDistance(texture0),
		getDistance(texture1),
		getDistance(texture2),
		getDistance(texture3));

	//gl_FragColor = dist;
	gl_FragColor = dist + vec4(0.0, 0.0, 0.0, 0.0);
}
