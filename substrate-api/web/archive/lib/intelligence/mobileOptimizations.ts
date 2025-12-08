"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// Core interfaces for mobile optimizations
export interface MobileOptimizations {
  ambientCompanion: {
    mobilePositioning: 'bottom-right' | 'bottom-center' | 'floating';
    touchTargetSize: number;
    gestureSupport: {
      swipeToExpand: boolean;
      tapToCollapse: boolean;
      dragRepositioning: boolean;
    };
  };
  modalMobile: {
    fullScreenMode: boolean;
    swipeToApprove: boolean;
    touchFriendlyControls: boolean;
  };
  conversationThreading: {
    mobileThreadDisplay: 'compact' | 'expanded' | 'hidden';
    touchScrollOptimization: boolean;
    keyboardAwareness: boolean;
  };
}

export interface TouchGesture {
  type: 'tap' | 'double_tap' | 'long_press' | 'swipe' | 'pinch' | 'drag';
  startPoint: { x: number; y: number };
  endPoint?: { x: number; y: number };
  duration: number;
  velocity?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

export interface MobileViewport {
  width: number;
  height: number;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  keyboardHeight: number;
  orientation: 'portrait' | 'landscape';
  isKeyboardVisible: boolean;
  deviceType: 'phone' | 'tablet' | 'desktop';
}

export interface MobileInteractionContext {
  viewport: MobileViewport;
  touchCapabilities: {
    multiTouch: boolean;
    maxTouchPoints: number;
    gestureSupport: boolean;
  };
  deviceType: 'phone' | 'tablet' | 'desktop';
  connectionType: 'slow' | 'fast' | 'offline';
}

/**
 * Mobile optimization manager for touch-friendly interactions
 */
export class MobileOptimizationManager {
  private config: MobileOptimizations;
  private viewport: MobileViewport;
  private touchStartTime: number = 0;
  private touchThreshold = {
    tap: 200, // ms
    longPress: 500, // ms
    swipeDistance: 50, // px
    swipeVelocity: 0.5 // px/ms
  };
  private keyboardListeners: (() => void)[] = [];

  constructor(config: MobileOptimizations) {
    this.config = config;
    this.viewport = this.getInitialViewport();
    this.setupViewportMonitoring();
    this.setupKeyboardDetection();
  }

  /**
   * Get optimal positioning for mobile ambient companion
   */
  getOptimalMobilePosition(
    companionSize: { width: number; height: number },
    state: 'collapsed' | 'ambient' | 'expanded' | 'minimized'
  ): { x: number; y: number; transform?: string } {
    const { width, height, safeArea, keyboardHeight } = this.viewport;
    const availableHeight = height - keyboardHeight;

    // Handle minimized state - return off-screen position
    if (state === 'minimized') {
      return {
        x: -companionSize.width,
        y: -companionSize.height,
        transform: 'scale(0)'
      };
    }

    switch (this.config.ambientCompanion.mobilePositioning) {
      case 'bottom-center':
        return {
          x: (width - companionSize.width) / 2,
          y: availableHeight - companionSize.height - safeArea.bottom - 20,
          transform: state === 'expanded' ? 'translateY(-10px)' : undefined
        };

      case 'floating':
        // Smart floating position that avoids keyboard
        const floatingY = this.viewport.isKeyboardVisible
          ? Math.min(
              availableHeight - companionSize.height - 20,
              height * 0.3 // Upper third when keyboard is visible
            )
          : availableHeight - companionSize.height - safeArea.bottom - 20;

        return {
          x: width - companionSize.width - safeArea.right - 16,
          y: floatingY,
          transform: state === 'expanded' ? 'scale(1.02)' : undefined
        };

      default: // bottom-right
        return {
          x: width - companionSize.width - safeArea.right - 16,
          y: availableHeight - companionSize.height - safeArea.bottom - 20
        };
    }
  }

