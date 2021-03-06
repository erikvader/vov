import GameLoop from '../common/game-loop';

import { Id, NumMap, Input } from '../common/misc';
import { serialize, deserializeCTS } from '../common/msg';
import ByteBuffer from 'bytebuffer';
import Deque from '../common/deque';

import * as constants from '../common/constants';
import ServerSimulation from './serverSimulation';
import GameMap from '../common/gameMap';
import State from '../common/state';

/**
 * [[Input]], but it also remembers on which [[ServerGame.stateNum]] it was
 * added on.
 */
interface TimedInput extends Input {
  stateNum: number;
}

export default class ServerGame extends GameLoop {
  private stateNum: number;
  private broadcast;
  private simulation: ServerSimulation;
  private playerInputs: NumMap<Deque<TimedInput>>;
  private inputAcks: NumMap<number>;

  constructor(
    map: GameMap,
    broadcast: (buf: ByteBuffer) => void,
    players: Array<Id>,
    seed: string,
  ) {
    super({ ups: constants.SERVER.UPS, fps: constants.SERVER.FPS });
    this.broadcast = broadcast;
    this.stateNum = 0;
    this.playerInputs = {};
    this.inputAcks = {};
    this.simulation = new ServerSimulation(
      map,
      this.ups / 1000,
      players.length,
      seed,
    );

    for (const p of players) {
      this.playerInputs[p] = new Deque();
    }
  }

  get state(): State {
    return this.simulation.state;
  }

  clientMsg(player_id: Id, data: any): void {
    if (!this.running) return;

    data = deserializeCTS(data);

    const playerInput = this.playerInputs[player_id]!;
    const newInputs = data.inputs.map_mut(i => {
      const j = i as TimedInput;
      j.stateNum = this.stateNum;
      return j;
    });
    playerInput.merge_back(newInputs); // TODO: check if playerInput and data.inputs are disjunct
  }

  doUpdate(): void {
    const inputs = new Map<Id, Input>();
    let someoneIsStillAlive = false;
    for (const p in this.simulation.state.players) {
      const player = this.simulation.state.players[p];
      const inp = this.getNextInput(p);
      if (inp !== undefined) {
        inputs.set(player.id, inp);
      }
      if (player.alive) {
        someoneIsStillAlive = true;
      }
    }
    this.simulation.update(inputs);

    if (this.stateNum % constants.SERVER.BROADCAST_RATE === 0) {
      this.broadcast(
        serialize({
          inputAck: this.inputAcks,
          stateNum: this.stateNum,
          state: this.simulation.state,
        }),
      );
    }

    if (!someoneIsStillAlive) {
      this.stop();
    }
    this.stateNum += 1;
  }

  afterUpdate(): void {
    return;
  }

  private getNextInput(p: string): TimedInput {
    const playerInput = this.playerInputs[p];
    let input;
    let inputNum;
    while (playerInput.length > 0) {
      const tmp = playerInput.pop_front();
      input = tmp[0];
      inputNum = tmp[1];
      if (
        playerInput.length === 0 ||
        !this.isOld(input.stateNum) ||
        this.isOld(playerInput.last_elem()!.stateNum)
      ) {
        break;
      }
    }

    if (inputNum !== undefined) this.inputAcks[p] = inputNum;
    return input;
  }

  private isOld(stateNum): boolean {
    return this.stateNum - stateNum >= constants.SERVER.INPUT_QUEUE_MAX_AGE;
  }
}
