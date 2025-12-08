"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TriggerEvent, BehavioralPattern } from "./useBehavioralTriggers";

export interface SuggestionTiming {
  immediate: boolean;
  delay: number; // milliseconds
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface SmartSuggestion {
  id: string;
  type: 'contextual' | 'behavioral' | 'memory' | 'insight';
  content: string;
  priority: number;
  timing: SuggestionTiming;
  trigger_source: string;
  confidence: number;
}

export interface SuggestionSchedule {
  suggestions: SmartSuggestion[];
  nextSuggestionTime: number | null;
  isWaitingForTiming: boolean;
}

export function useSmartSuggestionTiming(
  triggerEvents: TriggerEvent[],
  behavioralPattern: BehavioralPattern | null,
  isTyping: boolean
) {
  const [schedule, setSchedule] = useState<SuggestionSchedule>({
    suggestions: [],
    nextSuggestionTime: null,
    isWaitingForTiming: false
  });
  
  const [activeSuggestions, setActiveSuggestions] = useState<SmartSuggestion[]>([]);
  const scheduledTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculateOptimalTiming = useCallback((
    triggerType: TriggerEvent['type'],
    behavioralPattern: BehavioralPattern | null,
    isCurrentlyTyping: boolean
  ): SuggestionTiming => {
    // Never show suggestions while actively typing
    if (isCurrentlyTyping) {
      return {
        immediate: false,
        delay: 2000, // Wait for typing pause
        priority: 'low',
        reason: 'waiting_for_pause'
      };
    }

    switch (triggerType) {
      case 'text_selection':
        return {
          immediate: true,
          delay: 0,
          priority: 'high',
          reason: 'user_selected_text'
        };

      case 'typing_pause':
        const pauseDelay = behavioralPattern?.typing_rhythm === 'fast' ? 1500 : 
                          behavioralPattern?.typing_rhythm === 'slow' ? 3000 : 2000;
        return {
          immediate: false,
          delay: pauseDelay,
          priority: 'medium',
          reason: 'natural_pause_detected'
        };

      case 'extended_pause':
        return {
          immediate: false,
          delay: 1000, // Short delay to avoid interrupting thought
          priority: 'high',
          reason: 'extended_pause_suggests_consideration'
        };

      case 'focus_change':
        return {
          immediate: false,
          delay: 1500,
          priority: 'medium',
          reason: 'context_change_detected'
        };

      default:
        return {
          immediate: false,
          delay: 3000,
          priority: 'low',
          reason: 'default_timing'
        };
    }
  }, []);

  const shouldPrioritizeSuggestion = useCallback((
    suggestion: SmartSuggestion,
    existingSuggestions: SmartSuggestion[]
  ): boolean => {
    // Limit concurrent suggestions to avoid overwhelming user
    if (existingSuggestions.length >= 3) {
      // Only replace if new suggestion has significantly higher priority
      const lowestPriority = Math.min(...existingSuggestions.map(s => s.priority));
      return suggestion.priority > lowestPriority + 0.2;
    }

    // Always allow high-confidence, immediate suggestions
    if (suggestion.timing.immediate && suggestion.confidence > 0.8) {
      return true;
    }

    // Check for duplicate or similar suggestions
    const isDuplicate = existingSuggestions.some(existing => 
      existing.type === suggestion.type && 
      existing.trigger_source === suggestion.trigger_source
    );

    return !isDuplicate;
  }, []);

  const processNewSuggestion = useCallback((suggestion: SmartSuggestion) => {
    if (!shouldPrioritizeSuggestion(suggestion, activeSuggestions)) {
      return;
    }

    if (suggestion.timing.immediate) {
      setActiveSuggestions(prev => {
        const updated = [...prev, suggestion];
        // Sort by priority (highest first)
        return updated.sort((a, b) => b.priority - a.priority).slice(0, 3);
      });
    } else {
      // Schedule for later display
      setSchedule(prev => ({
        ...prev,
        suggestions: [...prev.suggestions, suggestion],
        nextSuggestionTime: prev.nextSuggestionTime 
          ? Math.min(prev.nextSuggestionTime, Date.now() + suggestion.timing.delay)
          : Date.now() + suggestion.timing.delay,
        isWaitingForTiming: true
      }));
    }
  }, [activeSuggestions, shouldPrioritizeSuggestion]);

  // Process trigger events into suggestions
  useEffect(() => {
    const newTriggers = triggerEvents.slice(-1); // Only process most recent trigger
    
    newTriggers.forEach(trigger => {
      const timing = calculateOptimalTiming(trigger.type, behavioralPattern, isTyping);
      
      // Generate contextual suggestions based on trigger
      const suggestions: SmartSuggestion[] = [];
      
      switch (trigger.type) {
        case 'text_selection':
          suggestions.push({
            id: `selection-${trigger.timestamp}`,
            type: 'contextual',
            content: `Analyze selected text: "${trigger.context.selected_text?.substring(0, 30)}..."`,
            priority: 0.9,
            timing,
            trigger_source: 'text_selection',
            confidence: trigger.confidence
          });
          break;

        case 'typing_pause':
          suggestions.push({
            id: `pause-${trigger.timestamp}`,
            type: 'behavioral',
            content: 'Continue with related ideas or expand this section?',
            priority: 0.7,
            timing,
            trigger_source: 'typing_pause',
            confidence: trigger.confidence
          });
          break;

        case 'extended_pause':
          suggestions.push({
            id: `extended-${trigger.timestamp}`,
            type: 'insight',
            content: 'Need inspiration? Here are some relevant connections...',
            priority: 0.8,
            timing,
            trigger_source: 'extended_pause',
            confidence: trigger.confidence
          });
          break;

        case 'focus_change':
          suggestions.push({
            id: `focus-${trigger.timestamp}`,
            type: 'contextual',
            content: 'Context updated for this section',
            priority: 0.6,
            timing,
            trigger_source: 'focus_change',
            confidence: trigger.confidence
          });
          break;
      }

      suggestions.forEach(processNewSuggestion);
    });
  }, [triggerEvents, behavioralPattern, isTyping, calculateOptimalTiming, processNewSuggestion]);

  // Handle scheduled suggestions
  useEffect(() => {
    if (schedule.nextSuggestionTime && schedule.suggestions.length > 0 && !isTyping) {
      const delay = Math.max(0, schedule.nextSuggestionTime - Date.now());
      
      if (scheduledTimeoutRef.current) {
        clearTimeout(scheduledTimeoutRef.current);
      }

      scheduledTimeoutRef.current = setTimeout(() => {
        const suggestionToShow = schedule.suggestions[0];
        
        setActiveSuggestions(prev => {
          const updated = [...prev, suggestionToShow];
          return updated.sort((a, b) => b.priority - a.priority).slice(0, 3);
        });

        setSchedule(prev => ({
          suggestions: prev.suggestions.slice(1),
          nextSuggestionTime: prev.suggestions.length > 1 
            ? Date.now() + prev.suggestions[1].timing.delay
            : null,
          isWaitingForTiming: prev.suggestions.length > 1
        }));
      }, delay);
    }

    return () => {
      if (scheduledTimeoutRef.current) {
        clearTimeout(scheduledTimeoutRef.current);
      }
    };
  }, [schedule, isTyping]);

  // Clear suggestions when user starts typing again
  useEffect(() => {
    if (isTyping) {
      setActiveSuggestions(prev => prev.filter(s => s.timing.immediate));
    }
  }, [isTyping]);

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setActiveSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  const clearAllSuggestions = useCallback(() => {
    setActiveSuggestions([]);
    setSchedule({
      suggestions: [],
      nextSuggestionTime: null,
      isWaitingForTiming: false
    });
    
    if (scheduledTimeoutRef.current) {
      clearTimeout(scheduledTimeoutRef.current);
    }
  }, []);

  return {
    activeSuggestions,
    schedule,
    dismissSuggestion,
    clearAllSuggestions,
    isWaitingForOptimalTiming: schedule.isWaitingForTiming
  };
}