  /**
   * Process touch gestures for companion interactions
   */
  processTouchGesture(
    touches: TouchList | Touch[],
    gestureType: 'start' | 'move' | 'end',
    element: HTMLElement
  ): TouchGesture | null {
    const touch = touches[0];
    if (!touch) return null;

    const currentTime = Date.now();
    const touchPoint = { x: touch.clientX, y: touch.clientY };

    switch (gestureType) {
      case 'start':
        this.touchStartTime = currentTime;
        return {
          type: 'tap', // Will be determined on end
          startPoint: touchPoint,
          duration: 0
        };

      case 'end':
        const duration = currentTime - this.touchStartTime;
        const startPoint = this.getTouchStartPoint(element);
        const distance = this.calculateDistance(startPoint, touchPoint);

        // Determine gesture type
        if (duration < this.touchThreshold.tap && distance < 10) {
          return {
            type: 'tap',
            startPoint,
            endPoint: touchPoint,
            duration
          };
        } else if (duration >= this.touchThreshold.longPress && distance < 20) {
          return {
            type: 'long_press',
            startPoint,
            endPoint: touchPoint,
            duration
          };
        } else if (distance >= this.touchThreshold.swipeDistance) {
          const direction = this.getSwipeDirection(startPoint, touchPoint);
          const velocity = distance / duration;

          if (velocity >= this.touchThreshold.swipeVelocity) {
            return {
              type: 'swipe',
              startPoint,
              endPoint: touchPoint,
              duration,
              direction,
              distance,
              velocity
            };
          } else {
            return {
              type: 'drag',
              startPoint,
              endPoint: touchPoint,
              duration,
              distance
            };
          }
        }

        return null;

      default:
        return null;
    }
  }

  /**
   * Handle gesture-based companion interactions
   */
  handleCompanionGesture(
    gesture: TouchGesture,
    currentState: 'collapsed' | 'ambient' | 'expanded' | 'minimized',
    onStateChange: (newState: 'collapsed' | 'ambient' | 'expanded') => void,
    onMove?: (delta: { x: number; y: number }) => void
  ): boolean {
    switch (gesture.type) {
      case 'tap':
        // Standard tap behavior with mobile optimizations
        if (currentState === 'collapsed') {
          onStateChange('ambient');
        } else if (currentState === 'ambient') {
          onStateChange('expanded');
        } else {
          onStateChange('ambient');
        }
        return true;

      case 'double_tap':
        // Double tap to toggle between collapsed and expanded
        onStateChange(currentState === 'collapsed' ? 'expanded' : 'collapsed');
        return true;

      case 'long_press':
        // Long press for context menu or drag mode
        if (this.config.ambientCompanion.gestureSupport.dragRepositioning) {
          // Enter drag mode
          return true;
        }
        break;

      case 'swipe':
        if (!this.config.ambientCompanion.gestureSupport.swipeToExpand) break;

        switch (gesture.direction) {
          case 'up':
            if (currentState !== 'expanded') {
              onStateChange('expanded');
              return true;
            }
            break;
          case 'down':
            if (currentState === 'expanded') {
              onStateChange('ambient');
              return true;
            } else if (currentState === 'ambient') {
              onStateChange('collapsed');
              return true;
            }
            break;
          case 'left':
          case 'right':
            // Horizontal swipe for repositioning
            if (onMove && gesture.distance && gesture.distance > 30) {
              const delta = gesture.direction === 'right' 
                ? { x: gesture.distance, y: 0 }
                : { x: -gesture.distance, y: 0 };
              onMove(delta);
              return true;
            }
            break;
        }
        break;

      case 'drag':
        // Handle dragging for repositioning
        if (this.config.ambientCompanion.gestureSupport.dragRepositioning && onMove) {
          const delta = gesture.endPoint && gesture.startPoint
            ? {
                x: gesture.endPoint.x - gesture.startPoint.x,
                y: gesture.endPoint.y - gesture.startPoint.y
              }
            : { x: 0, y: 0 };
          onMove(delta);
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Handle modal swipe gestures for approval/rejection
   */
  handleModalSwipeGestures(
    gesture: TouchGesture,
    onApprove: () => void,
    onReject: () => void
  ): boolean {
    if (!this.config.modalMobile.swipeToApprove || gesture.type !== 'swipe') {
      return false;
    }

    const minSwipeDistance = 80; // Minimum swipe distance for modal actions
    
    if (gesture.distance && gesture.distance >= minSwipeDistance && gesture.velocity && gesture.velocity >= 0.3) {
      switch (gesture.direction) {
        case 'right':
          onApprove();
          return true;
        case 'left':
          onReject();
          return true;
      }
    }

    return false;
  }

  /**
   * Apply mobile-specific styling
   */
  getMobileStyles(componentType: 'companion' | 'modal' | 'thread'): React.CSSProperties {
    const baseStyles: React.CSSProperties = {
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      userSelect: 'none'
    };

    switch (componentType) {
      case 'companion':
        return {
          ...baseStyles,
          minHeight: this.config.ambientCompanion.touchTargetSize,
          minWidth: this.config.ambientCompanion.touchTargetSize,
          borderRadius: this.viewport.deviceType === 'phone' ? '16px' : '12px',
          fontSize: this.viewport.deviceType === 'phone' ? '14px' : '16px',
          padding: this.viewport.deviceType === 'phone' ? '12px' : '16px'
        };

      case 'modal':
        const modalStyles: React.CSSProperties = {
          ...baseStyles,
          borderRadius: this.viewport.deviceType === 'phone' ? '20px 20px 0 0' : '16px'
        };

        if (this.config.modalMobile.fullScreenMode && this.viewport.deviceType === 'phone') {
          modalStyles.position = 'fixed';
          modalStyles.top = '0';
          modalStyles.left = '0';
          modalStyles.right = '0';
          modalStyles.bottom = '0';
          modalStyles.borderRadius = '0';
        }

        return modalStyles;

      case 'thread':
        return {
          ...baseStyles,
          fontSize: this.viewport.deviceType === 'phone' ? '13px' : '14px',
          lineHeight: this.viewport.deviceType === 'phone' ? '1.4' : '1.5',
          padding: this.viewport.deviceType === 'phone' ? '8px' : '12px'
        };

      default:
        return baseStyles;
    }
  }

  /**
   * Get touch-friendly button sizes
   */
  getTouchButtonSize(): { width: number; height: number; fontSize: string } {
    const baseSize = this.config.ambientCompanion.touchTargetSize;
    
    return {
      width: Math.max(baseSize, 44), // iOS minimum
      height: Math.max(baseSize, 44),
      fontSize: this.viewport.deviceType === 'phone' ? '14px' : '16px'
    };
  }

  /**
   * Handle keyboard-aware positioning
   */
  getKeyboardAwarePosition(
    originalPosition: { x: number; y: number },
    elementHeight: number
  ): { x: number; y: number; transform?: string } {
    if (!this.config.conversationThreading.keyboardAwareness || !this.viewport.isKeyboardVisible) {
      return originalPosition;
    }

    const availableHeight = this.viewport.height - this.viewport.keyboardHeight;
    const adjustedY = Math.min(
      originalPosition.y,
      availableHeight - elementHeight - 20
    );

    return {
      x: originalPosition.x,
      y: adjustedY,
      transform: adjustedY !== originalPosition.y ? 'translateY(-10px)' : undefined
    };
  }

  /**
   * Optimize scroll behavior for mobile
   */
  getMobileScrollConfig(): {
    scrollBehavior: 'smooth' | 'auto';
    overscrollBehavior: 'auto' | 'contain' | 'none';
    WebkitOverflowScrolling: 'touch' | 'auto';
  } {
    return {
      scrollBehavior: 'smooth',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch'
    };
  }

  /**
   * Private helper methods
   */
  private getInitialViewport(): MobileViewport {
    if (typeof window === 'undefined') {
      return {
        width: 375,
        height: 667,
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
        keyboardHeight: 0,
        orientation: 'portrait',
        isKeyboardVisible: false,
        deviceType: 'phone'
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      width,
      height,
      safeArea: this.getSafeAreaInsets(),
      keyboardHeight: 0,
      orientation: width > height ? 'landscape' : 'portrait',
      isKeyboardVisible: false,
      deviceType: width < 768 ? 'phone' : width < 1024 ? 'tablet' : 'desktop'
    };
  }

  private getSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
    if (typeof CSS !== 'undefined' && CSS.supports('padding-top: env(safe-area-inset-top)')) {
      const computedStyle = getComputedStyle(document.documentElement);
      return {
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0') || 
             (window.navigator.platform.includes('iPhone') ? 44 : 0),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0') || 0,
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0') || 0,
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0') || 0
      };
    }

    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  private setupViewportMonitoring(): void {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      this.viewport = {
        ...this.viewport,
        width,
        height,
        orientation: width > height ? 'landscape' : 'portrait',
        deviceType: width < 768 ? 'phone' : width < 1024 ? 'tablet' : 'desktop'
      };
    };

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateViewport, 100); // Small delay for orientation change
    });
  }

