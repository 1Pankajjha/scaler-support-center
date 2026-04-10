const { v4: uuidv4 } = require('uuid');
const IntelligenceEngine = require('./intelligence');

class ConversationManager {
  constructor(db) {
    this.db = db;
    this.intelligence = new IntelligenceEngine(db);
  }

  // Get or create user
  getOrCreateUser(email, name = null, phone = null) {
    let user = null;
    
    if (email) {
      user = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
    
    if (!user) {
      const userId = `user_${uuidv4().substring(0, 8)}`;
      const stmt = this.db.prepare(`
        INSERT INTO users (user_id, name, email, phone) 
        VALUES (?, ?, ?, ?)
      `);
      
      const info = stmt.run(userId, name, email, phone);
      user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      // Update last seen
      this.db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?').run(user.user_id);
    }
    
    return user;
  }

  // Create new conversation
  createConversation(userId, initialMessage = null) {
    const conversationId = `conv_${uuidv4().substring(0, 8)}`;
    
    // Analyze initial message if provided
    let intent = 'general';
    let sentiment = 'neutral';
    let issueCategory = null;
    
    if (initialMessage) {
      const intentAnalysis = this.intelligence.detectIntent(initialMessage);
      const sentimentAnalysis = this.intelligence.detectSentiment(initialMessage);
      
      intent = intentAnalysis.intent;
      sentiment = sentimentAnalysis.sentiment;
      
      // Map intent to category
      const categoryMapping = {
        'refund': 'Payments & EMI',
        'payment': 'Payments & EMI',
        'technical': 'Platform & Tech',
        'escalation': 'Platform & Tech'
      };
      
      issueCategory = categoryMapping[intent] || null;
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO conversations (
        conversation_id, user_id, status, mode, sentiment, 
        issue_category, issue_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      conversationId,
      userId,
      'active',
      'ai',
      sentiment,
      issueCategory,
      initialMessage ? initialMessage.substring(0, 200) : null
    );
    
    return this.db.prepare('SELECT * FROM conversations WHERE conversation_id = ?').get(conversationId);
  }

  // Add message to conversation
  addMessage(conversationId, senderType, content, senderId = null, messageType = 'text') {
    const messageId = `msg_${uuidv4().substring(0, 8)}`;
    
    // Analyze message for intelligence
    let intentDetected = null;
    let sentimentDetected = null;
    let confidenceScore = null;
    
    if (senderType === 'user') {
      const intentAnalysis = this.intelligence.detectIntent(content);
      const sentimentAnalysis = this.intelligence.detectSentiment(content);
      
      intentDetected = intentAnalysis.intent;
      sentimentDetected = sentimentAnalysis.sentiment;
      confidenceScore = Math.max(intentAnalysis.confidence, sentimentAnalysis.confidence);
      
      // Update conversation sentiment if this is more recent
      this.db.prepare(`
        UPDATE conversations 
        SET sentiment = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE conversation_id = ?
      `).run(sentimentDetected, conversationId);
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        conversation_id, message_id, sender_type, sender_id, 
        content, message_type, intent_detected, sentiment_detected, 
        confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      conversationId,
      messageId,
      senderType,
      senderId,
      content,
      messageType,
      intentDetected,
      sentimentDetected,
      confidenceScore
    );
    
    return this.db.prepare('SELECT * FROM messages WHERE message_id = ?').get(messageId);
  }

  // Get conversation with messages
  getConversation(conversationId, includeMessages = true) {
    const conversation = this.db.prepare('SELECT * FROM conversations WHERE conversation_id = ?').get(conversationId);
    
    if (!conversation) return null;
    
    if (includeMessages) {
      conversation.messages = this.db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
      `).all(conversationId);
    }
    
    return conversation;
  }

  // Get user conversations
  getUserConversations(userId, limit = 10) {
    return this.db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(userId, limit);
  }

  // Check if escalation is needed
  checkEscalationNeed(conversationId, newMessage = null) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return { shouldEscalate: false };
    
    // Get recent messages for analysis
    const recentMessages = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? AND sender_type = 'user'
      ORDER BY timestamp DESC 
      LIMIT 5
    `).all(conversationId);
    
    // Analyze latest message if provided
    let messageAnalysis = null;
    if (newMessage) {
      messageAnalysis = {
        intent: this.intelligence.detectIntent(newMessage).intent,
        sentiment: this.intelligence.detectSentiment(newMessage).sentiment,
        confidence: Math.max(
          this.intelligence.detectIntent(newMessage).confidence,
          this.intelligence.detectSentiment(newMessage).confidence
        )
      };
    }
    
    // Check escalation rules
    const escalationCheck = this.intelligence.checkEscalationRules(conversation, messageAnalysis);
    
    // Additional checks
    if (conversation.status === 'escalated') {
      return { shouldEscalate: false, reason: 'Already escalated' };
    }
    
    // Check for explicit escalation request
    if (newMessage && newMessage.toLowerCase().includes('talk to human')) {
      return { shouldEscalate: true, reason: 'User requested human agent', priority: 'normal' };
    }
    
    return escalationCheck;
  }

  // Create escalation
  createEscalation(conversationId, reason, priority = 'normal', triggerType = 'automatic') {
    const conversation = this.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    const escalationId = `escal_${uuidv4().substring(0, 8)}`;
    
    // Generate context package
    const contextPackage = {
      conversation_id: conversationId,
      user_id: conversation.user_id,
      issue_summary: conversation.issue_summary,
      issue_category: conversation.issue_category,
      sentiment: conversation.sentiment,
      messages: conversation.messages || this.db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 10
      `).all(conversationId),
      escalation_reason: reason,
      trigger_type: triggerType,
      created_at: new Date().toISOString()
    };
    
    // Find available agent
    const requiredSkills = this.mapCategoryToSkills(conversation.issue_category);
    const availableAgent = this.intelligence.getAvailableAgent(requiredSkills);
    
    const stmt = this.db.prepare(`
      INSERT INTO escalations (
        escalation_id, conversation_id, user_id, escalation_reason, 
        trigger_type, priority, status, assigned_agent_id, context_package
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      escalationId,
      conversationId,
      conversation.user_id,
      reason,
      triggerType,
      priority,
      availableAgent ? 'assigned' : 'pending',
      availableAgent ? availableAgent.agent_id : null,
      JSON.stringify(contextPackage)
    );
    
    // Update conversation status
    this.db.prepare(`
      UPDATE conversations 
      SET status = 'escalated', mode = 'human', escalation_id = ?, 
      assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `).run(escalationId, availableAgent ? availableAgent.agent_id : null, conversationId);
    
    // Update agent load if assigned
    if (availableAgent) {
      this.db.prepare(`
        UPDATE support_agents 
        SET current_chats = current_chats + 1, status = 'busy', last_active = CURRENT_TIMESTAMP
        WHERE agent_id = ?
      `).run(availableAgent.agent_id);
    }
    
    return {
      escalationId,
      assignedAgent: availableAgent,
      contextPackage
    };
  }

  // Map category to required skills
  mapCategoryToSkills(category) {
    const skillMapping = {
      'Payments & EMI': ['payments', 'billing'],
      'Platform & Tech': ['technical'],
      'Course Curriculum': ['curriculum'],
      'Mentorship': ['mentorship'],
      'Career & Placements': ['placements']
    };
    
    return skillMapping[category] || [];
  }

  // Create callback request
  createCallback(conversationId, phoneNumber, preferredTime = null, notes = null) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    const callbackId = `cb_${uuidv4().substring(0, 8)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO callbacks (
        callback_id, user_id, conversation_id, phone_number, 
        preferred_time, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      callbackId,
      conversation.user_id,
      conversationId,
      phoneNumber,
      preferredTime,
      notes
    );
    
    return this.db.prepare('SELECT * FROM callbacks WHERE callback_id = ?').get(callbackId);
  }

  // Submit CSAT survey
  submitCSAT(conversationId, score, feedback = null, followUpRequested = false) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    const surveyId = `csat_${uuidv4().substring(0, 8)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO csat_surveys (
        survey_id, conversation_id, user_id, score, 
        feedback, follow_up_requested
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      surveyId,
      conversationId,
      conversation.user_id,
      score,
      feedback,
      followUpRequested ? 1 : 0
    );
    
    // Update conversation
    this.db.prepare(`
      UPDATE conversations 
      SET csat_collected = 1, csat_score = ?, csat_feedback = ?, 
      updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `).run(score, feedback, conversationId);
    
    // Update user's average CSAT
    this.updateUserCSAT(conversation.user_id);
    
    return this.db.prepare('SELECT * FROM csat_surveys WHERE survey_id = ?').get(surveyId);
  }

  // Update user's average CSAT score
  updateUserCSAT(userId) {
    const avgCSAT = this.db.prepare(`
      SELECT AVG(score) as avg_score FROM csat_surveys WHERE user_id = ?
    `).get(userId);
    
    if (avgCSAT.avg_score) {
      this.db.prepare(`
        UPDATE users SET csat_score = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
      `).run(avgCSAT.avg_score, userId);
    }
  }

  // Store AI training data
  storeAITrainingData(conversationId, userQuery, aiResponse, userFeedback = null, escalationTriggered = false) {
    const interactionId = `int_${uuidv4().substring(0, 8)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO ai_training_data (
        interaction_id, conversation_id, user_query, ai_response, 
        user_feedback, escalation_triggered
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      interactionId,
      conversationId,
      userQuery,
      aiResponse,
      userFeedback,
      escalationTriggered ? 1 : 0
    );
    
    return this.db.prepare('SELECT * FROM ai_training_data WHERE interaction_id = ?').get(interactionId);
  }

  // Get conversation analytics
  getConversationAnalytics(conversationId) {
    return this.intelligence.analyzeConversation(conversationId);
  }

  // End conversation
  endConversation(conversationId, resolutionStatus = 'resolved') {
    const conversation = this.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    
    // Calculate resolution time
    const resolutionTime = this.db.prepare(`
      SELECT (julianday('now') - julianday(created_at)) * 24 * 60 as minutes
      FROM conversations WHERE conversation_id = ?
    `).get(conversationId);
    
    // Update conversation
    this.db.prepare(`
      UPDATE conversations 
      SET status = ?, resolution_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `).run(resolutionStatus, Math.round(resolutionTime.minutes), conversationId);
    
    // Update agent load if conversation was escalated
    if (conversation.assigned_agent_id) {
      this.db.prepare(`
        UPDATE support_agents 
        SET current_chats = current_chats - 1, 
        status = CASE WHEN current_chats - 1 = 0 THEN 'available' ELSE 'busy' END,
        last_active = CURRENT_TIMESTAMP
        WHERE agent_id = ?
      `).run(conversation.assigned_agent_id);
    }
    
    // Update user stats
    this.db.prepare(`
      UPDATE users 
      SET total_conversations = total_conversations + 1,
      total_escalations = total_escalations + CASE WHEN ? = 'escalated' THEN 1 ELSE 0 END,
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(conversation.status, conversation.user_id);
    
    return this.getConversation(conversationId);
  }
}

module.exports = ConversationManager;
