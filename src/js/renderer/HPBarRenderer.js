import { InstancedRenderer } from './InstancedRenderer.js';

/**
 * HPBarRenderer - WebGL2 instanced HP bars + status markers.
 */
export class HPBarRenderer extends InstancedRenderer {
  constructor(gl, maxBars = 200, resolution = [360, 640]) {
    super(gl, maxBars);

    this.resolution = resolution;

    this._createShaders();
    this._createQuadMesh();
    this._createInstanceBuffers();

    this.tempPositions = new Float32Array(maxBars * 2);
    this.tempSizes = new Float32Array(maxBars * 2);
    this.tempHpPercents = new Float32Array(maxBars);
    this.tempBgColors = new Float32Array(maxBars * 4);
    this.tempFgColors = new Float32Array(maxBars * 4);

    this.maxStatusMarkers = maxBars * 6;
    this.tempMarkerPositions = new Float32Array(this.maxStatusMarkers * 2);
    this.tempMarkerSizes = new Float32Array(this.maxStatusMarkers * 2);
    this.tempMarkerPercents = new Float32Array(this.maxStatusMarkers);
    this.tempMarkerColors = new Float32Array(this.maxStatusMarkers * 4);

    this.statusMarkerColors = {
      expose: [1.0, 0.55, 0.12, 0.98],
      corrode: [0.20, 1.0, 0.22, 0.98],
      shock: [1.0, 0.95, 0.20, 0.98],
      mark: [0.49, 1.0, 0.48, 1.0],
      clustered: [0.35, 0.85, 1.0, 0.98],
      stun: [0.70, 0.70, 0.70, 0.98],
      slow: [0.45, 0.65, 1.0, 0.98]
    };
  }

  _createShaders() {
    const vertexShader = `#version 300 es
      in vec2 aQuadPos;
      in vec2 aInstancePos;
      in vec2 aInstanceSize;
      in float aHpPercent;
      in vec4 aColor;

      uniform vec2 uResolution;
      uniform int uLayer; // 0=bar bg, 1=bar fg, 2=status marker

      out vec4 vColor;

      void main() {
        vec2 size = aInstanceSize;
        vec2 centerPos = aInstancePos;

        if (uLayer == 1) {
          float originalWidth = aInstanceSize.x;
          size.x *= aHpPercent;
          centerPos.x -= (originalWidth - size.x) * 0.5;
        }

        vec2 vertexOffset = (aQuadPos - 0.5) * size;
        vec2 worldPos = centerPos + vertexOffset;

        vec2 clip = (worldPos / uResolution) * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);

        vColor = aColor;
      }
    `;

    const fragmentShader = `#version 300 es
      precision highp float;

      in vec4 vColor;
      out vec4 outColor;

      void main() {
        outColor = vColor;
      }
    `;

    this.createProgram(
      vertexShader,
      fragmentShader,
      ['uResolution', 'uLayer'],
      ['aQuadPos', 'aInstancePos', 'aInstanceSize', 'aHpPercent', 'aColor']
    );

    this.setUniform('uResolution', this.resolution);
  }

