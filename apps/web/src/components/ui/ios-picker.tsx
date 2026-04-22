"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { 
    motion, 
    useMotionValue,
    useTransform,
    useAnimation,
    PanInfo,
    MotionValue,
    animate
} from "framer-motion";

interface IOSPickerProps {
  items: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string | number) => void;
  height?: number;
  itemHeight?: number;
}

const LOOP_COUNT = 30; // Enough repetitions to feel infinite

export function IOSPicker({ items, value, onChange, height = 200, itemHeight = 44 }: IOSPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize Y at the correct position for the current value in the middle of the loop
  const initialY = (() => {
    const selectedIndex = items.findIndex(i => i.value === value);
    // Start at center loop to give space both ways
    const startLoopIndex = Math.floor(LOOP_COUNT / 2) * items.length;
    const targetIndex = startLoopIndex + (selectedIndex === -1 ? 0 : selectedIndex);
    return -targetIndex * itemHeight + (height / 2) - (itemHeight / 2);
  })();

  const y = useMotionValue(initialY);
  const controls = useAnimation();
  const [isDragging, setIsDragging] = useState(false);

  // Flatten the items for the infinite loop simulation
  // We place the "real" set in the middle
  const repeatedItems = useMemo(() => {
    return Array.from({ length: LOOP_COUNT }).flatMap((_, i) => 
        items.map((item, originalIndex) => ({ 
            ...item, 
            uniqueKey: `${i}-${originalIndex}`, 
            originalIndex: originalIndex 
        }))
    );
  }, [items]);

  const totalHeight = repeatedItems.length * itemHeight;
  const centerIndex = Math.floor(LOOP_COUNT / 2) * items.length;
  
  // Calculate initial offset to center the selected value
  // We try to find the selected item in the middle set
  useEffect(() => {
    if (isDragging) return;

    // Find the current visual index
    const currentY = y.get();
    const visualOffset = -currentY + (height / 2) - (itemHeight / 2);
    const currentIndex = Math.round(visualOffset / itemHeight);
    
    // Find the target value's index relative to the current set loop
    // This ensures we scroll to the *nearest* instance of the value, not jumping far away
    const selectedItemIndex = items.findIndex(i => i.value === value);
    if (selectedItemIndex === -1) return;

    const currentModIndex = ((currentIndex % items.length) + items.length) % items.length;
    let diff = selectedItemIndex - currentModIndex;
    
    // Optimize direction (shortest path)
    if (Math.abs(diff) > items.length / 2) {
        if (diff > 0) diff -= items.length;
        else diff += items.length;
    }
    
    const targetIndex = currentIndex + diff;
    const targetY = -targetIndex * itemHeight + (height / 2) - (itemHeight / 2);
    
    animate(y, targetY, {
        type: "spring",
        stiffness: 400,
        damping: 40
    });
  }, [value, height, itemHeight, items, isDragging, y]); // Run when value changes externally

  // Handle snapping and infinite loop reset logic
  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    // Inertia simulation manually or use dragTransition
    // We want to snap to the nearest item
    const currentY = y.get();
    const velocity = info.velocity.y;
    
    // Predict end position based on velocity
    const targetY = currentY + velocity * 0.2;
    
    // Snap to grid
    const snapIndex = Math.round((targetY - (height/2) + (itemHeight/2)) / itemHeight);
    const snappedY = snapIndex * itemHeight + (height/2) - (itemHeight/2);
    
    // Animate to snap
    await controls.start({ 
        y: snappedY, 
        transition: { type: "spring", stiffness: 300, damping: 30 } 
    });

    // Determine which item is selected
    // Note: y is negative. 
    // visualOffset = -y + height/2 - itemHeight/2
    // index = visualOffset / itemHeight
    const finalY = y.get();
    const visualOffset = -finalY + (height / 2) - (itemHeight / 2);
    const finalIndex = Math.round(visualOffset / itemHeight);
    
    // Normalize index to original items
    // Handle potential negative wrap (though unlikely with large loop count)
    const normalizedIndex = ((finalIndex % items.length) + items.length) % items.length;
    
    const selectedItem = items[normalizedIndex];
    if (selectedItem && selectedItem.value !== value) {
        onChange(selectedItem.value);
    }
    
    // Reset position if too far from center to prevent running out of items
    const middleY = -(centerIndex * itemHeight) + (height/2) - (itemHeight/2);
    const threshold = (items.length * itemHeight) * 5; // 5 full sets away
    
    if (Math.abs(finalY - middleY) > threshold) {
        // Teleport back to the equivalent position in the center set
        // Calculate offset from current set start
        const offsetFromSet = finalIndex % items.length;
        const newTargetIndex = centerIndex + offsetFromSet;
        const newY = -newTargetIndex * itemHeight + (height/2) - (itemHeight / 2);
        y.set(newY);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden bg-white/50 backdrop-blur-md rounded-xl border border-slate-200 shadow-inner"
      style={{ height }}
    >
      {/* Selection Highlight / Lens */}
      <div 
        className="absolute w-full pointer-events-none z-10"
        style={{ 
            top: (height - itemHeight) / 2, 
            height: itemHeight 
        }}
      >
        <div className="absolute inset-0 border-y border-blue-500/30 bg-blue-50/20" />
      </div>
      
      {/* Gradient Masks */}
      <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/95 via-white/70 to-transparent z-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-white/95 via-white/70 to-transparent z-20 pointer-events-none" />

      {/* Draggable Container */}
      <motion.div
        className="absolute top-0 left-0 w-full cursor-grab active:cursor-grabbing"
        style={{ y }}
        drag="y"
        dragConstraints={{ top: -totalHeight + height, bottom: 0 }} // Loose constraints, we rely on loop
        dragElastic={0.1}
        dragMomentum={false} // We handle momentum manually for precise snapping
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        animate={controls}
      >
        {repeatedItems.map((item, index) => (
            <PickerItem 
                key={item.uniqueKey}
                item={item}
                index={index}
                y={y}
                containerHeight={height}
                itemHeight={itemHeight}
            />
        ))}
      </motion.div>
    </div>
  );
}

