import GameLoop from '../common/game-loop';

import { Id, NumMap, Input } from '../common/misc';
import State from '../common/state';
import { Player } from '../common/entity';
import { serialize, deserializeCTS } from '../common/msg';
import ByteBuffer from 'bytebuffer';
import Deque from '../common/deque';

import { Vec2 } from 'planck-js';

import * as constants from '../common/constants';
import ServerSimulation from './server-sim';
import Level from '../common/map';

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
    map: Level,
    broadcast: (buf: ByteBuffer) => void,
    players: Array<Id>,
  ) {
    super({ ups: constants.SERVER_UPS, fps: constants.SERVER_FPS });
    this.broadcast = broadcast;
    this.stateNum = 0;
    this.playerInputs = {};
    this.inputAcks = {};
    this.simulation = new ServerSimulation(map, this.ups);

    for (const p of players) {
      this.simulation.addPlayer(p, 'TODO');
      this.playerInputs[p] = new Deque();
    }
  }

  clientMsg(player_id: Id, data: any): void {
    if (!this.running) return;

    data = deserializeCTS(data);

    const pi = this.playerInputs[player_id]!;
    const newInputs = data.inputs.map_mut(i => {
      const j = i as TimedInput;
      j.stateNum = this.stateNum;
      return j;
    });
    pi.merge_back(newInputs); // TODO: check if pi and data.inputs are disjunct
    this.inputAcks[player_id] = pi.last;
  }

  doUpdate(): void {
    const inputs = new Map<Id, Input>();

    for (const p in this.simulation.state.players) {
      const player = this.simulation.state.players[p];
      const inp = this.getNextInput(p);
      if (inp !== undefined) {
        inputs.set(player.id, inp);
      }
    }

    this.simulation.update(inputs);

    if (this.stateNum % constants.SERVER_BROADCAST_RATE === 0) {
      this.broadcast(
        serialize({
          inputAck: this.inputAcks,
          stateNum: this.stateNum,
          state: this.simulation.state,
        }),
      );
    }
    this.stateNum += 1;
  }

  afterUpdate(): void {
    return;
  }

  private getNextInput(p: string): TimedInput {
    const pi = this.playerInputs[p];
    let inp;
    while (pi.length > 0) {
      inp = pi.pop_front()[0];
      if (
        pi.length === 0 ||
        !this.isOld(inp.stateNum) ||
        this.isOld(pi.last_elem()!.stateNum)
      ) {
        break;
      }
    }
    return inp;
  }

  private isOld(stateNum): boolean {
    return this.stateNum - stateNum >= constants.INPUT_QUEUE_MAX_AGE;
  }
}
