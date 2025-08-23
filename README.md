# AI-Powered Quiz Application Microservice

A microservice that provides AI-generated quizzes with adaptive difficulty and intelligent evaluation.

## Features

- Authentication with JWT
- AI-generated quiz questions
- Adaptive difficulty based on user performance
- AI-powered hints and improvement suggestions
- Quiz history with filtering
- Docker containerization
- PostgreSQL database
- Redis caching (optional)

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 14+
- Redis (optional)

## Setup

1. Clone the repository
2. Copy the example environment file:
   ```bash
   cp src/.env.example src/.env
   ```
3. Update the environment variables in `src/.env`

### Running with Docker

```bash
# Build and start the containers
docker-compose up --build

# Run database migrations
docker-compose exec app npx sequelize-cli db:migrate
```

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start PostgreSQL and Redis

3. Run database migrations:
   ```bash
   npx sequelize-cli db:migrate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### Authentication

- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login and get JWT token

### Quiz Management

- POST `/api/quiz/generate` - Generate a new quiz
- POST `/api/quiz/:quizId/submit` - Submit quiz answers
- GET `/api/quiz/history` - Get quiz history with filters
- GET `/api/quiz/question/:questionId/hint` - Get AI-generated hint

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - PostgreSQL host
- `DB_USER` - PostgreSQL user
- `DB_PASSWORD` - PostgreSQL password
- `DB_NAME` - PostgreSQL database name
- `JWT_SECRET` - JWT signing secret
- `GROQ_API_KEY` - Groq AI API key
- `REDIS_URL` - Redis connection URL (optional)

## Testing

```bash
npm test
```

## Deployment

The application can be deployed to any platform that supports Docker containers (Heroku, DigitalOcean, AWS, etc.).

### Heroku Deployment

1. Install Heroku CLI
2. Login to Heroku
3. Create a new Heroku app
4. Set up environment variables
5. Deploy the application

```bash
heroku login
heroku create
heroku config:set $(cat .env)
git push heroku main
```

## Known Issues

- Rate limiting not implemented
- Missing comprehensive test coverage
- Email notifications not implemented yet

## Future Improvements

- Add rate limiting
- Implement email notifications
- Add comprehensive test suite
- Implement leaderboard functionality
- Add more AI-powered features

## License

ISC
