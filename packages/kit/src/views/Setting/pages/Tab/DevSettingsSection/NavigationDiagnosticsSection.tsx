import { useCallback } from 'react';
import type { RefObject } from 'react';

import {
  Dialog,
  Toast,
  rootNavigationRef,
  tabletMainViewNavigationRef,
  useClipboard,
} from '@onekeyhq/components';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import {
  type INavigationStateLike,
  inspectTabNavigators,
} from './navigationDiagnosticsUtils';
import { SectionPressItem } from './SectionPressItem';

import type { NavigationContainerRef } from '@react-navigation/native';

type INavigationRef = RefObject<NavigationContainerRef<any>>;

function getRootState(ref: INavigationRef) {
  return ref.current?.getRootState() as INavigationStateLike | undefined;
}

export function NavigationDiagnosticsSection() {
  const { copyText } = useClipboard();

  const handleCopyRootState = useCallback(
    (label: string, ref: INavigationRef) => {
      const rootState = getRootState(ref);
      if (!rootState) {
        Toast.error({
          title: `${label} rootState unavailable`,
          message: 'Navigation container is not ready yet.',
        });
        return;
      }

      copyText(stableStringify(rootState, null, 2), undefined, false);
      Toast.success({
        title: `${label} rootState copied`,
      });
    },
    [copyText],
  );

  const handleInspectTabNavigators = useCallback(
    (label: string, ref: INavigationRef) => {
      const rootState = getRootState(ref);
      if (!rootState) {
        Toast.error({
          title: `${label} rootState unavailable`,
          message: 'Navigation container is not ready yet.',
        });
        return;
      }

      const inspection = inspectTabNavigators(rootState);
      const activeRoutePath = inspection.activeRoutePath.join(' > ');

      if (inspection.hasTwoOrMoreTabNavigators) {
        Toast.error({
          title: `${label}: found ${inspection.tabNavigatorCount} tab navigators`,
          message: activeRoutePath,
        });
      } else {
        Toast.success({
          title: `${label}: ${inspection.tabNavigatorCount} tab navigator`,
          message: activeRoutePath,
        });
      }

      Dialog.debugMessage({
        debugMessage: {
          source: label,
          ...inspection,
        },
      });
    },
    [],
  );

  return (
    <>
      <SectionPressItem
        icon="ClipboardOutline"
        title="Copy rootNavigationRef rootState"
        subtitle="复制 rootNavigationRef 的 rootState 到剪贴板"
        onPress={() => {
          handleCopyRootState('rootNavigationRef', rootNavigationRef);
        }}
      />
      <SectionPressItem
        icon="ClipboardOutline"
        title="Copy tabletMainViewNavigationRef rootState"
        subtitle="复制 tabletMainViewNavigationRef 的 rootState 到剪贴板"
        onPress={() => {
          handleCopyRootState(
            'tabletMainViewNavigationRef',
            tabletMainViewNavigationRef,
          );
        }}
      />
      <SectionPressItem
        icon="SearchOutline"
        title="Check rootNavigationRef for duplicate tabNavigators"
        subtitle="检测 rootNavigationRef 的 rootState 是否存在两个或以上 tabNavigator"
        onPress={() => {
          handleInspectTabNavigators('rootNavigationRef', rootNavigationRef);
        }}
      />
      <SectionPressItem
        icon="SearchOutline"
        title="Check tabletMainViewNavigationRef for duplicate tabNavigators"
        subtitle="检测 tabletMainViewNavigationRef 的 rootState 是否存在两个或以上 tabNavigator"
        onPress={() => {
          handleInspectTabNavigators(
            'tabletMainViewNavigationRef',
            tabletMainViewNavigationRef,
          );
        }}
      />
    </>
  );
}
