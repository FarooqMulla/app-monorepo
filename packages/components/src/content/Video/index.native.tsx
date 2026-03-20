import NativeVideo from 'react-native-video';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IVideoProps } from './type';
import type { ViewStyle } from 'react-native';

export function Video({ muted, autoPlay, ...rawProps }: IVideoProps) {
  const [props, style] = usePropsAndStyle(rawProps);
  const { autoPlay: _autoPlay, ...restProps } = props as any;
  const paused = autoPlay === false;
  return (
    <NativeVideo
      style={style as ViewStyle}
      muted={muted}
      paused={paused}
      {...restProps}
    />
  );
}

export type * from './type';
export * from './enum';
