export class TargetingPolicy {
  static FIRST(tower, foodList, multiPathSystem) {
    // Target food furthest along its path (closest to exit)
    let best = null;
    let maxD = -Infinity;

    for (const food of foodList) {
      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      const dx = pos.x - tower.x;
      const dy = pos.y - tower.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= tower.range * tower.range && food.d > maxD) {
        maxD = food.d;
        best = food;
      }
    }
    return best;
  }

  static CLOSEST(tower, foodList, multiPathSystem) {
    // Target closest food by Euclidean distance
    let best = null;
    let minDistSq = Infinity;

    for (const food of foodList) {
      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      const dx = pos.x - tower.x;
      const dy = pos.y - tower.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= tower.range * tower.range && distSq < minDistSq) {
        minDistSq = distSq;
        best = food;
      }
    }
    return best;
  }

  static STRONGEST(tower, foodList, multiPathSystem) {
    // Target food with highest HP
    let best = null;
    let maxHp = -Infinity;

    for (const food of foodList) {
      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      const dx = pos.x - tower.x;
      const dy = pos.y - tower.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= tower.range * tower.range && food.hp > maxHp) {
        maxHp = food.hp;
        best = food;
      }
    }
    return best;
  }
}
