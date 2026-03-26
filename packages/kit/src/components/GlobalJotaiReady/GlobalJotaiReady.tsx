import { startTransition, useEffect, useState } from 'react';

import { View } from 'react-native';

import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getRenderElapsedMs } from '@onekeyhq/shared/src/logger/scopes/app/scenes/perf';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

export function GlobalJotaiReady({ children }: { children: any }) {
  const [isReady, setIsReady] = useState(
    () => globalJotaiStorageReadyHandler.isReady,
  );
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog(
      'GlobalJotaiReady render',
      `isReady=${isReady}, syncReady=${globalJotaiStorageReadyHandler.isReady}`,
    );
  }
  defaultLogger.app.perf.renderPhase({
    name: isReady ? 'GlobalJotaiReady:syncReady' : 'GlobalJotaiReady:waiting',
    elapsedMs: getRenderElapsedMs(),
  });
  useEffect(() => {
    if (globalJotaiStorageReadyHandler.isReady) {
      setIsReady(true);
      return;
    }
    let isMounted = true;
    void globalJotaiStorageReadyHandler.ready.then((ready) => {
      if (!isMounted) return;
      defaultLogger.app.perf.renderPhase({
        name: 'GlobalJotaiReady:asyncReady',
        elapsedMs: getRenderElapsedMs(),
      });
      startTransition(() => {
        if (process.env.NODE_ENV !== 'production') {
          debugLandingLog('GlobalJotaiReady resolved', `ready=${ready}`);
        }
        setIsReady(ready);
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return <View testID="GlobalJotaiReady-not-ready-placeholder" />;
  }

  return children as JSX.Element;
}
