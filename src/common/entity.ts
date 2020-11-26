import { Id, reviveVec2, isObjectWithKeys } from './misc';
import { Body, Vec2 } from 'planck-js';

/**
 * A generic entity. It has health, a position, and a velocity.
 */
export abstract class Entity {
  public readonly id: Id;
  public readonly maxHealth: number;

  public position: Vec2;
  public velocity: Vec2;

  private _health: number;

  public constructor(id: Id, health: number, position: Vec2) {
    this.id = id;
    this.maxHealth = health;

    this._health = health;
    this.position = position;
    this.velocity = Vec2.zero();
  }

  public abstract draw(pixi): void;

  public static revive(
    obj: unknown,
    construct: (id: Id, health: number, position: Vec2) => Entity,
  ): Entity {
    if (
      isObjectWithKeys(obj, [
        'id',
        'maxHealth',
        'position',
        '_health',
        'velocity',
      ])
    ) {
      const e = construct(
        obj['id'],
        obj['maxHealth'],
        reviveVec2(obj['position']),
      );
      e._health = obj['_health'];
      e.velocity = reviveVec2(obj['velocity']);
      return e;
    }
    throw new Error("couldn't revive Entity");
  }

  public get health(): number {
    return this._health;
  }

  public get alive(): boolean {
    return this.health > 0;
  }

  public takeDamage(damage: number): void {
    if (damage > this._health) {
      this._health = 0;
    } else {
      this._health -= damage;
    }
  }

  public updateFromBody(body: Body): void {
    this.position = body.getPosition();
    this.velocity = body.getLinearVelocity();
  }
}

/**
 * A player with a name and score. An extension of `Entity`.
 */
export class Player extends Entity {
  public readonly name: string;

  private _firing: boolean;
  private _score: number;

  public constructor(id: Id, health: number, position: Vec2, name: string) {
    super(id, health, position);
    this.name = name;
    this._score = 0;
    this._firing = false;
  }

  public get firing(): boolean {
    return this._firing;
  }

  public set firing(firing: boolean) {
    this._firing = firing;
  }

  public get score(): number {
    return this._score;
  }

  public addScore(points: number): void {
    this._score += points;
  }

  public draw(pixi): void {
    throw new Error('Method not implemented.');
  }

  /**
   * Returns a deep copy of a `Player`.
   */
  public clone(): Player {
    const player = new Player(
      this.id,
      this.health,
      this.position.clone(),
      this.name, // name is NOT deep-copied
    );

    player.velocity = this.velocity.clone();
    return player;
  }

  public static revive(obj: unknown): Player {
    if (isObjectWithKeys(obj, ['name', '_firing', '_score'])) {
      return Entity.revive(obj, (id: Id, health: number, position: Vec2) => {
        const p = new Player(id, health, position, obj['name']);
        p._firing = obj['_firing'];
        p._score = obj['_score'];
        return p;
      }) as Player;
    }
    throw new Error("coudln't revive Player");
  }
}

export class Enemy extends Entity {
  public constructor(id: Id, health: number, position: Vec2) {
    super(id, health, position);
  }

  public draw(pixi): void {
    throw new Error('Method not implemented.');
  }
  //should be fixed in the future
  public move(): void {
    this.position.add(Vec2(0, 1 / 60));
  }
  /**
   * Returns a deep copy of an `Enemy`.
   */
  public clone(): Enemy {
    const enemy = new Enemy(this.id, this.health, this.position.clone());

    enemy.velocity = this.velocity.clone();
    return enemy;
  }

  public static revive(obj: unknown): Enemy {
    if (isObjectWithKeys(obj, [])) {
      return Entity.revive(
        obj,
        (id: Id, health: number, position: Vec2) =>
          new Enemy(id, health, position),
      ) as Enemy;
    }
    throw new Error("couldn't revive Enemy");
  }
}
