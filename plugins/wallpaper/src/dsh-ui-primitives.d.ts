declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactElement, ReactNode } from 'react';

  export interface MenuItem {
    id: string;
    label: ReactNode;
    disabled?: boolean;
  }

  export interface IconProps {
    size?: number;
    className?: string;
  }

  export function IconChevronDownOutline14(props: IconProps): ReactElement;
  export function IconCloseOutline16(props: IconProps): ReactElement;

  export function Menu(props: {
    open: boolean;
    anchor: ReactNode;
    items: readonly MenuItem[];
    selectedId?: string;
    onSelect(id: string): void;
    onClose(): void;
    align?: 'start' | 'end';
    side?: 'bottom' | 'top' | 'right';
    portal?: boolean;
    compact?: boolean;
    className?: string;
  }): ReactElement;
}
