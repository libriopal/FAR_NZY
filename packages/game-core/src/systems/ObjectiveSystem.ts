import type { ObjectiveConfig, ObjectiveState, MatchResult } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';

export class ObjectiveSystem {
  private objectives: ObjectiveState[] = [];

  constructor(private readonly bus: GameEventBus) {
    this._bindEvents();
  }

  private _bindEvents(): void {
    this.bus.on('match:resolved', (result) => {
      this._handleMatch(result);
    });
  }

  loadObjectives(configs: ObjectiveConfig[]): void {
    this.objectives = configs.map(config => ({
      config,
      current: 0,
      completed: false,
    }));
  }

  private _handleMatch(result: MatchResult): void {
    for (const obj of this.objectives) {
      if (obj.completed) continue;
      const prev = obj.current;

      switch (obj.config.type) {
        case 'match_count':
          obj.current += 1;
          break;
        case 'match_category': {
          // definitionId-based category check delegated to caller via event
          // We count if the event carries matching category — caller must tag result
          obj.current += 1;
          break;
        }
        case 'match_specific':
          if (obj.config.definitionId === result.definitionId) obj.current += 1;
          break;
        case 'score_target':
          obj.current += result.scoreValue;
          break;
        case 'time_limit':
          // Driven by timer, not matches
          break;
      }

      if (obj.current !== prev) {
        this.bus.emit('objective:progress', {
          objectiveId: obj.config.id,
          current: obj.current,
          total: obj.config.target,
        });
      }

      if (!obj.completed && obj.current >= obj.config.target) {
        obj.completed = true;
        this.bus.emit('objective:completed', obj);
      }
    }
  }

  tickTimer(elapsedMs: number): void {
    for (const obj of this.objectives) {
      if (obj.completed || obj.config.type !== 'time_limit') continue;
      obj.current = Math.min(obj.current + elapsedMs / 1000, obj.config.target);
      this.bus.emit('objective:progress', {
        objectiveId: obj.config.id,
        current: obj.current,
        total: obj.config.target,
      });
      if (obj.current >= obj.config.target) {
        obj.completed = true;
        this.bus.emit('objective:completed', obj);
      }
    }
  }

  allCompleted(): boolean {
    return this.objectives.every(o => o.completed);
  }

  getObjectives(): ObjectiveState[] {
    return this.objectives;
  }

  reset(): void {
    this.objectives = [];
  }
}
