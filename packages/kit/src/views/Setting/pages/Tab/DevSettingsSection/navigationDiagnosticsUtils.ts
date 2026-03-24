export type INavigationStateLike = {
  type?: string;
  key?: string;
  index?: number;
  routeNames?: string[];
  routes?: Array<{
    key?: string;
    name?: string;
    state?: INavigationStateLike;
  }>;
};

export type ITabNavigatorMatch = {
  key?: string;
  path: string;
  routeNames: string[];
  activeRouteName?: string;
};

export type ITabNavigatorInspection = {
  hasTwoOrMoreTabNavigators: boolean;
  tabNavigatorCount: number;
  activeRoutePath: string[];
  tabNavigators: ITabNavigatorMatch[];
};

function getSafeRouteIndex(index: number | undefined, length: number) {
  if (length <= 0) {
    return 0;
  }
  if (typeof index !== 'number' || index < 0 || index >= length) {
    return 0;
  }
  return index;
}

function getRouteNames(state: INavigationStateLike) {
  if (state.routeNames?.length) {
    return state.routeNames;
  }
  return (state.routes ?? [])
    .map((route) => route.name)
    .filter((routeName): routeName is string => Boolean(routeName));
}

function collectTabNavigators(
  state: INavigationStateLike | undefined,
  path: string[] = ['root'],
): ITabNavigatorMatch[] {
  if (!state) {
    return [];
  }

  const routes = state.routes ?? [];
  const routeIndex = getSafeRouteIndex(state.index, routes.length);
  const activeRouteName = routes[routeIndex]?.name;
  const matches =
    state.type === 'tab'
      ? [
          {
            key: state.key,
            path: path.join(' > '),
            routeNames: getRouteNames(state),
            activeRouteName,
          },
        ]
      : [];

  routes.forEach((route, index) => {
    if (!route.state) {
      return;
    }
    const routeName = route.name ?? `route[${index}]`;
    matches.push(...collectTabNavigators(route.state, [...path, routeName]));
  });

  return matches;
}

function getActiveRoutePath(
  state: INavigationStateLike | undefined,
  path: string[] = ['root'],
): string[] {
  if (!state) {
    return path;
  }

  const routes = state.routes ?? [];
  if (!routes.length) {
    return path;
  }

  const routeIndex = getSafeRouteIndex(state.index, routes.length);
  const activeRoute = routes[routeIndex];
  const routeName = activeRoute?.name ?? `route[${routeIndex}]`;
  const nextPath = [...path, routeName];

  if (!activeRoute?.state) {
    return nextPath;
  }

  return getActiveRoutePath(activeRoute.state, nextPath);
}

export function inspectTabNavigators(
  state: INavigationStateLike | undefined,
): ITabNavigatorInspection {
  const tabNavigators = collectTabNavigators(state);
  return {
    hasTwoOrMoreTabNavigators: tabNavigators.length >= 2,
    tabNavigatorCount: tabNavigators.length,
    activeRoutePath: getActiveRoutePath(state),
    tabNavigators,
  };
}
