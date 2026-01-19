/**
 * Exponential Moving Average (EMA) Smoother
 * Reduces jitter in tracking data by applying smoothing over time
 */
class Smoother {
  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  /**
   * Update the smoothed value with a new input
   * @param {number} newValue - The new raw value
   * @param {number} alpha - Smoothing factor (0-1, higher = more responsive)
   * @returns {number} The smoothed value
   */
  update(newValue, alpha) {
    this.value = this.value * (1 - alpha) + newValue * alpha;
    return this.value;
  }

  /**
   * Reset the smoother to a specific value
   * @param {number} value - The value to reset to
   */
  reset(value = 0) {
    this.value = value;
  }
}

/**
 * Manages smoothing for X, Y, Z axes
 */
export class PositionSmoother {
  constructor() {
    this.x = new Smoother(0);
    this.y = new Smoother(0);
    this.z = new Smoother(0);
  }

  /**
   * Update all axes with new values
   * @param {Object} position - Object containing x, y, z values
   * @param {Object} alphas - Object containing alpha values for each axis
   * @returns {Object} Smoothed position {x, y, z}
   */
  update(position, alphas = { x: 0.1, y: 0.1, z: 0.15 }) {
    return {
      x: this.x.update(position.x, alphas.x),
      y: this.y.update(position.y, alphas.y),
      z: this.z.update(position.z, alphas.z)
    };
  }

  /**
   * Reset all axes to default or specified values
   * @param {Object} position - Optional position to reset to
   */
  reset(position = { x: 0, y: 0, z: 0 }) {
    this.x.reset(position.x);
    this.y.reset(position.y);
    this.z.reset(position.z);
  }
}
