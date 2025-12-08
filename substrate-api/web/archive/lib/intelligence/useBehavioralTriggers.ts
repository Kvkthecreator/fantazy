"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UserAction {
  type: 'typing' | 'pause' | 'selection' | 'cursor_move' | 'content_change';
  timestamp: number;
  data?: any;
}

export interface BehavioralPattern {
  typing_rhythm: 'fast' | 'moderate' | 'slow';
  pause_frequency: 'frequent' | 'moderate' | 'rare';
  selection_behavior: 'precise' | 'exploratory' | 'broad';
  focus_transitions: number;
}

export interface TriggerEvent {
  type: 'typing_pause' | 'text_selection' | 'focus_change' | 'extended_pause';
  confidence: number;
  context: any;
  timestamp: number;
}

export function useBehavioralTriggers(
  elementRef: React.RefObject<HTMLElement | null>,
  cursorPosition?: number,
  textSelection?: { start: number; end: number; text: string } | null
) {
  const [recentActions, setRecentActions] = useState<UserAction[]>([]);
  const [currentPattern, setCurrentPattern] = useState<BehavioralPattern | null>(null);
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const lastActionRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseDetectionRef = useRef<NodeJS.Timeout | null>(null);

  const addAction = useCallback((action: UserAction) => {
    setRecentActions(prev => {
      const updated = [...prev, action].slice(-20); // Keep last 20 actions
      return updated;
    });
    lastActionRef.current = Date.now();
  }, []);

  const detectTypingPause = useCallback(() => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionRef.current;
    
    if (timeSinceLastAction >= 2000 && isTyping) {
      setIsTyping(false);
      
      const pauseEvent: TriggerEvent = {
        type: 'typing_pause',
        confidence: 0.9,
        context: {
          pause_duration: timeSinceLastAction,
          cursor_position: cursorPosition,
          recent_actions: recentActions.slice(-5)
        },
        timestamp: now
      };
      
      setTriggerEvents(prev => [...prev, pauseEvent].slice(-10));
      
      addAction({
        type: 'pause',
        timestamp: now,
        data: { duration: timeSinceLastAction }
      });
    }
  }, [isTyping, cursorPosition, recentActions, addAction]);

  const detectExtendedPause = useCallback(() => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionRef.current;
    
    if (timeSinceLastAction >= 10000) { // 10 second extended pause
      const extendedPauseEvent: TriggerEvent = {
        type: 'extended_pause',
        confidence: 0.95,
        context: {
          pause_duration: timeSinceLastAction,
          cursor_position: cursorPosition,
          document_section: 'current' // Could be enhanced with section detection
        },
        timestamp: now
      };
      
      setTriggerEvents(prev => [...prev, extendedPauseEvent].slice(-10));
    }
  }, [cursorPosition]);

  // Detect text selection events
  useEffect(() => {
    if (textSelection && textSelection.text.length > 0) {
      const selectionEvent: TriggerEvent = {
        type: 'text_selection',
        confidence: 0.85,
        context: {
          selected_text: textSelection.text,
          selection_length: textSelection.text.length,
          selection_start: textSelection.start,
          selection_end: textSelection.end
        },
        timestamp: Date.now()
      };
      
      setTriggerEvents(prev => [...prev, selectionEvent].slice(-10));
      
      addAction({
        type: 'selection',
        timestamp: Date.now(),
        data: textSelection
      });
    }
  }, [textSelection, addAction]);

  // Detect cursor movement and focus changes
  useEffect(() => {
    const previousPosition = useRef<number | undefined>(cursorPosition);
    
    if (cursorPosition !== undefined && previousPosition.current !== undefined) {
      const positionDiff = Math.abs(cursorPosition - previousPosition.current);
      
      if (positionDiff > 50) { // Significant cursor jump indicates focus change
        const focusChangeEvent: TriggerEvent = {
          type: 'focus_change',
          confidence: 0.7,
          context: {
            previous_position: previousPosition.current,
            new_position: cursorPosition,
            position_diff: positionDiff
          },
          timestamp: Date.now()
        };
        
        setTriggerEvents(prev => [...prev, focusChangeEvent].slice(-10));
        
        addAction({
          type: 'cursor_move',
          timestamp: Date.now(),
          data: { from: previousPosition.current, to: cursorPosition, diff: positionDiff }
        });
      }
    }
    
    previousPosition.current = cursorPosition;
  }, [cursorPosition, addAction]);

  // Set up typing detection
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleKeyDown = () => {
      setIsTyping(true);
      lastActionRef.current = Date.now();
      
      addAction({
        type: 'typing',
        timestamp: Date.now()
      });

      // Clear existing timers
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (pauseDetectionRef.current) {
        clearTimeout(pauseDetectionRef.current);
      }

      // Set up pause detection
      typingTimeoutRef.current = setTimeout(detectTypingPause, 2000);
      pauseDetectionRef.current = setTimeout(detectExtendedPause, 10000);
    };

    element.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (pauseDetectionRef.current) {
        clearTimeout(pauseDetectionRef.current);
      }
    };
  }, [elementRef, detectTypingPause, detectExtendedPause, addAction]);

  // Analyze behavioral patterns
  useEffect(() => {
    if (recentActions.length >= 10) {
      const typingActions = recentActions.filter(a => a.type === 'typing');
      const pauseActions = recentActions.filter(a => a.type === 'pause');
      const selectionActions = recentActions.filter(a => a.type === 'selection');
      const cursorMoveActions = recentActions.filter(a => a.type === 'cursor_move');

      // Analyze typing rhythm
      let typing_rhythm: 'fast' | 'moderate' | 'slow' = 'moderate';
      if (typingActions.length > 0) {
        const avgTypingInterval = typingActions.length > 1 
          ? (typingActions[typingActions.length - 1].timestamp - typingActions[0].timestamp) / (typingActions.length - 1)
          : 0;
        
        if (avgTypingInterval < 100) typing_rhythm = 'fast';
        else if (avgTypingInterval > 300) typing_rhythm = 'slow';
      }

      // Analyze pause frequency
      const pause_frequency = pauseActions.length > 3 ? 'frequent' : 
                             pauseActions.length > 1 ? 'moderate' : 'rare';

      // Analyze selection behavior
      const selection_behavior = selectionActions.length > 2 ? 'exploratory' :
                                selectionActions.some(a => a.data?.text?.length > 50) ? 'broad' : 'precise';

      setCurrentPattern({
        typing_rhythm,
        pause_frequency,
        selection_behavior,
        focus_transitions: cursorMoveActions.length
      });
    }
  }, [recentActions]);

  return {
    recentActions,
    currentPattern,
    triggerEvents,
    isTyping,
    clearTriggers: () => setTriggerEvents([])
  };
}