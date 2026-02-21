import { InstancedRenderer } from './InstancedRenderer.js';

/**
 * HPBarRenderer - 음식 HP Bar를 Instanced Rendering으로 렌더링
 *
 * 모든 HP bar를 2개의 드로우콜(배경 + 전경)로 효율적으로 렌더링합니다.
 */
export class HPBarRenderer extends InstancedRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {number} maxBars - 최대 HP bar 수 (기본: 200)
   * @param {number[]} resolution - 가상 해상도 [width, height]
   */
  constructor(gl, maxBars = 200, resolution = [360, 640]) {
    super(gl, maxBars);

    this.resolution = resolution;

    // 셰이더 생성
    this._createShaders();

    // 사각형 메시 생성
    this._createQuadMesh();

    // 인스턴스 버퍼 생성
    this._createInstanceBuffers();

    // 임시 데이터 배열
    this.tempPositions = new Float32Array(maxBars * 2);
    this.tempSizes = new Float32Array(maxBars * 2);
    this.tempHpPercents = new Float32Array(maxBars);
    this.tempBgColors = new Float32Array(maxBars * 4);
    this.tempFgColors = new Float32Array(maxBars * 4);
  }

  /**
   * 셰이더를 생성합니다.
   */
  _createShaders() {
    const vertexShader = `#version 300 es
      in vec2 aQuadPos;           // 사각형 정점 (0,0 ~ 1,1)
      in vec2 aInstancePos;       // HP bar 중심 위치
      in vec2 aInstanceSize;      // HP bar 크기 [width, height]
      in float aHpPercent;        // HP 비율 (0~1)
      in vec4 aColor;             // 색상

      uniform vec2 uResolution;
      uniform int uLayer;         // 0=배경, 1=전경

      out vec4 vColor;

      void main() {
        vec2 size = aInstanceSize;
        vec2 centerPos = aInstancePos;

        // 전경은 HP 비율만큼만 렌더하고 왼쪽 정렬
        if (uLayer == 1) {
          float originalWidth = aInstanceSize.x;
          size.x *= aHpPercent;
          // 왼쪽 정렬: 중심을 왼쪽으로 이동
          centerPos.x -= (originalWidth - size.x) * 0.5;
        }

        // 사각형 정점을 크기에 맞게 스케일 (중앙 기준)
        vec2 vertexOffset = (aQuadPos - 0.5) * size;
        vec2 worldPos = centerPos + vertexOffset;

        // 가상 해상도를 클립 공간으로 변환
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

    // 해상도 uniform 설정
    this.setUniform('uResolution', this.resolution);
  }

  /**
   * 사각형 메시를 생성합니다 (2개 삼각형).
   */
  _createQuadMesh() {
    const vertices = new Float32Array([
      // 첫 번째 삼각형
      0, 0,     // 좌상
      1, 0,     // 우상
      0, 1,     // 좌하

      // 두 번째 삼각형
      1, 0,     // 우상
      1, 1,     // 우하
      0, 1      // 좌하
    ]);

    this.setupMesh(vertices);

    // 메시 attribute 설정
    this.setupMeshAttribute(this.attribLocations.aQuadPos, 2);
  }

  /**
   * 인스턴스 버퍼들을 생성합니다.
   */
  _createInstanceBuffers() {
    // 위치 버퍼 (vec2)
    this.createInstanceBuffer(
      'position',
      2,
      this.attribLocations.aInstancePos,
      1
    );

    // 크기 버퍼 (vec2)
    this.createInstanceBuffer(
      'size',
      2,
      this.attribLocations.aInstanceSize,
      1
    );

    // HP 비율 버퍼 (float)
    this.createInstanceBuffer(
      'hpPercent',
      1,
      this.attribLocations.aHpPercent,
      1
    );

    // 배경 색상 버퍼 (vec4)
    this.createInstanceBuffer(
      'bgColor',
      4,
      this.attribLocations.aColor,
      1
    );

    // 전경 색상 버퍼 (vec4) - 나중에 전경 렌더링 시 사용
    this.createInstanceBuffer(
      'fgColor',
      4,
      this.attribLocations.aColor,
      1
    );
  }

  /**
   * HP bar 데이터를 업데이트하고 렌더링합니다.
   * @param {Object[]} foods - 음식 배열
   * @param {Object} multiPathSystem - 경로 시스템
   */
  update(foods, multiPathSystem) {
    if (!foods || foods.length === 0) {
      return;
    }

    const count = Math.min(foods.length, this.maxInstances);
    const barWidth = 30;
    const barHeight = 4;
    const yOffset = -15; // 음식 위로 15픽셀

    // 데이터 채우기
    for (let i = 0; i < count; i++) {
      const food = foods[i];
      const pos = multiPathSystem.samplePath(food.currentPath, food.d);

      if (!pos) continue;

      const hpPercent = Math.max(0, Math.min(1, food.hp / food.maxHp));

      // 위치 (음식 위)
      this.tempPositions[i * 2] = pos.x;
      this.tempPositions[i * 2 + 1] = pos.y + yOffset;

      // 크기
      this.tempSizes[i * 2] = barWidth;
      this.tempSizes[i * 2 + 1] = barHeight;

      // HP 비율
      this.tempHpPercents[i] = hpPercent;

      // 배경 색상 (어두운 빨강)
      this.tempBgColors[i * 4] = 0.3;
      this.tempBgColors[i * 4 + 1] = 0.0;
      this.tempBgColors[i * 4 + 2] = 0.0;
      this.tempBgColors[i * 4 + 3] = 0.8;

      // 전경 색상: 기본 빨간색 (상태 이상에 따라 변경 가능)
      const barColor = this._getBarColor(food, hpPercent);
      this.tempFgColors[i * 4] = barColor[0];
      this.tempFgColors[i * 4 + 1] = barColor[1];
      this.tempFgColors[i * 4 + 2] = barColor[2];
      this.tempFgColors[i * 4 + 3] = barColor[3];
    }

    // GPU로 데이터 전송
    this.updateInstanceBuffer('position', this.tempPositions, count);
    this.updateInstanceBuffer('size', this.tempSizes, count);
    this.updateInstanceBuffer('hpPercent', this.tempHpPercents, count);
    this.updateInstanceBuffer('bgColor', this.tempBgColors, count);
    this.updateInstanceBuffer('fgColor', this.tempFgColors, count);

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // 배경 렌더링 (layer 0)
    gl.uniform1i(this.uniformLocations.uLayer, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffers.bgColor.buffer);
    gl.vertexAttribPointer(this.attribLocations.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

    // 전경 렌더링 (layer 1)
    gl.uniform1i(this.uniformLocations.uLayer, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffers.fgColor.buffer);
    gl.vertexAttribPointer(this.attribLocations.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

    gl.bindVertexArray(null);
  }

  /**
   * HP 바 색상을 결정합니다.
   * 기본: 빨간색
   * 상태 이상에 따라 색상 변경 가능 (확장 지점)
   *
   * @param {Object} food - 음식 객체
   * @param {number} hpPercent - HP 비율 (0~1)
   * @returns {number[]} RGBA 색상 [r, g, b, a] (0~1 범위)
   */
  _getBarColor(food, hpPercent) {
    // 기본 색상: 빨간색
    const defaultColor = [1.0, 0.3, 0.3, 1.0];

    // 상태 이상이 있으면 색상 변경 (확장 지점)
    if (food.statusEffects && food.statusEffects.length > 0) {
      // 우선순위: corrode(산성) > shock(감전) > expose(취약) > mark(표식)
      const activeEffects = this._getActiveStatusEffects(food.statusEffects);

      for (const effect of activeEffects) {
        switch (effect.type) {
          case 'corrode':
            // 산성 부식: 초록색
            return [0.3, 1.0, 0.3, 1.0];
          case 'shock':
            // 감전: 노란색
            return [1.0, 1.0, 0.3, 1.0];
          case 'expose':
            // 취약: 주황색
            return [1.0, 0.6, 0.2, 1.0];
          case 'mark':
            // 표식: 보라색
            return [0.8, 0.3, 1.0, 1.0];
          case 'clustered':
            // 군집: 하늘색
            return [0.3, 0.8, 1.0, 1.0];
          case 'stun':
            // 기절: 회색
            return [0.6, 0.6, 0.6, 1.0];
        }
      }
    }

    // 상태 이상이 없으면 기본 빨간색
    return defaultColor;
  }

  /**
   * 활성 상태 이상 필터링 (만료되지 않은 것만)
   * @private
   */
  _getActiveStatusEffects(statusEffects) {
    const currentTime = Date.now();
    return statusEffects.filter(effect => {
      if (!effect.appliedTime || !effect.duration) return false;
      const elapsed = (currentTime - effect.appliedTime) / 1000; // 초 단위
      return elapsed < effect.duration;
    });
  }

  /**
   * 해상도를 업데이트합니다.
   * @param {number[]} resolution - [width, height]
   */
  updateResolution(resolution) {
    this.resolution = resolution;
    this.setUniform('uResolution', resolution);
  }
}
