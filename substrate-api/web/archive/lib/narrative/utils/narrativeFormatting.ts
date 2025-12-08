/**
 * Narrative Formatting Utilities
 * 
 * Utilities for formatting content in human-readable, narrative-friendly ways
 */

export function formatInsightCount(count: number): string {
  if (count === 0) return "No insights yet";
  if (count === 1) return "1 insight captured";
  if (count <= 5) return `${count} insights discovered`;
  if (count <= 10) return `${count} valuable insights`;
  if (count <= 20) return `${count} rich insights`;
  return `${count} comprehensive insights`;
}

export function formatThemeCount(count: number): string {
  if (count === 0) return "No themes identified";
  if (count === 1) return "1 theme emerging";
  if (count <= 3) return `${count} themes developing`;
  if (count <= 5) return `${count} clear themes`;
  return `${count} rich thematic patterns`;
}

export function formatUnderstandingLevel(level: string | number): string {
  if (typeof level === 'number') {
    if (level === 0) return "Ready to begin understanding";
    if (level < 0.3) return "Building initial understanding";
    if (level < 0.6) return "Developing solid understanding";
    if (level < 0.8) return "Strong understanding achieved";
    return "Deep, comprehensive understanding";
  }

  const levelMap: Record<string, string> = {
    'just_getting_started': "Just getting to know your project",
    'building_understanding': "Building understanding of your work", 
    'solid_grasp': "Strong understanding of your project",
    'comprehensive_knowledge': "Deep, comprehensive project knowledge"
  };

  return levelMap[level] || "Understanding your project";
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export function formatProgressPercentage(value: number): string {
  const percentage = Math.round(value * 100);
  
  if (percentage === 0) return "Just getting started";
  if (percentage < 25) return `${percentage}% - Early progress`;
  if (percentage < 50) return `${percentage}% - Building momentum`;
  if (percentage < 75) return `${percentage}% - Good progress`;
  if (percentage < 90) return `${percentage}% - Strong development`;
  return `${percentage}% - Excellent progress`;
}

export function formatGrowthRate(rate: number): string {
  if (rate === 0) return "Stable";
  if (rate < 5) return `Growing slowly (+${rate}%)`;
  if (rate < 15) return `Growing steadily (+${rate}%)`;
  if (rate < 30) return `Growing rapidly (+${rate}%)`;
  return `Expanding quickly (+${rate}%)`;
}

export function formatActionButton(action: string): string {
  const actionMap: Record<string, string> = {
    'create': 'Capture',
    'add': 'Add',
    'edit': 'Refine',
    'update': 'Update',
    'delete': 'Remove',
    'analyze': 'Explore',
    'review': 'Review',
    'save': 'Save',
    'cancel': 'Cancel',
    'submit': 'Share',
    'export': 'Export',
    'import': 'Import'
  };

  return actionMap[action.toLowerCase()] || action;
}

export function formatEstimatedTime(timeString: string): string {
  // Handle various time formats and make them more conversational
  const timeMap: Record<string, string> = {
    '5 minutes': '5 min',
    '10 minutes': '10 min', 
    '15 minutes': '15 min',
    '30 minutes': '30 min',
    '1 hour': '1 hour',
    '2 hours': '2 hours',
    'few minutes': 'a few minutes',
    'several minutes': 'several minutes',
    'quick': 'just a moment',
    'instant': 'instantly'
  };

  return timeMap[timeString.toLowerCase()] || timeString;
}

export function formatUserBenefit(benefit: string): string {
  // Make benefits more conversational and user-focused
  return benefit
    .replace(/^(you will|it will|this will)/i, 'You\'ll')
    .replace(/\bAI\b/g, 'I')
    .replace(/\bthe system\b/g, 'I')
    .replace(/\bthe application\b/g, 'I');
}

export function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  
  // Handle common irregular plurals
  const irregulars: Record<string, string> = {
    'insight': 'insights',
    'theme': 'themes', 
    'idea': 'ideas',
    'discovery': 'discoveries',
    'analysis': 'analyses',
    'synthesis': 'syntheses'
  };
  
  if (irregulars[word.toLowerCase()]) {
    return irregulars[word.toLowerCase()];
  }
  
  // Handle regular plurals
  if (word.endsWith('y')) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch')) {
    return word + 'es';
  }
  
  return word + 's';
}

export function formatConfidencePhrase(confidence: number | string): string {
  if (typeof confidence === 'number') {
    if (confidence < 0.3) return "I'm still learning about";
    if (confidence < 0.6) return "I'm starting to understand";
    if (confidence < 0.8) return "I have a good sense of";
    return "I understand well";
  }
  
  const confidenceMap: Record<string, string> = {
    'just_getting_started': "I'm just getting to know",
    'building_understanding': "I'm learning about",
    'solid_grasp': "I understand",
    'comprehensive_knowledge': "I know well"
  };
  
  return confidenceMap[confidence] || "I'm learning about";
}