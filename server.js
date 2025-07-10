const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('cross-fetch');
const { PuppeteerBlocker } = require('@ghostery/adblocker-puppeteer');

// Inicialização do Puppeteer Adblocker
let blockerEngine = PuppeteerBlocker.fromLists(fetch, [
  "https://secure.fanboy.co.nz/fanboy-annoyance.txt"   // Filtro para avisos de cookies, GDPR e outros banners/popups
]);

// Inicialização do Express
const app = express();

// Configurações
const PORT = process.env.PORT || 8001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_TOKEN = process.env.API_TOKEN || '123'; // Token padrão apenas para desenvolvimento

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  if (token !== API_TOKEN) {
    return res.status(403).json({ error: 'Token inválido' });
  }

  next();
};

// Middlewares
app.use(express.json()); // Permite receber JSON no body das requisições
app.use(cors()); // Permite requisições de diferentes origens

// Rota raiz - Mensagem de boas-vindas
app.get('/', (req, res) => {
  res.json({
    message: 'Bem-vindo à API de Web Scraping',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/health' },
      { method: 'POST', path: '/scrape' }
    ]
  });
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Rota principal de scraping
app.post('/scrape', authenticateToken, async (req, res) => {
  const { url } = req.body;
  const { pdfOutput } = req.body;
  const { bodyOnly } = req.body;
  const { disableFilters } = req.body;
  const pdfFilename = crypto.randomBytes(16).toString("hex") + '.pdf';
  var html;

  if (!url) {
    return res.status(400).json({
      error: 'URL é obrigatória',
      example: 'https://example.com'
    });
  }

  console.log(`Iniciando scraping de: ${url}`);
  let browser;

  try {
    // Configuração do Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ]
    });

    const page = await browser.newPage();

    if (!disableFilters === true) {
      console.log('Ativando filtros de conteúdo...');
      const blocker = await blockerEngine;

      // Ativa filtros customizados, se disponíveis
      try {
        blocker.updateFromDiff({
          added: fs.readFileSync('./filter-custom-rules.txt', 'utf8').split(/\r?\n/)
        });
      } catch (error) {
        console.warn('Problema ao ativar filtros customizados:', error);
      }

      await blocker.enableBlockingInPage(page);
    }

    // Configurações para simular um navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Configurar timeout mais longo para o Cloudflare
    await page.setDefaultNavigationTimeout(120000);

    console.log('Navegando para a página...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 120000
    });

    console.log('Aguardando Cloudflare...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Verificar se o Cloudflare ainda está presente
    const cloudflarePresent = await page.evaluate(() => {
      return document.body.innerHTML.includes('cloudflare');
    });

    if (cloudflarePresent) {
      throw new Error('Proteção Cloudflare ainda ativa após timeout');
    }

    if (pdfOutput === true) {
      console.log('Gerando PDF...');

      // Recarrega a página antes de capturar o PDF
      await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });

      // Remove header e footer, se solicitado na requisição
      if (bodyOnly === true) {
        console.log('Removendo header e footer...');
        await page.evaluate(() => {
          const els = document.querySelectorAll('header, footer');
          els.forEach(el => el.remove());
        });
      }
      await page.emulateMediaType('screen');
      await page.pdf({
        // Configurações do PDF
        path: pdfFilename,
        printBackground: true
      });
      console.log('PDF gerado com sucesso');
    } else {
      console.log('Extraindo HTML...');

      // Remove header e footer, se solicitado na requisição
      if (bodyOnly === true) {
        console.log('Removendo header e footer...');
        await page.evaluate(() => {
          const els = document.querySelectorAll('header, footer');
          els.forEach(el => el.remove());
        });
      }
      html = await page.content();
      console.log('HTML extraído com sucesso');
    }

    await browser.close();

    if (pdfOutput === true) {
      // Retornando o PDF gerado como anexo
      res.sendFile(__dirname + '/' + pdfFilename, (err) => {
        if (err) {
          throw new Error(err);
        } else {
          // PDF transferido, exclui cópia local
          fs.unlinkSync(__dirname + '/' + pdfFilename);
        }
      });
    } else {
      // Retornando o HTML dentro de um JSON
      res.json({
        success: true,
        data: {
          url: url,
          timestamp: new Date().toISOString(),
          html: html
        }
      });
    }

  } catch (error) {
    console.error('Erro durante o scraping:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({
      success: false,
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Ambiente:', NODE_ENV);
  console.log('Endpoints disponíveis:');
  console.log('- GET  /');
  console.log('- GET  /health');
  console.log('- POST /scrape');
});
