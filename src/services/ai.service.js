const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    });
  }

  /**
   * Generate quiz questions using AI (with retry logic)
   */
  async generateQuizQuestions(params) {
    const { topic, difficulty, numberOfQuestions, weakAreas = [] } = params;
    return this.generateQuizQuestionsWithRetry(topic, difficulty, numberOfQuestions, weakAreas);
  }

  /**
   * Build prompt for quiz generation
   */
  buildQuizPrompt(topic, difficulty, numberOfQuestions, weakAreas) {
    const weakAreasText = weakAreas.length > 0 
      ? `Focus on these weak areas: ${weakAreas.join(', ')}.` 
      : '';

    return `Generate ${numberOfQuestions} multiple-choice questions about ${topic} at ${difficulty} difficulty level.

${weakAreasText}

Requirements:
- Each question must have 4 options (A, B, C, D)
- One correct answer must be clearly marked
- Include a brief explanation for the correct answer
- Assign a concept/topic tag to each question
- Include difficulty level for each question

Return the response in this exact JSON format:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief explanation of why this is correct",
      "concept": "Topic concept",
      "tags": ["tag1", "tag2"],
      "difficulty": "easy|medium|hard"
    }
  ]
}`;
  }

  /**
   * Validate AI response format
   */
  validateQuizResponse(response) {
    if (!response || !response.questions || !Array.isArray(response.questions)) {
      throw new Error('Invalid AI response format');
    }

    const validatedQuestions = response.questions.map((q, index) => ({
      question: q.question || `Question ${index + 1}`,
      options: Array.isArray(q.options) && q.options.length === 4 
        ? q.options 
        : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: q.correctAnswer || q.options[0],
      explanation: q.explanation || '',
      concept: q.concept || '',
      tags: Array.isArray(q.tags) ? q.tags : [],
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    }));

    return { questions: validatedQuestions };
  }

  /**
   * Generate AI hint for a question (with retry logic)
   */
  async generateHint(questionText) {
    return this.generateHintWithRetry(questionText);
  }

  /**
   * Generate improvement suggestions based on quiz performance (with retry logic)
   */
  async generateImprovementTips(score, subject, weakAreas, strengths) {
    const quizData = { subject };
    const userPerformance = { score, weakAreas, strengths };
    return this.generateImprovementTipsWithRetry(quizData, userPerformance);
  }

  async generateQuizQuestionsWithRetry(subject, gradeLevel, totalQuestions, weakAreas = [], maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const prompt = this.buildQuizPromptWithRetry(subject, gradeLevel, totalQuestions, weakAreas);
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational content creator specializing in creating quiz questions for students.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        const questions = this.parseQuizResponseWithRetry(content, totalQuestions);
        
        return questions;
      } catch (error) {
        lastError = error;
        console.error(`AI quiz generation attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          console.error('All retry attempts exhausted, using fallback');
          return this.generateFallbackQuestions(subject, gradeLevel, totalQuestions, weakAreas);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    throw lastError;
  }

  buildQuizPromptWithRetry(subject, gradeLevel, totalQuestions, weakAreas) {
    let prompt = `Generate ${totalQuestions} quiz questions about ${subject} for grade ${gradeLevel} students.\n\n`;
    
    if (weakAreas && weakAreas.length > 0) {
      prompt += `Focus on these weak areas: ${weakAreas.join(', ')}.\n\n`;
    }
    
    prompt += `Requirements:
- Each question should have 4 multiple choice options (A, B, C, D)
- Include the correct answer letter (A, B, C, or D)
- Difficulty level (easy, medium, or hard)
- A brief explanation of the correct answer
- The concept/topic being tested

STRICT JSON FORMAT REQUIRED:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "A",
      "difficulty": "medium",
      "explanation": "Brief explanation",
      "concept": "Topic being tested"
    }
  ]
}

