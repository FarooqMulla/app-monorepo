import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

let _renderStartAt = 0;

export class AppPerfScene extends BaseScene {
  @LogToConsole()
  public logTime(params: { message: string; data?: any }) {
    return [params];
  }

  @LogToLocal()
  public renderPhase(params: { name: string; elapsedMs: number }) {
    return params;
  }

  public markRenderStart() {
    if (_renderStartAt === 0) {
      _renderStartAt = Date.now();
    }
  }

  public markRenderPhase(name: string) {
    if (_renderStartAt > 0) {
      const elapsedMs = Date.now() - _renderStartAt;
      this.renderPhase({ name, elapsedMs });
    }
  }

  @LogToLocal()
  public profilerRender(params: {
    id: string;
    phase: string;
    actualDuration: number;
    baseDuration: number;
    renderCount: number;
    totalActualDuration: number;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal()
  public tabPreloadStrategy(tier: string) {
    return { tier };
  }

  @LogToLocal()
  public tabPageMounted(routeName: string) {
    return { routeName };
  }

  @LogToLocal()
  public tabPreloadMount(routeName: string) {
    return { routeName };
  }

  @LogToLocal()
  public deviceTierDetected(params: {
    tier: string;
    source: 'cache' | 'default' | 'calibration';
    data?: any;
  }) {
    return params;
  }
}
