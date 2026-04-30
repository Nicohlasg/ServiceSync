"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Home, Briefcase, Calendar, Shield, Settings } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from 'next/navigation';

type IconComponentType = React.ElementType<{ className?: string }>;
export interface InteractiveMenuItem {
  label: string;
  icon: IconComponentType;
  href?: string;
  tutorialId?: string;
}

export interface InteractiveMenuProps {
  items?: InteractiveMenuItem[];
  accentColor?: string;
}

const defaultItems: InteractiveMenuItem[] = [
  { label: 'home', icon: Home },
  { label: 'strategy', icon: Briefcase },
  { label: 'period', icon: Calendar },
  { label: 'security', icon: Shield },
  { label: 'settings', icon: Settings },
];

const defaultAccentColor = 'var(--component-active-color-default)';

const InteractiveMenu: React.FC<InteractiveMenuProps> = ({ items, accentColor }) => {

  const finalItems = useMemo(() => {
    const isValid = items && Array.isArray(items) && items.length >= 2 && items.length <= 5;
    if (!isValid) {
      console.warn("InteractiveMenu: 'items' prop is invalid or missing. Using default items.", items);
      return defaultItems;
    }
    return items;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(0);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const matchedIndex = finalItems.findIndex((item) => {
      if (!item.href) return false;
      return item.href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(item.href);
    });
    if (matchedIndex !== -1) {
      setActiveIndex(matchedIndex);
    }
  }, [pathname, finalItems]);

  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const setLineWidth = () => {
      const activeItemElement = itemRefs.current[activeIndex];
      const activeTextElement = textRefs.current[activeIndex];

      if (activeItemElement && activeTextElement) {
        const textWidth = activeTextElement.offsetWidth;
        activeItemElement.style.setProperty('--lineWidth', `${textWidth}px`);
      }
    };

    setLineWidth();

    window.addEventListener('resize', setLineWidth);
    return () => {
      window.removeEventListener('resize', setLineWidth);
    };
  }, [activeIndex, finalItems]);

  const handleItemClick = (index: number) => {
    setActiveIndex(index);
    const item = finalItems[index];
    if (item.href) {
      router.push(item.href);
    }
  };

  const navStyle = useMemo(() => {
    const activeColor = accentColor || defaultAccentColor;
    return { '--component-active-color': activeColor } as React.CSSProperties;
  }, [accentColor]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.5)]"
      role="navigation"
      style={navStyle}
    >
      {finalItems.map((item, index) => {
        const isActive = index === activeIndex;
        const IconComponent = item.icon;

        return (
          <button
            key={item.label}
            data-tutorial-target={item.tutorialId}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300",
              isActive ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
            )}
            onClick={() => handleItemClick(index)}
            ref={(el) => { itemRefs.current[index] = el }}
            style={{ color: isActive ? accentColor : undefined }}
          >
            {/* Active Indicator Line */}
            <div 
              className={cn(
                "absolute top-0 h-1 bg-current rounded-b-md transition-all duration-300 ease-out",
                isActive ? "opacity-100" : "opacity-0"
              )}
              style={isActive ? { width: 'var(--lineWidth, 32px)' } : { width: '0px' }}
            />
            
            <div 
              className={cn(
                "relative z-10 transition-transform duration-300", 
                isActive && "animate-[iconBounce_0.5s_ease-out_forwards] -translate-y-2 text-current"
              )}
            >
              <IconComponent className="w-5 h-5 pointer-events-none" />
            </div>
            
            <strong
              className={cn(
                "absolute bottom-[6px] text-[10px] uppercase tracking-wider font-semibold transition-all duration-300 pointer-events-none",
                isActive ? "opacity-100 translate-y-0 text-current" : "opacity-0 translate-y-4"
              )}
              ref={(el) => { textRefs.current[index] = el }}
            >
              {item.label}
            </strong>
          </button>
        );
      })}
    </nav>
  );
};

export { InteractiveMenu }
