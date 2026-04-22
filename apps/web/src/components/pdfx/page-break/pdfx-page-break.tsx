import { View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';

/**
 * Forces a page break at the current position in the PDF document.
 * Props - `style`
 * @see {@link PageBreakProps}
 */
export interface PageBreakProps {
  /** Custom styles to merge with component defaults */
  style?: Style;
  children?: never;
}

export function PageBreak({ style }: PageBreakProps) {
  return <View break style={style} />;
}
