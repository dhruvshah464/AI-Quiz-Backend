const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
let authToken = '';

const testEndpoints = async () => {
  try {
    // Test registration
    console.log('\nTesting registration...');
    const uniqueUsername = `testuser_${Date.now()}`;
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      username: uniqueUsername,
      password: 'testpass123',
      email: 'test@example.com',
      gradeLevel: 8
    });
    console.log('Registration successful:', registerResponse.data);

    // Test login
    console.log('\nTesting login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: uniqueUsername,
      password: 'testpass123'
    });
    console.log('Login successful:', loginResponse.data);
    authToken = loginResponse.data.token;

    // Test quiz generation
    console.log('\nTesting quiz generation...');
    const quizResponse = await axios.post(
      `${API_URL}/quiz/generate`,
      {
        subject: 'Mathematics',
        gradeLevel: 8,
        totalQuestions: 3
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log('Quiz generated:', quizResponse.data);

    const quizId = quizResponse.data.quiz.id;
    const questions = quizResponse.data.quiz.questions;

    // Test quiz submission
    console.log('\nTesting quiz submission...');
    const answers = questions.map(q => ({
      questionId: q.id,
      answer: q.options[0] // Just select the first option for testing
    }));

    const submitResponse = await axios.post(
      `${API_URL}/quiz/${quizId}/submit`,
      { answers },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log('Quiz submission result:', submitResponse.data);

    // Test getting quiz history
    console.log('\nTesting quiz history...');
    const historyResponse = await axios.get(
      `${API_URL}/quiz/history`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log('Quiz history:', historyResponse.data);

  } catch (error) {
    console.error('Error during testing:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    console.error('Full error:', error);
    process.exit(1);
  }
};

// Install axios if not already installed
const { execSync } = require('child_process');
try {
  require.resolve('axios');
} catch (e) {
  console.log('Installing axios...');
  execSync('npm install axios');
}

// Run the tests
testEndpoints();
