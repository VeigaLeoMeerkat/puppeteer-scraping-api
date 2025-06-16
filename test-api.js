const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:8001';
const API_TOKEN = process.env.API_TOKEN || '123';

// Configuração do axios com o token
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Teste da rota raiz
async function testRootRoute() {
  try {
    const response = await api.get('/');
    console.log('\n=== Teste da Rota Raiz ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Erro na rota raiz:', error.response?.data || error.message);
  }
}

// Teste da rota de health check
async function testHealthCheck() {
  try {
    const response = await api.get('/health');
    console.log('\n=== Teste do Health Check ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Erro no health check:', error.response?.data || error.message);
  }
}

// Teste da rota de scraping
async function testScrapingHTML() {
  try {
    const response = await api.post('/scrape', {
      url: 'https://example.com'
    });
    console.log('\n=== Teste de Scraping HTML ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\nErro no scraping em HTML:', error.response?.data || error.message);
  }
}

async function testScrapingPDF() {
  try {
    const response = await api.post('/scrape', {
      url: 'https://example.com',
      pdfOutput: true
    });
    console.log('\n=== Teste de Scraping em PDF ===');
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(response.headers, null, 2));
  } catch (error) {
    console.error('\nErro no scraping em PDF:', error.response?.data || error.message);
  }
}

// Teste de URL inválida
async function testInvalidUrl() {
  try {
    const response = await api.post('/scrape', {});
    console.log('\n=== Teste de URL Inválida ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('\n=== Teste de URL Inválida ===');
    console.log('Status:', error.response?.status);
    console.log('Erro:', JSON.stringify(error.response?.data, null, 2));
  }
}

// Teste de token inválido
async function testInvalidToken() {
  try {
    const response = await axios.post(`${API_URL}/scrape`,
      { url: 'https://example.com' },
      { headers: { 'Authorization': 'Bearer invalid_token' } }
    );
    console.log('\n=== Teste de Token Inválido ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('\n=== Teste de Token Inválido ===');
    console.log('Status:', error.response?.status);
    console.log('Erro:', JSON.stringify(error.response?.data, null, 2));
  }
}

// Executa todos os testes
async function runTests() {
  await testRootRoute();
  await testHealthCheck();
  await testScrapingHTML();
  await testScrapingPDF();
  await testInvalidUrl();
  await testInvalidToken();
}

runTests();