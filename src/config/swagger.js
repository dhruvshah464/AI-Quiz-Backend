const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AI-Powered Quiz API',
    version: '1.0.0',
    description: 'RESTful API for an AI-powered quiz application',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  gradeLevel: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User registered successfully',
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
          },
        },
      },
    },
    '/api/quiz/generate': {
      post: {
        tags: ['Quiz'],
        security: [{ BearerAuth: [] }],
        summary: 'Generate a new quiz',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  gradeLevel: { type: 'integer' },
                  totalQuestions: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Quiz generated successfully',
          },
        },
      },
    },
    '/api/quiz/{quizId}/submit': {
      post: {
        tags: ['Quiz'],
        security: [{ BearerAuth: [] }],
        summary: 'Submit quiz answers',
        parameters: [
          {
            in: 'path',
            name: 'quizId',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  answers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        questionId: { type: 'string' },
                        answer: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Quiz submitted successfully',
          },
        },
      },
    },
    '/api/quiz/history': {
      get: {
        tags: ['Quiz'],
        security: [{ BearerAuth: [] }],
        summary: 'Get quiz history',
        parameters: [
          {
            in: 'query',
            name: 'grade',
            schema: { type: 'integer' },
          },
          {
            in: 'query',
            name: 'subject',
            schema: { type: 'string' },
          },
          {
            in: 'query',
            name: 'minScore',
            schema: { type: 'number' },
          },
          {
            in: 'query',
            name: 'maxScore',
            schema: { type: 'number' },
          },
          {
            in: 'query',
            name: 'startDate',
            schema: { type: 'string', format: 'date' },
          },
          {
            in: 'query',
            name: 'endDate',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          200: {
            description: 'Quiz history retrieved successfully',
          },
        },
      },
    },
  },
};

module.exports = swaggerDefinition;
