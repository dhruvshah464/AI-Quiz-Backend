const { PostHog } = require('posthog-node');

class AnalyticsService {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.initialize();
  }

  initialize() {
    try {
      if (process.env.POSTHOG_API_KEY) {
        this.client = new PostHog(process.env.POSTHOG_API_KEY, {
          host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
        });
        this.enabled = true;
        console.log('PostHog analytics initialized');
      } else {
        console.log('PostHog API key not set, analytics disabled');
      }
    } catch (error) {
      console.error('Failed to initialize PostHog:', error);
    }
  }

  track(eventName, properties = {}, userId = null) {
    if (!this.enabled || !this.client) {
      console.log(`[Analytics] ${eventName}`, properties);
      return;
    }

    try {
      this.client.capture({
        distinctId: userId || 'anonymous',
        event: eventName,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  identify(userId, properties = {}) {
    if (!this.enabled || !this.client) {
      console.log(`[Analytics] Identify user: ${userId}`, properties);
      return;
    }

    try {
      this.client.identify({
        distinctId: userId,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  }

  // Quiz-related events
  trackQuizStarted(userId, quizData) {
    this.track('quiz_started', {
      subject: quizData.subject,
      gradeLevel: quizData.gradeLevel,
      totalQuestions: quizData.totalQuestions,
      difficulty: quizData.difficulty,
      sessionId: quizData.sessionId,
      isGuest: !userId,
    }, userId);
  }

  trackQuizCompleted(userId, quizData, score) {
    this.track('quiz_completed', {
      subject: quizData.subject,
      gradeLevel: quizData.gradeLevel,
      totalQuestions: quizData.totalQuestions,
      score: score,
      percentage: Math.round((score / quizData.totalQuestions) * 100),
      sessionId: quizData.sessionId,
      isGuest: !userId,
    }, userId);
  }

  trackQuizAbandoned(userId, quizData, progress) {
    this.track('quiz_abandoned', {
      subject: quizData.subject,
      gradeLevel: quizData.gradeLevel,
      totalQuestions: quizData.totalQuestions,
      questionsAnswered: progress.questionsAnswered || 0,
      sessionId: quizData.sessionId,
      isGuest: !userId,
    }, userId);
  }

  // Guest conversion events
  trackGuestSessionCreated(ipAddress) {
    this.track('guest_session_created', {
      ipAddress: ipAddress ? ipAddress.substring(0, 10) + '...' : null,
    });
  }

  trackGuestConversion(userId, guestSessionId) {
    this.track('guest_conversion', {
      guestSessionId: guestSessionId,
      convertedAt: new Date().toISOString(),
    }, userId);
  }

  trackGuestLimitReached(ipAddress) {
    this.track('guest_limit_reached', {
      ipAddress: ipAddress ? ipAddress.substring(0, 10) + '...' : null,
    });
  }

  // Authentication events
  trackUserRegistered(userId, method = 'email') {
    this.identify(userId, {
      registrationMethod: method,
      createdAt: new Date().toISOString(),
    });
    this.track('user_registered', {
      method: method,
    }, userId);
  }

  trackUserLoggedIn(userId, method = 'email') {
    this.track('user_logged_in', {
      method: method,
    }, userId);
  }

  trackUserLoggedOut(userId) {
    this.track('user_logged_out', {}, userId);
  }

  // AI-related events
  trackAIGeneratedQuiz(userId, success, fallbackUsed = false) {
    this.track('ai_quiz_generated', {
      success: success,
      fallbackUsed: fallbackUsed,
      isGuest: !userId,
    }, userId);
  }

  trackAIGeneratedHint(userId, success, fallbackUsed = false) {
    this.track('ai_hint_generated', {
      success: success,
      fallbackUsed: fallbackUsed,
      isGuest: !userId,
    }, userId);
  }

  // Learning progress events
  trackLearningProgressViewed(userId, confidenceLevel) {
    this.track('learning_progress_viewed', {
      confidenceLevel: confidenceLevel,
      isGuest: !userId,
    }, userId);
  }
}

module.exports = new AnalyticsService();
