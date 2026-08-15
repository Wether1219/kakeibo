import { Theme } from '../../theme';

export interface ChartThemeColors {
  textColor: string;
  gridColor: string;
}

const LIGHT_COLORS: ChartThemeColors = { textColor: '#374151', gridColor: '#E5E7EB' };
const DARK_COLORS: ChartThemeColors = { textColor: '#D1D5DB', gridColor: '#374151' };

export function getChartThemeColors(theme: Theme): ChartThemeColors {
  return theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}