  _createQuadMesh() {
    const vertices = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 0,
      1, 1,
      0, 1
    ]);

    this.setupMesh(vertices);
    this.setupMeshAttribute(this.attribLocations.aQuadPos, 2);
  }

  _createInstanceBuffers() {
    this.createInstanceBuffer('position', 2, this.attribLocations.aInstancePos, 1);
    this.createInstanceBuffer('size', 2, this.attribLocations.aInstanceSize, 1);
    this.createInstanceBuffer('hpPercent', 1, this.attribLocations.aHpPercent, 1);
    this.createInstanceBuffer('bgColor', 4, this.attribLocations.aColor, 1);
    this.createInstanceBuffer('fgColor', 4, this.attribLocations.aColor, 1);

    this.createInstanceBuffer('markerPosition', 2, this.attribLocations.aInstancePos, 1);
    this.createInstanceBuffer('markerSize', 2, this.attribLocations.aInstanceSize, 1);
    this.createInstanceBuffer('markerPercent', 1, this.attribLocations.aHpPercent, 1);
    this.createInstanceBuffer('markerColor', 4, this.attribLocations.aColor, 1);
  }

  update(foods, multiPathSystem) {
    if (!foods || foods.length === 0) {
      return;
    }

    const count = Math.min(foods.length, this.maxInstances);
    const barWidth = 30;
    const barHeight = 4;
    const yOffset = -15;

    const markerSize = 6;
    const markerSpacing = 7;
    const markerYOffset = -22;
    let markerCount = 0;

    for (let i = 0; i < count; i++) {
      const food = foods[i];
      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      const hpPercent = Math.max(0, Math.min(1, food.hp / food.maxHp));

      this.tempPositions[i * 2] = pos.x;
      this.tempPositions[i * 2 + 1] = pos.y + yOffset;

      this.tempSizes[i * 2] = barWidth;
      this.tempSizes[i * 2 + 1] = barHeight;

      this.tempHpPercents[i] = hpPercent;

      this.tempBgColors[i * 4] = 0.3;
      this.tempBgColors[i * 4 + 1] = 0.0;
      this.tempBgColors[i * 4 + 2] = 0.0;
      this.tempBgColors[i * 4 + 3] = 0.8;

      const barColor = this._getBarColor(food, hpPercent);
      this.tempFgColors[i * 4] = barColor[0];
      this.tempFgColors[i * 4 + 1] = barColor[1];
      this.tempFgColors[i * 4 + 2] = barColor[2];
      this.tempFgColors[i * 4 + 3] = barColor[3];

      const activeEffects = this._getActiveStatusEffects(food.statusEffects || []);
      const uniqueEffects = this._getUniqueStatusEffects(activeEffects).slice(0, 4);
      const totalWidth = (uniqueEffects.length - 1) * markerSpacing;
      const startX = pos.x - (totalWidth * 0.5);

      for (let j = 0; j < uniqueEffects.length; j++) {
        if (markerCount >= this.maxStatusMarkers) break;

        const effect = uniqueEffects[j];
        const markerColor = this.statusMarkerColors[effect.type];
        if (!markerColor) continue;

        this.tempMarkerPositions[markerCount * 2] = startX + (j * markerSpacing);
        this.tempMarkerPositions[markerCount * 2 + 1] = pos.y + markerYOffset;

        this.tempMarkerSizes[markerCount * 2] = markerSize;
        this.tempMarkerSizes[markerCount * 2 + 1] = markerSize;

        this.tempMarkerPercents[markerCount] = 1.0;

        this.tempMarkerColors[markerCount * 4] = markerColor[0];
        this.tempMarkerColors[markerCount * 4 + 1] = markerColor[1];
        this.tempMarkerColors[markerCount * 4 + 2] = markerColor[2];
        this.tempMarkerColors[markerCount * 4 + 3] = markerColor[3];

        markerCount++;
      }
    }

    this.updateInstanceBuffer('position', this.tempPositions, count);
    this.updateInstanceBuffer('size', this.tempSizes, count);
    this.updateInstanceBuffer('hpPercent', this.tempHpPercents, count);
    this.updateInstanceBuffer('bgColor', this.tempBgColors, count);
    this.updateInstanceBuffer('fgColor', this.tempFgColors, count);

    this.updateInstanceBuffer('markerPosition', this.tempMarkerPositions, markerCount);
    this.updateInstanceBuffer('markerSize', this.tempMarkerSizes, markerCount);
    this.updateInstanceBuffer('markerPercent', this.tempMarkerPercents, markerCount);
    this.updateInstanceBuffer('markerColor', this.tempMarkerColors, markerCount);

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    this._bindInstanceAttribPointers(
      this.instanceBuffers.position.buffer,
      this.instanceBuffers.size.buffer,
      this.instanceBuffers.hpPercent.buffer
    );

    gl.uniform1i(this.uniformLocations.uLayer, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffers.bgColor.buffer);
    gl.vertexAttribPointer(this.attribLocations.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

    gl.uniform1i(this.uniformLocations.uLayer, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffers.fgColor.buffer);
    gl.vertexAttribPointer(this.attribLocations.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

    if (markerCount > 0) {
      this._bindInstanceAttribPointers(
        this.instanceBuffers.markerPosition.buffer,
        this.instanceBuffers.markerSize.buffer,
        this.instanceBuffers.markerPercent.buffer
      );

      gl.uniform1i(this.uniformLocations.uLayer, 2);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffers.markerColor.buffer);
      gl.vertexAttribPointer(this.attribLocations.aColor, 4, gl.FLOAT, false, 0, 0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, markerCount);
    }

    gl.bindVertexArray(null);
  }

  _bindInstanceAttribPointers(positionBuffer, sizeBuffer, hpPercentBuffer) {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(this.attribLocations.aInstancePos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.vertexAttribPointer(this.attribLocations.aInstanceSize, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, hpPercentBuffer);
    gl.vertexAttribPointer(this.attribLocations.aHpPercent, 1, gl.FLOAT, false, 0, 0);
  }

  _getBarColor(food, hpPercent) {
    const defaultColor = [1.0, 0.3, 0.3, 1.0];

    if (food.statusEffects && food.statusEffects.length > 0) {
      const activeEffects = this._getActiveStatusEffects(food.statusEffects);

      for (const effect of activeEffects) {
        switch (effect.type) {
          case 'corrode':
            return [0.3, 1.0, 0.3, 1.0];
          case 'shock':
            return [1.0, 1.0, 0.3, 1.0];
          case 'expose':
            return [1.0, 0.6, 0.2, 1.0];
          case 'mark':
            return [0.8, 0.3, 1.0, 1.0];
          case 'clustered':
            return [0.3, 0.8, 1.0, 1.0];
          case 'stun':
            return [0.6, 0.6, 0.6, 1.0];
          default:
            break;
        }
      }
    }

    return defaultColor;
  }

  _getActiveStatusEffects(statusEffects) {
    const currentTime = Date.now();
    return statusEffects.filter(effect => {
      if (!effect.appliedTime || !effect.duration) return false;
      const elapsed = (currentTime - effect.appliedTime) / 1000;
      return elapsed < effect.duration;
    });
  }

  _getUniqueStatusEffects(effects) {
    const uniqueMap = new Map();
    for (const effect of effects) {
      if (!uniqueMap.has(effect.type)) {
        uniqueMap.set(effect.type, effect);
      }
    }
    return Array.from(uniqueMap.values());
  }

  updateResolution(resolution) {
    this.resolution = resolution;
    this.setUniform('uResolution', resolution);
  }
}
