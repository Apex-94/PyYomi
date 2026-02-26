import { useColorMode } from './ColorModeContext';
import { createAppTheme } from './createAppTheme';

export function useTheme() {
  const { mode, uiMode } = useColorMode();
  return createAppTheme(mode, uiMode);
}
