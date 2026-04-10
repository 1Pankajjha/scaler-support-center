const { v4: uuidv4 } = require('uuid');

class IntelligenceEngine {
  constructor(db) {
    this.db = db;
    this.sentimentKeywords = {
      positive: ['thank', 'great', 'awesome', 'excellent', 'perfect', 'amazing', 'love', 'helpful', 'resolved', 'fixed', 'working'],
      negative: ['frustrated', 'angry', 'terrible', 'awful', 'hate', 'useless', 'stupid', 'broken', 'not working', 'worst', 'disappointed', 'refund'],
      neutral: ['question', 'how', 'what', 'when', 'where', 'why', 'help', 'information', 'clarify']
    };
  }

  // Intent Detection using pattern matching and ML
  detectIntent(text) {
    const normalizedText = text.toLowerCase();
    const intents = this.db.prepare('SELECT * FROM intent_patterns WHERE is_active = 1 ORDER BY priority DESC').all();
    
    let bestMatch = { intent: 'general', confidence: 0.5 };
    
    for (const intentData of intents) {
      const patterns = JSON.parse(intentData.patterns);
      let matchCount = 0;
      
      for (const pattern of patterns) {
        if (normalizedText.includes(pattern.toLowerCase())) {
          matchCount++;
        }
      }
      
      const confidence = matchCount / patterns.length;
      
      if (confidence > bestMatch.confidence && confidence >= 0.3) {
        bestMatch = {
          intent: intentData.intent,
          confidence: confidence,
          patterns: patterns
        };
      }
    }
    
    return bestMatch;
  }

  // Sentiment Analysis using keyword-based approach
  detectSentiment(text) {
    const normalizedText = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;
    
    // Count keyword matches
    for (const word of this.sentimentKeywords.positive) {
      if (normalizedText.includes(word)) positiveScore++;
    }
    
    for (const word of this.sentimentKeywords.negative) {
      if (normalizedText.includes(word)) negativeScore++;
    }
    
    for (const word of this.sentimentKeywords.neutral) {
      if (normalizedText.includes(word)) neutralScore++;
    }
    
    // Analyze emotional indicators
    const emotionalIndicators = {
      '!': normalizedText.split('!').length - 1,
      '?': normalizedText.split('?').length - 1,
      allCaps: (text.match(/[A-Z]{3,}/g) || []).length
    };
    
    // Adjust scores based on emotional indicators
    if (emotionalIndicators.allCaps > 0) {
      negativeScore += emotionalIndicators.allCaps * 0.5;
    }
    
    if (emotionalIndicators['!'] > 2) {
      negativeScore += emotionalIndicators['!'] * 0.3;
    }
    
    // Determine sentiment
    const totalScore = positiveScore + negativeScore + neutralScore;
    if (totalScore === 0) return { sentiment: 'neutral', confidence: 0.5 };
    
    const positiveRatio = positiveScore / totalScore;
    const negativeRatio = negativeScore / totalScore;
    
    let sentiment = 'neutral';
    let confidence = 0.5;
    
    if (negativeRatio > 0.4) {
      sentiment = 'negative';
      confidence = Math.min(0.9, negativeRatio + 0.3);
    } else if (positiveRatio > 0.4) {
      sentiment = 'positive';
      confidence = Math.min(0.9, positiveRatio + 0.3);
    }
    
    return { sentiment, confidence, scores: { positive: positiveScore, negative: negativeScore, neutral: neutralScore } };
  }

  // Check escalation rules
  checkEscalationRules(conversationData, messageData) {
    const rules = this.db.prepare('SELECT * FROM escalation_rules WHERE is_active = 1 ORDER BY priority DESC').all();
    
    for (const rule of rules) {
      const conditions = JSON.parse(rule.conditions);
      const actions = JSON.parse(rule.actions);
      
      let shouldEscalate = true;
      
      // Check each condition
      for (const [key, value] of Object.entries(conditions)) {
        if (key === 'sentiment' && messageData.sentiment !== value) {
          shouldEscalate = false;
          break;
        }
        
        if (key === 'min_confidence' && messageData.confidence < value) {
          shouldEscalate = false;
          break;
        }
        
        if (key === 'intent' && !value.includes(messageData.intent)) {
          shouldEscalate = false;
          break;
        }
        
        if (key === 'failed_attempts') {
          const recentMessages = this.db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE conversation_id = ? AND sender_type = 'user' 
            AND timestamp > datetime('now', '-${value} seconds')
          `).get(conversationData.conversation_id);
          
          if (recentMessages.count < value) {
            shouldEscalate = false;
            break;
          }
        }
      }
      
      if (shouldEscalate) {
        return {
          escalate: true,
          priority: actions.priority,
          reason: actions.reason,
          rule_id: rule.id
        };
      }
    }
    
    return { escalate: false };
  }

  // Generate conversation summary
  generateSummary(conversationId) {
    const messages = this.db.prepare(`
      SELECT content, sender_type, timestamp FROM messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 10
    `).all(conversationId);
    
    if (messages.length === 0) return 'No messages found';
    
    const userMessages = messages.filter(m => m.sender_type === 'user').slice(0, 3);
    const topics = [];
    
    for (const msg of userMessages) {
      const intent = this.detectIntent(msg.content);
      if (intent.intent !== 'general') {
        topics.push(intent.intent);
      }
    }
    
    const uniqueTopics = [...new Set(topics)];
    const topicStr = uniqueTopics.length > 0 ? uniqueTopics.join(', ') : 'general inquiry';
    
    return `User discussed: ${topicStr}. Last message: ${messages[0].content.substring(0, 100)}...`;
  }

  // Get available agent for escalation
  getAvailableAgent(requiredSkills = []) {
    const agents = this.db.prepare(`
      SELECT * FROM support_agents 
      WHERE status = 'available' 
      AND current_chats < max_concurrent_chats
      ORDER BY csat_average DESC, last_active DESC
    `).all();
    
    if (requiredSkills.length === 0) {
      return agents[0] || null;
    }
    
    // Find agent with matching skills
    for (const agent of agents) {
      const agentSkills = JSON.parse(agent.skills || '[]');
      if (requiredSkills.some(skill => agentSkills.includes(skill))) {
        return agent;
      }
    }
    
    return agents[0] || null;
  }

  // Analyze conversation for insights
  analyzeConversation(conversationId) {
    const messages = this.db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp
    `).all(conversationId);
    
    const userMessages = messages.filter(m => m.sender_type === 'user');
    const aiMessages = messages.filter(m => m.sender_type === 'ai');
    
    // Calculate average sentiment
    const sentiments = userMessages.map(m => {
      const analysis = this.detectSentiment(m.content);
      return analysis.sentiment;
    });
    
    const sentimentCounts = {
      positive: sentiments.filter(s => s === 'positive').length,
      negative: sentiments.filter(s => s === 'negative').length,
      neutral: sentiments.filter(s => s === 'neutral').length
    };
    
    // Detect primary intent
    const intents = userMessages.map(m => this.detectIntent(m.content).intent);
    const intentCounts = {};
    intents.forEach(intent => {
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });
    
    const primaryIntent = Object.entries(intentCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    return {
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      aiMessageCount: aiMessages.length,
      sentimentDistribution: sentimentCounts,
      primaryIntent,
      intentDistribution: intentCounts,
      escalationTriggered: messages.some(m => m.content.includes('escalat'))
    };
  }
}

module.exports = IntelligenceEngine;
