import { useWindowDimensions } from "react-native";

// Single source of truth for breakpoints across phones/tablets, portrait or
// landscape, iOS or Android — everything derives from actual window width
// via useWindowDimensions (which updates live on rotation/split-view),
// never a hardcoded device size.
const BREAKPOINTS = { tablet: 700, desktop: 1000 };
const GRID_PADDING = 16;
const GRID_GAP = 12;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLargeTablet = width >= BREAKPOINTS.desktop;
  const isLandscape = width > height;

  // 2 columns on phones, 3 on tablets in portrait, 4 on large
  // tablets/landscape — matches how the App Store/Play Store review guides
  // expect grids to reflow instead of just stretching phone-sized cards.
  const gridColumns = isLargeTablet ? 4 : isTablet ? 3 : 2;

  const cardWidth = (width - GRID_PADDING * 2 - GRID_GAP * (gridColumns - 1)) / gridColumns;

  // Forms/checkout/detail content stay legible instead of stretching
  // edge-to-edge on a 12" iPad — capped and centered like a reading column.
  const contentMaxWidth = isTablet ? 640 : width;

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isLandscape,
    gridColumns,
    cardWidth,
    contentMaxWidth,
    gridPadding: GRID_PADDING,
    gridGap: GRID_GAP,
  };
}
