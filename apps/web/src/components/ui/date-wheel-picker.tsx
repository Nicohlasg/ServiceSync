"use client";

import * as React from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo, MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DateWheelPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  locale?: string;
  /** CSS color for the fade-out gradient edges, e.g. "#f8fafc" or "rgb(248,250,252)". Defaults to var(--background). */
  fadeColor?: string;
  /** "light" for light-background containers, "dark" for dark-background containers. Defaults to "dark". */
  variant?: "light" | "dark";
}

export interface TimeWheelPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** "HH:mm" format, e.g. "09:00" */
  value: string;
  onChange: (time: string) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  minuteStep?: number;
  /** CSS color for the fade-out gradient edges. Defaults to var(--background). */
  fadeColor?: string;
  /** "light" for light-background containers, "dark" for dark-background containers. Defaults to "dark". */
  variant?: "light" | "dark";
}

export interface MonthWheelPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  locale?: string;
  /** CSS color for the fade-out gradient edges. Defaults to var(--background). */
  fadeColor?: string;
  /** "light" for light-background containers, "dark" for dark-background containers. Defaults to "dark". */
  variant?: "light" | "dark";
}

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const PERSPECTIVE_ORIGIN = ITEM_HEIGHT * 2;

function getMonthNames(locale?: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(2000, i, 1))
  );
}

const sizeConfig = {
  sm: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS * 0.8,
    itemHeight: ITEM_HEIGHT * 0.8,
    fontSize: "text-sm",
    gap: "gap-2",
  },
  md: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    itemHeight: ITEM_HEIGHT,
    fontSize: "text-base",
    gap: "gap-4",
  },
  lg: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS * 1.2,
    itemHeight: ITEM_HEIGHT * 1.2,
    fontSize: "text-lg",
    gap: "gap-6",
  },
};

interface WheelItemProps {
  item: string | number;
  index: number;
  y: MotionValue<number>;
  itemHeight: number;
  visibleItems: number;
  centerOffset: number;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: "light" | "dark";
}

function WheelItem({
  item,
  index,
  y,
  itemHeight,
  visibleItems,
  centerOffset,
  isSelected,
  disabled,
  onClick,
  variant = "dark",
}: WheelItemProps) {
  const itemY = useTransform(
    y,
    (latest) => {
      const offset = index * itemHeight + latest + centerOffset;
      return offset;
    }
  );

  const rotateX = useTransform(
    itemY,
    [0, centerOffset, itemHeight * visibleItems],
    [45, 0, -45]
  );

  const scale = useTransform(
    itemY,
    [0, centerOffset, itemHeight * visibleItems],
    [0.8, 1, 0.8]
  );

  const opacity = useTransform(
    itemY,
    [0, centerOffset * 0.5, centerOffset, centerOffset * 1.5, itemHeight * visibleItems],
    [0.3, 0.6, 1, 0.6, 0.3]
  );

  return (
    <motion.div
      className="flex items-center justify-center select-none"
      style={{
        height: itemHeight,
        rotateX,
        scale,
        opacity,
        transformStyle: "preserve-3d",
        transformOrigin: `center center -${PERSPECTIVE_ORIGIN}px`,
      }}
      onClick={() => !disabled && onClick()}
    >
      <span className={cn(
        "font-medium transition-colors",
        variant === "light"
          ? (isSelected ? "text-slate-900" : "text-slate-400")
          : (isSelected ? "text-foreground" : "text-muted-foreground")
      )}>
        {item}
      </span>
    </motion.div>
  );
}

interface WheelColumnProps {
  items: (string | number)[];
  value: number;
  onChange: (index: number) => void;
  itemHeight: number;
  visibleItems: number;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  fadeColor?: string;
  variant?: "light" | "dark";
}

