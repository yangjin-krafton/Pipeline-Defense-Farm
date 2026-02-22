import { InstancedRenderer } from './InstancedRenderer.js';

/**
 * BulletRenderer - Renders bullets with instanced WebGL2.
 * Supports per-bullet stretch/thickness/rotation overrides.
 */
export class BulletRenderer extends InstancedRenderer {
  constructor(gl, maxBullets = 500, resolution = [360, 640]) {
    super(gl, maxBullets);

    this.resolution = resolution;

    this._createShaders();
    this._createBulletMesh(12);
    this._createInstanceBuffers();

    this.tempPositions = new Float32Array(maxBullets * 2);
    this.tempColors = new Float32Array(maxBullets * 4);
    this.tempSizes = new Float32Array(maxBullets);
    this.tempRotations = new Float32Array(maxBullets);
    this.tempStretch = new Float32Array(maxBullets);
    this.tempThickness = new Float32Array(maxBullets);
    this.tempGlow = new Float32Array(maxBullets);
  }

  _createShaders() {
    const vertexShader = `#version 300 es
      in vec2 aPosition;
      in vec2 aInstancePos;
      in vec4 aInstanceColor;
      in float aInstanceSize;
      in float aInstanceRotation;
      in float aInstanceStretch;
      in float aInstanceThickness;
      in float aInstanceGlow;

      uniform vec2 uResolution;

      out vec4 vColor;
      out vec2 vCircleCoord;
      out float vForward;
      out float vGlow;

      void main() {
        vec2 local = vec2(
          aPosition.x * aInstanceSize * aInstanceStretch,
          aPosition.y * aInstanceSize * aInstanceThickness
        );

        float c = cos(aInstanceRotation);
        float s = sin(aInstanceRotation);
        vec2 rotated = vec2(
          local.x * c - local.y * s,
          local.x * s + local.y * c
        );

        vec2 worldPos = rotated + aInstancePos;
        vec2 clip = (worldPos / uResolution) * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);

        vColor = aInstanceColor;
        vCircleCoord = aPosition;
        vForward = aPosition.x;
        vGlow = aInstanceGlow;
      }
    `;

    const fragmentShader = `#version 300 es
      precision highp float;

      in vec4 vColor;
      in vec2 vCircleCoord;
      in float vForward;
      in float vGlow;

      out vec4 outColor;

      void main() {
        float dist = length(vCircleCoord);
        float alpha = 1.0 - smoothstep(0.82, 1.0, dist);

        float forward01 = (vForward + 1.0) * 0.5;
        float core = 1.0 - smoothstep(0.0, 0.58, dist);
        float highlight = core * (0.22 + forward01 * 0.52) * (0.45 + vGlow);

        outColor = vec4(vColor.rgb, vColor.a * alpha);
        outColor.rgb += vec3(0.85, 0.92, 1.0) * highlight;
      }
    `;

    this.createProgram(
      vertexShader,
      fragmentShader,
      ['uResolution'],
      [
        'aPosition',
        'aInstancePos',
        'aInstanceColor',
        'aInstanceSize',
        'aInstanceRotation',
        'aInstanceStretch',
        'aInstanceThickness',
        'aInstanceGlow'
      ]
    );

    this.setUniform('uResolution', this.resolution);
  }

  _createBulletMesh(segments) {
    const vertices = [];

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      vertices.push(0, 0);
      vertices.push(Math.cos(angle1), Math.sin(angle1));
      vertices.push(Math.cos(angle2), Math.sin(angle2));
    }

    this.setupMesh(new Float32Array(vertices));
    this.setupMeshAttribute(this.attribLocations.aPosition, 2);
  }

  _createInstanceBuffers() {
    this.createInstanceBuffer('position', 2, this.attribLocations.aInstancePos, 1);
    this.createInstanceBuffer('color', 4, this.attribLocations.aInstanceColor, 1);
    this.createInstanceBuffer('size', 1, this.attribLocations.aInstanceSize, 1);
    this.createInstanceBuffer('rotation', 1, this.attribLocations.aInstanceRotation, 1);
    this.createInstanceBuffer('stretch', 1, this.attribLocations.aInstanceStretch, 1);
    this.createInstanceBuffer('thickness', 1, this.attribLocations.aInstanceThickness, 1);
    this.createInstanceBuffer('glow', 1, this.attribLocations.aInstanceGlow, 1);
  }

  resolveRenderStyle(bullet) {
    const style = bullet.renderStyle || {};

    const stretch = Number.isFinite(style.stretch) ? style.stretch : 1.0;
    const thickness = Number.isFinite(style.thickness) ? style.thickness : 1.0;
    const glow = Number.isFinite(style.glow) ? style.glow : 0.3;

    let rotation = Number.isFinite(bullet.rotation) ? bullet.rotation : 0;
    if (!Number.isFinite(rotation) || rotation === 0) {
      const dx = bullet.lastDirX || 0;
      const dy = bullet.lastDirY || 0;
      if (dx !== 0 || dy !== 0) {
        rotation = Math.atan2(dy, dx);
      }
    }

    return {
      rotation,
      stretch: Math.max(0.2, stretch),
      thickness: Math.max(0.1, thickness),
      glow: Math.max(0.0, glow)
    };
  }

  update(bullets) {
    if (!bullets || bullets.length === 0) {
      return;
    }

    const count = Math.min(bullets.length, this.maxInstances);

    for (let i = 0; i < count; i++) {
      const bullet = bullets[i];
      const style = this.resolveRenderStyle(bullet);

      this.tempPositions[i * 2] = bullet.x;
      this.tempPositions[i * 2 + 1] = bullet.y;

      this.tempColors[i * 4] = bullet.color[0];
      this.tempColors[i * 4 + 1] = bullet.color[1];
      this.tempColors[i * 4 + 2] = bullet.color[2];
      this.tempColors[i * 4 + 3] = bullet.color[3];

      this.tempSizes[i] = bullet.size;
      this.tempRotations[i] = style.rotation;
      this.tempStretch[i] = style.stretch;
      this.tempThickness[i] = style.thickness;
      this.tempGlow[i] = style.glow;
    }

    this.updateInstanceBuffer('position', this.tempPositions, count);
    this.updateInstanceBuffer('color', this.tempColors, count);
    this.updateInstanceBuffer('size', this.tempSizes, count);
    this.updateInstanceBuffer('rotation', this.tempRotations, count);
    this.updateInstanceBuffer('stretch', this.tempStretch, count);
    this.updateInstanceBuffer('thickness', this.tempThickness, count);
    this.updateInstanceBuffer('glow', this.tempGlow, count);

    this.render(count);
  }

  updateResolution(resolution) {
    this.resolution = resolution;
    this.setUniform('uResolution', resolution);
  }
}