function PickerItem({ item, index, y, containerHeight, itemHeight }: { 
    item: { label: string; value: string | number }; 
    index: number; 
    y: MotionValue<number>; 
    containerHeight: number; 
    itemHeight: number;
}) {
    // Calculate distance from center
    // Item center Y relative to container top = (index * itemHeight) + (itemHeight/2) + y
    const itemCenterY = (index * itemHeight) + (itemHeight / 2);
    
    // We use useTransform to map the distance to visual properties
    const opacity = useTransform(
        y, 
        (currentY) => {
            const absoluteCenter = itemCenterY + currentY;
            const distance = Math.abs(absoluteCenter - (containerHeight / 2));
            const maxDistance = containerHeight / 2;
            // Map 0 distance -> 1 opacity, maxDistance -> 0.3
            return Math.max(0.2, 1 - (distance / maxDistance));
        }
    );

    const scale = useTransform(
        y, 
        (currentY) => {
            const absoluteCenter = itemCenterY + currentY;
            const distance = Math.abs(absoluteCenter - (containerHeight / 2));
            const maxDistance = containerHeight / 2;
            // Center -> 1.1, Edge -> 0.8
            return Math.max(0.8, 1.1 - (distance / maxDistance) * 0.5);
        }
    );

    const rotateX = useTransform(
        y,
        (currentY) => {
             const absoluteCenter = itemCenterY + currentY;
             const distance = absoluteCenter - (containerHeight / 2);
             const maxDistance = containerHeight / 2;
             // Max rotation +/- 45 degrees
             // Invert rotation so items at top tilt back (positive rotateX)
             const angle = distance / maxDistance * 45;
             return Math.min(Math.max(angle, -45), 45) * -1;
        }
    );

    return (
        <motion.div
            className="flex items-center justify-center font-medium text-slate-800"
            style={{ 
                height: itemHeight,
                opacity,
                scale,
                rotateX,
                transformPerspective: 800
            }}
        >
            {item.label}
        </motion.div>
    );
}
