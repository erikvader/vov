import { Id, Input } from '../common/misc';
import Simulation from '../common/simulation';
import GameMap from '../common/gameMap';

export default class ServerSimulation extends Simulation {
  constructor(
    gameMap: GameMap,
    updateStep: number,
    numPlayers: number,
    seed: string,
  ) {
    super(gameMap, updateStep, numPlayers, seed);
  }

  public update(inputs: Map<Id, Input>): void {
    this.commonUpdate();

    for (const id in this.state.players) {
      const idNum = parseInt(id);
      const body = this.bodies.get(idNum)!;
      const input = inputs.get(idNum);
      this.handlePlayerInput(body, this.state.players[idNum], input);
    }

    this.world.step(this.updateStep);

    this.updateState();
  }
}
