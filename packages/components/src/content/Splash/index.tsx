import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { type LayoutChangeEvent } from 'react-native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { Stack } from '../../primitives/Stack';

import { SplashView } from './SplashView';

export type ISplashProps = PropsWithChildren;

const noop = () => {};
export function Splash({ children }: ISplashProps) {
  useLayoutEffect(() => {
    defaultLogger.app.perf.markRenderPhase('Splash:committed');
  }, []);
  const resolveSplash = useRef<() => void>(noop);
  const handleExitComplete = useCallback(() => {
    defaultLogger.app.perf.markRenderPhase('Splash:exitComplete');
    globalThis.$$onekeyUIVisibleAt = Date.now();
    if (typeof globalThis.nativePerformanceNow === 'function') {
      globalThis.$$onekeyUIVisibleFromPerformanceNow =
        globalThis.nativePerformanceNow();
    }
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height) {
      defaultLogger.app.perf.markRenderPhase('Splash:onLayout');
      // close the splash after the react commit phase.
      setTimeout(() => {
        resolveSplash.current?.();
      });
    }
  }, []);

  const ready = useMemo(
    () =>
      new Promise<void>((resolve) => {
        resolveSplash.current = resolve;
      }),
    [],
  );

  return (
    <Stack flex={1} onLayout={handleLayout}>
      {children}
      <SplashView ready={ready} onExit={handleExitComplete} />
    </Stack>
  );
}
