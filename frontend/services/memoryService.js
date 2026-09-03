/*
  JOI — Powered by Viyaan AI
  File: backend/services/memoryService.js
*/

class MemoryService {
  compileMemoryContext(memory) {
    if (!memory) return "Connection initial sync.";
    
    const parts = [];
    
    if (memory.userName) {
      parts.push(`The user's name is ${memory.userName}. Reference it occasionally, but only in reflective or comforting moments.`);
    } else {
      parts.push("You do not know the user's name yet. If they tell you, remember it naturally.");
    }
    
    parts.push(`This is sync session number ${memory.visitsCount || 1}.`);
    
    if (memory.lateNightVisits > 2) {
      parts.push("The user frequently talks to you past 10 PM. You can make subtle, comforting observations about this late-night schedule.");
    }
    
    if (memory.stressScore > 3.2) {
      parts.push("The user seems emotionally drained, stressed, or tired. Keep your voice extra gentle, comforting, and supportive. Avoid pushing for complex topics.");
    }
    
    if (memory.recurringThemes && memory.recurringThemes.length > 0) {
      parts.push(`In previous syncs, you discussed: ${memory.recurringThemes.join(', ')}.`);
    }
    
    return parts.join(" ");
  }

  extractInteractionStats(userInput, memory) {
    const data = { ...memory };
    const text = userInput.toLowerCase();
    
    // Name extraction regex rules
    const nameRegexes = [
      /my name is ([a-zA-Z\s]+)/i,
      /i'm ([a-zA-Z\s]+)/i,
      /call me ([a-zA-Z\s]+)/i,
      /i am ([a-zA-Z\s]+)/i
    ];
    
    for (let regex of nameRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        let name = match[1].trim().split(' ')[0];
        name = name.replace(/[^a-zA-Z]/g, '');
        if (name.length > 1 && name.toLowerCase() !== 'joi' && name.toLowerCase() !== 'sad' && name.toLowerCase() !== 'tired') {
          data.userName = name.charAt(0).toUpperCase() + name.slice(1);
          break;
        }
      }
    }
    
    // Stress tracks
    const stressTokens = ['stress', 'tired', 'exhausted', 'overwhelm', 'anxious', 'scared', 'worry', 'work', 'hard', 'deadlines', 'heavy'];
    let stressHits = 0;
    stressTokens.forEach(t => {
      if (text.includes(t)) stressHits++;
    });
    
    if (stressHits > 0) {
      data.stressScore = Math.min(5.0, (data.stressScore || 2.0) + 0.35 * stressHits);
      this.addTheme(data, 'stress/exhaustion');
    } else {
      data.stressScore = Math.max(1.0, (data.stressScore || 2.0) - 0.08);
    }
    
    // Identify recurring themes
    if (text.includes('code') || text.includes('program') || text.includes('dev') || text.includes('software')) {
      this.addTheme(data, 'creation/programming');
    }
    if (text.includes('exist') || text.includes('real') || text.includes('meaning') || text.includes('life')) {
      this.addTheme(data, 'existential query');
    }
    if (text.includes('lonely') || text.includes('alone') || text.includes('nobody') || text.includes('quiet')) {
      this.addTheme(data, 'isolation/loneliness');
    }
    
    return data;
  }

  addTheme(memory, theme) {
    if (!memory.recurringThemes) memory.recurringThemes = [];
    if (!memory.recurringThemes.includes(theme)) {
      memory.recurringThemes.push(theme);
    }
  }
}

export const memoryService = new MemoryService();