  private setupKeyboardDetection(): void {
    if (typeof window === 'undefined') return;

    let initialViewportHeight = window.innerHeight;

    const detectKeyboard = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      // Threshold for keyboard detection (accounting for browser UI changes)
      const keyboardThreshold = 150;
      
      if (heightDifference > keyboardThreshold) {
        this.viewport.isKeyboardVisible = true;
        this.viewport.keyboardHeight = heightDifference;
      } else {
        this.viewport.isKeyboardVisible = false;
        this.viewport.keyboardHeight = 0;
      }
    };

    // Visual viewport API for better keyboard detection
    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboard);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', detectKeyboard);
    }

    // Focus/blur events for additional keyboard detection
    const focusElements = ['input', 'textarea', '[contenteditable]'];
    focusElements.forEach(selector => {
      document.addEventListener('focusin', (e) => {
        if ((e.target as Element).matches(selector)) {
          setTimeout(detectKeyboard, 300);
        }
      });
      
      document.addEventListener('focusout', (e) => {
        if ((e.target as Element).matches(selector)) {
          setTimeout(detectKeyboard, 300);
        }
      });
    });
  }

  private getTouchStartPoint(element: HTMLElement): { x: number; y: number } {
    // This would need to be stored when touch starts
    // For now, return element center as fallback
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  private calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getSwipeDirection(
    start: { x: number; y: number }, 
    end: { x: number; y: number }
  ): 'up' | 'down' | 'left' | 'right' {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }

  /**
   * Get current mobile context
   */
  getMobileContext(): MobileInteractionContext {
    return {
      viewport: { ...this.viewport },
      touchCapabilities: {
        multiTouch: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints || 1,
        gestureSupport: 'ongesturestart' in window
      },
      deviceType: this.viewport.width < 768 ? 'phone' : 
                 this.viewport.width < 1024 ? 'tablet' : 'desktop',
      connectionType: this.getConnectionType()
    };
  }

  private getConnectionType(): 'slow' | 'fast' | 'offline' {
    if (!navigator.onLine) return 'offline';
    
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const slowConnections = ['slow-2g', '2g', '3g'];
      return slowConnections.includes(connection.effectiveType) ? 'slow' : 'fast';
    }
    
    return 'fast'; // Default assumption
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.keyboardListeners.forEach(cleanup => cleanup());
    this.keyboardListeners = [];
  }
}

