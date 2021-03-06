import GameMap from '../common/gameMap';
import { Input, Id } from '../common/misc';
import Simulation, { createBody } from '../common/simulation';
import { Vec2 } from 'planck-js';

import State from '../common/state';

export interface SimState {
  state: State;
  stepCounter: number;
  // NOTE: intentionally ignored
  rngState: undefined; //seedrandom.State;
}

export default class ClientSimulation extends Simulation {
  constructor(
    map: GameMap,
    updateStep: number,
    numPlayers: number,
    seed: string,
  ) {
    super(map, updateStep, numPlayers, seed, { state: true });
  }

  protected updateWave(_killed: number): void {
    return;
  }

  private predictOtherPlayers(me: Id): void {
    for (const [id, body] of this._bodies) {
      if (!(id in this.state.players) || id === me) return;
      // don't predict other players
      body.setLinearVelocity(Vec2.zero());
    }
  }

  public update(me: Id, input: Input): void {
    this.commonUpdate();

    const my_body = this.bodies.get(me);
    if (my_body !== undefined) {
      this.handlePlayerInput(my_body, this.state.players[me], input);
    }

    this.predictOtherPlayers(me);

    this.world.step(this.updateStep);

    this.updateState();
  }

  public reset(simState: SimState): void {
    this._stepCounter = simState.stepCounter;
    // NOTE: intentionally ignored
    // this._random = seedrandom('', { state: simState.rngState });
    const state = simState.state;

    const newPlayerIds = new Array<string>();
    for (const id in state.players)
      if (!(id in this.state.players)) newPlayerIds.push(id);

    const newEnemyIds = new Array<string>();
    for (const id in state.enemies)
      if (!(id in this.state.enemies)) newEnemyIds.push(id);

    const deletedIds = new Array<number>();
    this.bodies.forEach((body, id) => {
      if (id in state.players) {
        const player = state.players[id];
        body.setPosition(player.position);
        body.setLinearVelocity(player.velocity);
      } else if (id in state.enemies) {
        const enemy = state.enemies[id];
        body.setPosition(enemy.position);
        body.setLinearVelocity(enemy.velocity);
      } else {
        deletedIds.push(id);
      }
    });

    for (const id of deletedIds) {
      const body = this.bodies.get(id);
      if (body) this.world.destroyBody(body);
      this.bodies.delete(id);
    }

    for (const id of newPlayerIds) {
      const body = createBody(this.world, state.players[id]);
      this.bodies.set(parseInt(id), body);
    }

    for (const id of newEnemyIds) {
      const body = createBody(this.world, state.enemies[id]);
      this.bodies.set(parseInt(id), body);
    }

    this._state = state.clone();
  }

  public snapshot(): SimState {
    return {
      state: this.state.clone(),
      // NOTE: intentionally ignored
      rngState: undefined, //this._random.state(),
      stepCounter: this._stepCounter,
    };
  }
}