Ensure the response is valid JSON with no markdown formatting.`;

    return prompt;
  }

  parseQuizResponseWithRetry(content, expectedCount) {
    try {
      // Remove markdown code blocks if present
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(cleanContent.trim());
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response structure: missing questions array');
      }
      
      if (parsed.questions.length !== expectedCount) {
        console.warn(`Expected ${expectedCount} questions, got ${parsed.questions.length}`);
      }
      
      // Validate each question has required fields
      parsed.questions.forEach((q, index) => {
        if (!q.question || !q.options || !q.correctAnswer || !q.difficulty) {
          throw new Error(`Question ${index + 1} missing required fields`);
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error(`Question ${index + 1} must have exactly 4 options`);
        }
        if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
          throw new Error(`Question ${index + 1} correctAnswer must be A, B, C, or D`);
        }
      });
      
      return parsed.questions;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('Failed to parse AI response');
    }
  }

  generateFallbackQuestions(subject, gradeLevel, totalQuestions, weakAreas = []) {
    console.log('Using fallback question generator');
    
    const concepts = weakAreas.length > 0 ? weakAreas : [
      `${subject} fundamentals`,
      `${subject} principles`,
      `${subject} applications`,
      `${subject} theory`
    ];
    
    const difficulties = ['easy', 'medium', 'hard'];
    
    const questions = [];
    for (let i = 0; i < totalQuestions; i++) {
      const concept = concepts[i % concepts.length];
      const difficulty = difficulties[i % difficulties.length];
      
      questions.push({
        question: `What is a key concept of ${concept} at grade ${gradeLevel}?`,
        options: [
          `Option A for ${concept}`,
          `Option B for ${concept}`,
          `Option C for ${concept}`,
          `Option D for ${concept}`
        ],
        correctAnswer: 'A',
        difficulty,
        explanation: `This question tests understanding of ${concept}. The correct answer demonstrates knowledge of fundamental principles.`,
        concept: concept
      });
    }
    
    return questions;
  }

  async generateHintWithRetry(question, userAnswer, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const prompt = `A student answered a quiz question incorrectly. Provide a helpful hint that guides them toward the correct answer without giving it away directly.

Question: ${question}
Student's answer: ${userAnswer}

Provide a hint in 1-2 sentences that:
- Doesn't reveal the correct answer
- Guides their thinking in the right direction
- Is encouraging and educational`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful educational assistant.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        });

        return response.choices[0].message.content.trim();
      } catch (error) {
        lastError = error;
        console.error(`AI hint generation attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          return this.generateFallbackHint(question);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw lastError;
  }

  generateFallbackHint(question) {
    return "Think about the key concepts related to this question. Consider what you know about the topic and try to eliminate the obviously incorrect options first.";
  }

  async generateImprovementTipsWithRetry(quizData, userPerformance, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const prompt = `Based on a student's quiz performance, provide personalized improvement tips.

Quiz Details:
- Subject: ${quizData.subject}
- Grade Level: ${quizData.gradeLevel}
- Score: ${userPerformance.score}%
- Total Questions: ${quizData.totalQuestions}
- Correct Answers: ${userPerformance.correctAnswers}
- Weak Areas: ${userPerformance.weakAreas ? userPerformance.weakAreas.join(', ') : 'None identified'}
- Strengths: ${userPerformance.strengths ? userPerformance.strengths.join(', ') : 'None identified'}

Provide 3-5 specific, actionable improvement tips that:
1. Address the identified weak areas
2. Build on their strengths
3. Are appropriate for their grade level
4. Include specific resources or strategies

Return the tips in a clear, encouraging format.`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational counselor.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        return response.choices[0].message.content.trim();
      } catch (error) {
        lastError = error;
        console.error(`AI improvement tips generation attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          return this.generateFallbackImprovementTips(userPerformance);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw lastError;
  }

  generateFallbackImprovementTips(userPerformance) {
    const tips = [];
    
    if (userPerformance.weakAreas && userPerformance.weakAreas.length > 0) {
      tips.push(`Focus on improving in: ${userPerformance.weakAreas.join(', ')}. Practice these areas regularly.`);
    }
    
    if (userPerformance.strengths && userPerformance.strengths.length > 0) {
      tips.push(`Continue building on your strengths in: ${userPerformance.strengths.join(', ')}.`);
    }
    
    tips.push('Review your incorrect answers to understand common mistakes.');
    tips.push('Try explaining concepts to others to reinforce your understanding.');
    
    return tips.join('\n\n');
  }

  async generateExplanationWithRetry(question, correctAnswer, userAnswer, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const prompt = `Explain why the correct answer is correct and why the student's answer is incorrect.

Question: ${question}
Correct Answer: ${correctAnswer}
Student's Answer: ${userAnswer}

Provide a clear, educational explanation that:
1. Explains the correct answer with reasoning
2. Explains why the student's answer is incorrect
3. Provides any relevant context or background
4. Is appropriate for the student's grade level`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a patient and clear educational assistant.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 400,
        });

        return response.choices[0].message.content.trim();
      } catch (error) {
        lastError = error;
        console.error(`AI explanation generation attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          return this.generateFallbackExplanation(question, correctAnswer);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw lastError;
  }

  generateFallbackExplanation(question, correctAnswer) {
    return `The correct answer is ${correctAnswer}. This answer demonstrates understanding of the key concepts in this question. Review the material related to this topic to strengthen your knowledge.`;
  }
}

module.exports = new AIService();