// Default mobile configuration
export const defaultMobileConfig: MobileOptimizations = {
  ambientCompanion: {
    mobilePositioning: 'floating',
    touchTargetSize: 44, // iOS/Android recommended minimum
    gestureSupport: {
      swipeToExpand: true,
      tapToCollapse: true,
      dragRepositioning: true
    }
  },
  modalMobile: {
    fullScreenMode: true,
    swipeToApprove: true,
    touchFriendlyControls: true
  },
  conversationThreading: {
    mobileThreadDisplay: 'compact',
    touchScrollOptimization: true,
    keyboardAwareness: true
  }
};

// Singleton mobile manager
export const mobileManager = new MobileOptimizationManager(defaultMobileConfig);

/**
 * React hooks for mobile optimization
 */

// Hook for mobile-aware positioning
export function useMobilePosition(
  elementSize: { width: number; height: number },
  state: 'collapsed' | 'ambient' | 'expanded' | 'minimized'
) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mobileContext, setMobileContext] = useState<MobileInteractionContext>();

  useEffect(() => {
    const context = mobileManager.getMobileContext();
    setMobileContext(context);
    
    const optimalPosition = mobileManager.getOptimalMobilePosition(elementSize, state);
    setPosition(optimalPosition);
  }, [elementSize.width, elementSize.height, state]);

  return { position, mobileContext };
}

// Hook for touch gesture handling
export function useTouchGestures(
  onGesture: (gesture: TouchGesture) => boolean
) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const endPoint = { x: touch.clientX, y: touch.clientY };
    const duration = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(
      Math.pow(endPoint.x - touchStartRef.current.x, 2) +
      Math.pow(endPoint.y - touchStartRef.current.y, 2)
    );

    let gestureType: TouchGesture['type'] = 'tap';
    let direction: TouchGesture['direction'] | undefined;

    if (duration >= 500 && distance < 20) {
      gestureType = 'long_press';
    } else if (distance >= 50) {
      const dx = endPoint.x - touchStartRef.current.x;
      const dy = endPoint.y - touchStartRef.current.y;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }
      
      gestureType = distance / duration > 0.5 ? 'swipe' : 'drag';
    }

    const gesture: TouchGesture = {
      type: gestureType,
      startPoint: touchStartRef.current,
      endPoint,
      duration,
      direction,
      distance,
      velocity: distance / duration
    };

    onGesture(gesture);
    touchStartRef.current = null;
  }, [onGesture]);

  return { handleTouchStart, handleTouchEnd };
}

// Hook for keyboard-aware positioning
export function useKeyboardAwarePosition(
  basePosition: { x: number; y: number },
  elementHeight: number
) {
  const [adjustedPosition, setAdjustedPosition] = useState(basePosition);

  useEffect(() => {
    const updatePosition = () => {
      const keyboardAwarePos = mobileManager.getKeyboardAwarePosition(basePosition, elementHeight);
      setAdjustedPosition(keyboardAwarePos);
    };

    updatePosition();

    // Listen for keyboard changes
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updatePosition);
      if ('visualViewport' in window && window.visualViewport) {
        window.visualViewport.addEventListener('resize', updatePosition);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updatePosition);
        if ('visualViewport' in window && window.visualViewport) {
          window.visualViewport.removeEventListener('resize', updatePosition);
        }
      }
    };
  }, [basePosition.x, basePosition.y, elementHeight]);

  return adjustedPosition;
}