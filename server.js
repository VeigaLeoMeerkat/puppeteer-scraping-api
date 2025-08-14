const express = require('express');
const puppeteer = require('puppeteer-extra');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const fetch = require('cross-fetch');
const { PuppeteerBlocker } = require('@ghostery/adblocker-puppeteer');
const PuppeteerProxy = require('puppeteer-extra-plugin-proxy');
const PuppeteerStealth = require('puppeteer-extra-plugin-stealth');

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
    version: '1.1.0',
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
  const { timeout } = req.body || 120000; // Padrão de 2 minutos
  const { pdfOutput } = req.body;
  const { bodyOnly } = req.body;
  const { disableFilters } = req.body;
  const { useProxy } = req.body;
  const { normalizeUrls } = req.body;
  const { requestBlockPattern } = req.body;
  const { injectJs } = req.body;
  const { removeInvisibleElements } = req.body;
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
    const stealthPlugin = PuppeteerStealth();
    stealthPlugin.enabledEvasions.delete('iframe.contentWindow');
    puppeteer.use(stealthPlugin);

    // Ativa proxy, se solicitado na requisição
    if (useProxy === true) {
      const proxyPlugin = PuppeteerProxy({
        address: 'api.zyte.com',
        port: 8011,
        credentials: {
          username: process.env.ZYTE_API_KEY,
          password: ''
        }
      });
      puppeteer.use(proxyPlugin);
      console.log('Proxy configurado');
    }

    // Inicializa o navegador
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

    // Ativa bloqueio de requisições, se solicitado na requisição
    if (requestBlockPattern) {
      await page.setRequestInterception(true);
      page.on('request', interceptedRequest => {
        if (interceptedRequest.isInterceptResolutionHandled())
          return;
        const re = new RegExp(requestBlockPattern);
        if (re.test(interceptedRequest.url()))
          interceptedRequest.abort();
        else
          interceptedRequest.continue();
      });
    }

    // Ativa filtros de conteúdo, se não foram desativados na requisição
    if (!disableFilters === true) {
      console.log('Ativando filtros de conteúdo...');
      const blocker = await blockerEngine;

      // Carrega filtros customizados, se disponíveis
      try {
        blocker.updateFromDiff({
          added: fs.readFileSync('./filter-custom-rules.txt', 'utf8').split(/\r?\n/)
        });
      } catch (error) {
        console.warn('Problema ao processar filtros customizados:', error);
      }

      await blocker.enableBlockingInPage(page);
    }

    // Configurações para simular um navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(timeout);

    console.log('Navegando para a página...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeout
    });

    console.log('Aguardando Cloudflare...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verificar se o Cloudflare ainda está presente
    const cloudflarePresent = await page.evaluate(() => {
      return document.querySelectorAll('.cf-error-footer, .ray-id').length > 0;
    });

    if (cloudflarePresent) {
      throw new Error('Proteção Cloudflare ainda ativa após timeout');
    }

    // Recarrega a página antes de capturar o PDF
    if (pdfOutput === true) {
      await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
    }

    // Injeta JavaScript na página, se fornecido na requisição
    if (injectJs) {
      console.log('Injetando JavaScript...');
      await page.evaluate(injectJs);
    }

    // Remove header e footer, se solicitado na requisição
    if (bodyOnly === true) {
      console.log('Removendo header e footer...');
      await page.evaluate(() => {
        document.querySelector('header')?.remove();
        document.querySelector('footer')?.remove();
      });
    }

    // Remove elementos invisíveis, se solicitado na requisição
    if (removeInvisibleElements === true) {
      console.log('Removendo elementos invisíveis...');
      await page.evaluate(fs.readFileSync('./helpers/remove_invisible_elements.js', 'utf8'));
      // await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Normaliza URLs, se solicitado na requisição
    if (normalizeUrls === true) {
      console.log('Normalizando URLs...');
      await page.evaluate(fs.readFileSync('./helpers/normalize_urls.js', 'utf8'));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (pdfOutput === true) {
      console.log('Gerando PDF...');
      // Configurações do PDF
      await page.emulateMediaType('screen');
      await page.pdf({
        path: pdfFilename,
        printBackground: true
      });
      console.log('PDF gerado com sucesso');
    } else {
      console.log('Extraindo HTML...');
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
    console.error('Falha durante o scraping:', error);
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
