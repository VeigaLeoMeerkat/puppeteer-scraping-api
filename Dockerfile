FROM node:18-slim

# Instala dependências necessárias para o Puppeteer e ferramentas de sistema
RUN apt-get update \
    && apt-get install -y \
    wget \
    gnupg \
    curl \
    wget \
    procps \
    ca-certificates \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configura o Puppeteer para usar o Chrome instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Cria diretório da aplicação
WORKDIR /usr/src/app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o código fonte
COPY . .

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=8001
# API_TOKEN será definido em runtime

# Expõe a porta
EXPOSE 8001

# Comando para iniciar a aplicação
CMD [ "npm", "start" ] 