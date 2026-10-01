import type { Rect } from '../level/RotondaData';

export interface SwimInput {
  x: number;
  y: number;
  sprint: boolean;
  boost: boolean;
}

export interface CurrentZone extends Rect {
  fx: number;
  fy: number;
}

export interface SwimWorld {
  surfaceY: number;
  minX: number;
  maxX: number;
  minY: number;
  floorAt: (x: number) => number;
  colliders: () => Rect[];
  currents: () => CurrentZone[];
}

export interface SwimEvents {
  boosted: boolean;
  leftWater: boolean;
  enteredWater: boolean;
  bumped: boolean;
}

/**
 * Underwater movement model: acceleration, drag, inertia, a boost impulse, and
 * real breaches above the surface (gravity takes over in the air).
 */
export class SwimmingController {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  airborne = false;
  boostTimer = 0;
  boostCooldown = 0;
  readonly radius = 38;

  // tuning
  maxSpeed = 440;
  sprintSpeed = 680;
  accel = 1600;
  sprintAccel = 2200;
  boostSpeed = 660;
  boostCap = 1180;
  gravity = 1500;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /** 0..1 normalised speed for animation. */
  get speed01(): number {
    return Math.min(1, this.speed / this.sprintSpeed);
  }

  update(dt: number, input: SwimInput, world: SwimWorld): SwimEvents {
    const ev: SwimEvents = { boosted: false, leftWater: false, enteredWater: false, bumped: false };
    let ix = input.x;
    let iy = input.y;
    const il = Math.hypot(ix, iy);
    if (il > 1) {
      ix /= il;
      iy /= il;
    }
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.boostTimer = Math.max(0, this.boostTimer - dt);

    if (Math.abs(ix) > 0.1) this.facing = ix > 0 ? 1 : -1;
    else if (Math.abs(this.vx) > 60) this.facing = this.vx > 0 ? 1 : -1;

    if (!this.airborne) {
      const acc = input.sprint ? this.sprintAccel : this.accel;
      this.vx += ix * acc * dt;
      this.vy += iy * acc * dt;

      // water drag: stronger when gliding without input => graceful deceleration
      const drag = il > 0.05 ? 1.1 : 2.1;
      const k = Math.exp(-drag * dt);
      this.vx *= k;
      this.vy *= k;

      if (input.boost && this.boostCooldown <= 0) {
        let dx = ix;
        let dy = iy;
        if (Math.hypot(dx, dy) < 0.1) {
          const s = this.speed;
          if (s > 40) {
            dx = this.vx / s;
            dy = this.vy / s;
          } else {
            dx = this.facing;
            dy = 0;
          }
        }
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const along = Math.max(0, this.vx * dx + this.vy * dy);
        const target = Math.min(this.boostCap, along + this.boostSpeed);
        this.vx = dx * target + (this.vx - dx * along) * 0.4;
        this.vy = dy * target + (this.vy - dy * along) * 0.4;
        this.boostTimer = 0.5;
        this.boostCooldown = 0.7;
        ev.boosted = true;
      }

      // soft speed cap
      const cap = this.boostTimer > 0 ? this.boostCap : input.sprint ? this.sprintSpeed : this.maxSpeed;
      const s = this.speed;
      if (s > cap) {
        const f = 1 - (1 - cap / s) * (1 - Math.exp(-5 * dt));
        this.vx *= f;
        this.vy *= f;
      }

      for (const c of world.currents()) {
        if (this.x > c.x && this.x < c.x + c.w && this.y > c.y && this.y < c.y + c.h) {
          this.vx += c.fx * dt;
          this.vy += c.fy * dt;
        }
      }
    } else {
      this.vy += this.gravity * dt;
      this.vx += ix * 220 * dt;
      this.vx *= Math.exp(-0.25 * dt);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // surface handling
    const surf = world.surfaceY;
    if (!this.airborne) {
      if (this.y < surf + 14) {
        if (this.vy < -380) {
          this.airborne = true;
          ev.leftWater = true;
        } else {
          this.y = surf + 14;
          if (this.vy < 0) this.vy *= 0.2;
        }
      }
    } else if (this.y > surf + 4 && this.vy > 0) {
      this.airborne = false;
      ev.enteredWater = true;
      this.vy *= 0.45;
      this.vx *= 0.7;
    }

    // seabed
    const r = this.radius;
    const fy = world.floorAt(this.x) - r * 0.8;
    if (this.y > fy) {
      this.y = fy;
      if (this.vy > 0) this.vy = -this.vy * 0.2;
      ev.bumped = true;
    }

    // solid rectangles
    for (const c of world.colliders()) {
      const nx = Math.max(c.x, Math.min(this.x, c.x + c.w));
      const ny = Math.max(c.y, Math.min(this.y, c.y + c.h));
      let dx = this.x - nx;
      let dy = this.y - ny;
      let d = Math.hypot(dx, dy);
      if (d < r) {
        if (d < 0.001) {
          // centre inside the rect: push out along the shallowest axis
          const left = this.x - c.x;
          const right = c.x + c.w - this.x;
          const top = this.y - c.y;
          const bottom = c.y + c.h - this.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) { dx = -1; dy = 0; }
          else if (m === right) { dx = 1; dy = 0; }
          else if (m === top) { dx = 0; dy = -1; }
          else { dx = 0; dy = 1; }
          d = 0;
          this.x = m === left ? c.x - r : m === right ? c.x + c.w + r : this.x;
          this.y = m === top ? c.y - r : m === bottom ? c.y + c.h + r : this.y;
        } else {
          dx /= d;
          dy /= d;
          this.x += dx * (r - d);
          this.y += dy * (r - d);
        }
        const vn = this.vx * dx + this.vy * dy;
        if (vn < 0) {
          this.vx -= dx * vn * 1.25;
          this.vy -= dy * vn * 1.25;
        }
        ev.bumped = true;
      }
    }

    // world bounds
    if (this.x < world.minX) { this.x = world.minX; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > world.maxX) { this.x = world.maxX; this.vx = -Math.abs(this.vx) * 0.3; }
    if (this.y < world.minY) { this.y = world.minY; this.vy = Math.abs(this.vy) * 0.2; }

    return ev;
  }
}
