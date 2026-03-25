import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

export class AppPerfScene extends BaseScene {
  @LogToConsole()
  public logTime(params: { message: string; data?: any }) {
    return [params];
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
    source: 'cache' | 'hardware' | 'calibration';
    data?: any;
  }) {
    return params;
  }
}
