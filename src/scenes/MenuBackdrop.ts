import Phaser from 'phaser';
import { RosaPlayer } from '../entities/RosaPlayer';
import type { SwimWorld } from '../entities/SwimmingController';

const ADD = Phaser.BlendModes.ADD;

/**
 * Shared animated underwater backdrop for the menu and ending screens,
 * with Rosa swimming slowly along a gentle looping path.
 */
export class MenuBackdrop {
  rosa: RosaPlayer;
  private t = 0;
  private rays: Phaser.GameObjects.Image[] = [];
  private world: SwimWorld = {
    surfaceY: -10000, minX: -10000, maxX: 10000, minY: -10000,
    floorAt: () => 10000, colliders: () => [], currents: () => [],
  };

  constructor(scene: Phaser.Scene, warm = false) {
    const s = scene;
    s.add.image(960, 540, 'bg_grad').setDisplaySize(4200, 1080 * 2.2).setOrigin(0.5, 0.36);
    if (warm) s.add.image(960, 300, 'glow').setScale(14, 6).setTint(0xffc98a).setAlpha(0.22).setBlendMode(ADD);
    for (let i = 0; i < 10; i++) {
      const r = s.add.image(-760 + i * 420, -40, 'ray').setOrigin(0.5, 0).setBlendMode(ADD).setTint(0xcff6ff).setAlpha(0.18).setScale(1 + Math.random(), 1.3);
      r.rotation = -0.2 + Math.random() * 0.1;
      this.rays.push(r);
    }
    s.add.image(960, 1180, 'far_ridge_0').setOrigin(0.5, 1).setTint(0x0c3360).setScale(2.4, 1.3);
    // the rotonda silhouette in the distance
    const ring = s.add.image(1250, 760, 'ring_back').setScale(0.42).setTint(0x2a5f94).setAlpha(0.6);
    const ringF = s.add.image(1250, 760, 'ring_front').setScale(0.42).setTint(0x2a5f94).setAlpha(0.6);
    const statue = s.add.image(1250 + 0, 760 + 0.42 * 360, 'statue').setOrigin(0.5, 1).setScale(0.36).setTint(0x2f6d86).setAlpha(0.7);
    ring.setDepth(1); statue.setDepth(2); ringF.setDepth(3);
    s.add.image(960, 1150, 'far_ridge_1').setOrigin(0.5, 1).setTint(0x081f3e).setScale(2.6, 1).setDepth(4);
    s.add.particles(0, 1120, 'bubble', {
      x: { min: -700, max: 2620 }, speedY: { min: -100, max: -40 }, speedX: { min: -10, max: 10 },
      scale: { min: 0.15, max: 0.5 }, alpha: { start: 0.6, end: 0 }, lifespan: 10000, frequency: 180,
    }).setDepth(5);
    s.add.particles(0, 0, 'snow', {
      x: { min: -700, max: 2620 }, y: { min: 0, max: 1080 }, speedY: { min: 4, max: 16 }, scale: { min: 0.4, max: 1 },
      alpha: { start: 0, end: 0.5 }, lifespan: 6000, frequency: 90, blendMode: ADD,
    }).setDepth(5);
    this.rosa = new RosaPlayer(scene, 1500, 640, 1.0);
    this.rosa.setDepth(20);
  }

  update(dt: number): void {
    this.t += dt;
    // slow figure-eight path; Rosa steers toward a moving point
    const tx = 1340 + Math.sin(this.t * 0.16) * 470;
    const ty = 640 + Math.sin(this.t * 0.32) * 170;
    const dx = tx - this.rosa.x;
    const dy = ty - this.rosa.y;
    const d = Math.hypot(dx, dy) || 1;
    const input = { x: (dx / d) * Math.min(1, d / 200) * 0.5, y: (dy / d) * Math.min(1, d / 200) * 0.5, sprint: false, boost: false };
    this.rosa.update(dt, input, this.world);
    this.rays.forEach((r, i) => r.setAlpha(0.12 + 0.08 * Math.sin(this.t * 0.5 + i)));
  }
}