function WheelColumn({
  items,
  value,
  onChange,
  itemHeight,
  visibleItems,
  disabled,
  className,
  ariaLabel,
  fadeColor,
  variant = "dark",
}: WheelColumnProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const y = useMotionValue(-value * itemHeight);
  const centerOffset = Math.floor(visibleItems / 2) * itemHeight;

  const valueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  const itemsLengthRef = React.useRef(items.length);

  React.useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    itemsLengthRef.current = items.length;
  });

  React.useEffect(() => {
    animate(y, -value * itemHeight, {
      type: "spring",
      stiffness: 300,
      damping: 30,
    });
  }, [value, itemHeight, y]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;

    const currentY = y.get();
    const velocity = info.velocity.y;
    const projectedY = currentY + velocity * 0.2;

    let newIndex = Math.round(-projectedY / itemHeight);
    newIndex = Math.max(0, Math.min(items.length - 1, newIndex));

    onChange(newIndex);
  };

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const direction = e.deltaY > 0 ? 1 : -1;
      const currentValue = valueRef.current;
      const maxIndex = itemsLengthRef.current - 1;
      const newIndex = Math.max(0, Math.min(maxIndex, currentValue + direction));

      if (newIndex !== currentValue) {
        onChangeRef.current(newIndex);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    const maxIndex = items.length - 1;
    let newIndex = value;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        newIndex = Math.max(0, value - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        newIndex = Math.min(maxIndex, value + 1);
        break;
      case "Home":
        e.preventDefault();
        newIndex = 0;
        break;
      case "End":
        e.preventDefault();
        newIndex = maxIndex;
        break;
      case "PageUp":
        e.preventDefault();
        newIndex = Math.max(0, value - 5);
        break;
      case "PageDown":
        e.preventDefault();
        newIndex = Math.min(maxIndex, value + 5);
        break;
      default:
        return;
    }

    if (newIndex !== value) {
      onChange(newIndex);
    }
  };

  const dragConstraints = React.useMemo(() => ({
    top: -(items.length - 1) * itemHeight,
    bottom: 0,
  }), [items.length, itemHeight]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      style={{ height: itemHeight * visibleItems }}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={items.length - 1}
      aria-valuetext={String(items[value])}
      aria-disabled={disabled}
    >
      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{
          height: centerOffset,
          background: `linear-gradient(to bottom, ${fadeColor ?? "var(--background)"} 0%, transparent 100%)`,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{
          height: centerOffset,
          background: `linear-gradient(to top, ${fadeColor ?? "var(--background)"} 0%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      <div
        className={cn(
          "absolute inset-x-0 z-5 pointer-events-none border-y",
          variant === "light"
            ? "border-slate-200 bg-slate-100/50"
            : "border-border bg-muted/30"
        )}
        style={{
          top: centerOffset,
          height: itemHeight,
        }}
        aria-hidden="true"
      />

      <motion.div
        className="cursor-grab active:cursor-grabbing"
        style={{
          y,
          paddingTop: centerOffset,
          paddingBottom: centerOffset,
        }}
        drag="y"
        dragConstraints={dragConstraints}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
      >
        {items.map((item, index) => (
          <WheelItem
            key={`${item}-${index}`}
            item={item}
            index={index}
            y={y}
            itemHeight={itemHeight}
            visibleItems={visibleItems}
            centerOffset={centerOffset}
            isSelected={index === value}
            disabled={disabled}
            onClick={() => onChange(index)}
            variant={variant}
          />
        ))}
      </motion.div>
    </div>
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/* ─── DateWheelPicker ─── */
const DateWheelPicker = React.forwardRef<HTMLDivElement, DateWheelPickerProps>(
  (
    {
      value,
      onChange,
      minYear = 1920,
      maxYear = new Date().getFullYear() + 5,
      size = "md",
      disabled = false,
      locale,
      fadeColor,
      variant = "dark",
      className,
      ...props
    },
    ref
  ) => {
    const config = sizeConfig[size];

    const months = React.useMemo(() => getMonthNames(locale), [locale]);

    const years = React.useMemo(() => {
      const arr: number[] = [];
      for (let y = maxYear; y >= minYear; y--) {
        arr.push(y);
      }
      return arr;
    }, [minYear, maxYear]);

    const [dateState, setDateState] = React.useState(() => {
      const currentDate = value || new Date();
      return {
        day: currentDate.getDate(),
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
      };
    });

    const isInternalChange = React.useRef(false);

    const days = React.useMemo(() => {
      const daysInMonth = getDaysInMonth(dateState.year, dateState.month);
      return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }, [dateState.month, dateState.year]);

    const handleDayChange = React.useCallback((dayIndex: number) => {
      isInternalChange.current = true;
      setDateState(prev => ({ ...prev, day: dayIndex + 1 }));
    }, []);

    const handleMonthChange = React.useCallback((monthIndex: number) => {
      isInternalChange.current = true;
      setDateState(prev => {
        const daysInNewMonth = getDaysInMonth(prev.year, monthIndex);
        const adjustedDay = Math.min(prev.day, daysInNewMonth);
        return { ...prev, month: monthIndex, day: adjustedDay };
      });
    }, []);

    const handleYearChange = React.useCallback((yearIndex: number) => {
      isInternalChange.current = true;
      setDateState(prev => {
        const newYear = years[yearIndex];
        const daysInNewMonth = getDaysInMonth(newYear, prev.month);
        const adjustedDay = Math.min(prev.day, daysInNewMonth);
        return { ...prev, year: newYear, day: adjustedDay };
      });
    }, [years]);

    React.useEffect(() => {
      if (isInternalChange.current) {
        const newDate = new Date(dateState.year, dateState.month, dateState.day);
        onChange(newDate);
        isInternalChange.current = false;
      }
    }, [dateState, onChange]);

    React.useEffect(() => {
      if (value && !isInternalChange.current) {
        const valueDay = value.getDate();
        const valueMonth = value.getMonth();
        const valueYear = value.getFullYear();

        if (
          valueDay !== dateState.day ||
          valueMonth !== dateState.month ||
          valueYear !== dateState.year
        ) {
          setDateState({
            day: valueDay,
            month: valueMonth,
            year: valueYear,
          });
        }
      }
    }, [value, dateState.day, dateState.month, dateState.year]);

    const yearIndex = years.indexOf(dateState.year);

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center",
          config.gap,
          config.fontSize,
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        style={{ perspective: "1000px" }}
        role="group"
        aria-label="Date picker"
        {...props}
      >
        <WheelColumn
          items={days}
          value={dateState.day - 1}
          onChange={handleDayChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-16"
          ariaLabel="Select day"
        />

        <WheelColumn
          items={months}
          value={dateState.month}
          onChange={handleMonthChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-28"
          ariaLabel="Select month"
        />

        <WheelColumn
          items={years}
          value={yearIndex >= 0 ? yearIndex : 0}
          onChange={handleYearChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-20"
          ariaLabel="Select year"
        />
      </div>
    );
  }
);

DateWheelPicker.displayName = "DateWheelPicker";

/* ─── TimeWheelPicker ─── */
const TimeWheelPicker = React.forwardRef<HTMLDivElement, TimeWheelPickerProps>(
  (
    {
      value,
      onChange,
      size = "md",
      disabled = false,
      minuteStep = 15,
      fadeColor,
      variant = "dark",
      className,
      ...props
    },
    ref
  ) => {
    const config = sizeConfig[size];

    const hours = React.useMemo(
      () => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")),
      []
    );

    const minuteItems = React.useMemo(
      () => Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) =>
        (i * minuteStep).toString().padStart(2, "0")
      ),
      [minuteStep]
    );

    const [h, rawM] = value.split(":");
    const hourIndex = hours.indexOf(h) >= 0 ? hours.indexOf(h) : 0;
    // Snap to nearest valid minute step
    const minuteIndex = minuteItems.indexOf(rawM) >= 0
      ? minuteItems.indexOf(rawM)
      : 0;

    const handleHourChange = React.useCallback((idx: number) => {
      const newH = hours[idx];
      const currentM = value.split(":")[1] || "00";
      const snappedM = minuteItems.includes(currentM) ? currentM : minuteItems[0];
      onChange(`${newH}:${snappedM}`);
    }, [hours, minuteItems, onChange, value]);

    const handleMinuteChange = React.useCallback((idx: number) => {
      const currentH = value.split(":")[0] || "00";
      onChange(`${currentH}:${minuteItems[idx]}`);
    }, [minuteItems, onChange, value]);

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center",
          config.gap,
          config.fontSize,
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        style={{ perspective: "1000px" }}
        role="group"
        aria-label="Time picker"
        {...props}
      >
        <WheelColumn
          items={hours}
          value={hourIndex}
          onChange={handleHourChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-16"
          ariaLabel="Select hour"
        />

        <div className={cn(
          "flex items-center text-2xl font-black select-none",
          variant === "light" ? "text-slate-900" : "text-foreground"
        )}>:</div>

        <WheelColumn
          items={minuteItems}
          value={minuteIndex}
          onChange={handleMinuteChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-16"
          ariaLabel="Select minute"
        />
      </div>
    );
  }
);

TimeWheelPicker.displayName = "TimeWheelPicker";

/* ─── MonthWheelPicker ─── */
const MonthWheelPicker = React.forwardRef<HTMLDivElement, MonthWheelPickerProps>(
  (
    {
      value,
      onChange,
      minYear = new Date().getFullYear() - 5,
      maxYear = new Date().getFullYear() + 5,
      size = "md",
      disabled = false,
      locale,
      fadeColor,
      variant = "dark",
      className,
      ...props
    },
    ref
  ) => {
    const config = sizeConfig[size];

    const months = React.useMemo(() => getMonthNames(locale), [locale]);

    const years = React.useMemo(() => {
      const arr: number[] = [];
      for (let y = maxYear; y >= minYear; y--) {
        arr.push(y);
      }
      return arr;
    }, [minYear, maxYear]);

    const currentDate = value || new Date();
    const monthIndex = currentDate.getMonth();
    const yearIndex = years.indexOf(currentDate.getFullYear());

    const handleMonthChange = React.useCallback((idx: number) => {
      const d = new Date(currentDate);
      d.setMonth(idx);
      onChange(d);
    }, [currentDate, onChange]);

    const handleYearChange = React.useCallback((idx: number) => {
      const d = new Date(currentDate);
      d.setFullYear(years[idx]);
      onChange(d);
    }, [currentDate, years, onChange]);

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center",
          config.gap,
          config.fontSize,
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        style={{ perspective: "1000px" }}
        role="group"
        aria-label="Month picker"
        {...props}
      >
        <WheelColumn
          items={months}
          value={monthIndex}
          onChange={handleMonthChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-28"
          ariaLabel="Select month"
        />

        <WheelColumn
          items={years}
          value={yearIndex >= 0 ? yearIndex : 0}
          onChange={handleYearChange}
          itemHeight={config.itemHeight}
          visibleItems={VISIBLE_ITEMS}
          disabled={disabled}
          fadeColor={fadeColor}
          variant={variant}
          className="w-20"
          ariaLabel="Select year"
        />
      </div>
    );
  }
);

MonthWheelPicker.displayName = "MonthWheelPicker";

export { DateWheelPicker, TimeWheelPicker, MonthWheelPicker };
