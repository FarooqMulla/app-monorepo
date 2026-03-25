import { memo, useEffect } from 'react';
import type { ComponentType } from 'react';

import { useRoute } from '@react-navigation/native';

import { Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Helper type to extract component props from a lazy-loaded module
type IExtractComponentProps<T> = T extends () => Promise<{
  default: ComponentType<infer P>;
}>
  ? P
  : never;

export function LazyLoadPage<
  T extends () => Promise<{ default: ComponentType<any> }>,
>(
  factory: T,
  delayMs?: number,
  unStyle?: boolean,
  fallback?: React.ReactNode,
): ComponentType<IExtractComponentProps<T>> {
  const LazyLoadComponent = LazyLoad<IExtractComponentProps<T>>(
    factory as () => Promise<{
      default: ComponentType<IExtractComponentProps<T>>;
    }>,
    delayMs,
    fallback,
  );
  function LazyLoadPageContainer(props: IExtractComponentProps<T>) {
    if (unStyle) {
      return <LazyLoadComponent {...props} />;
    }

    return (
      <Stack
        flex={1}
        className="LazyLoadPageContainer"
        bg={
          platformEnv.isNative ||
          platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel ||
          platformEnv.isExtensionBackground
            ? '$bgApp'
            : '$bgSubdued'
        }
      >
        <LazyLoadComponent {...props} />
      </Stack>
    );
  }
  return memo(LazyLoadPageContainer) as ComponentType<
    IExtractComponentProps<T>
  >;
}

// prevent useEffect triggers when tab loaded on Native
export const LazyLoadRootTabPage = (
  factory: () => Promise<{ default: any }>,
) => {
  // prevent hooks run
  const Page = LazyLoadPage(factory, platformEnv.isNative ? 1 : undefined);
  function RootTabPageWithMountLog(props: any) {
    const route = useRoute();
    useEffect(() => {
      defaultLogger.app.perf.tabPageMounted(route.name);
    }, [route.name]);
    return <Page {...props} />;
  }
  return memo(RootTabPageWithMountLog);
};
