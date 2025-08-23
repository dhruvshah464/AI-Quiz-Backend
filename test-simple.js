const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

const testRegistration = async () => {
  try {
    // Test registration with minimal data
    console.log('\nTesting registration with minimal data...');
    const response = await axios.post(`${API_URL}/auth/register`, {
      username: 'test1',
      password: 'pass123'
    });
    console.log('Registration response:', response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    console.error('Full error:', error);
  }
};

testRegistration();
