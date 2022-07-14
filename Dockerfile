FROM sitespeedio/node:ubuntu-20.04-nodejs-12.14.1

ENV NODE_VERSION 14.20.0

RUN apt update

# Install Tor
RUN apt install tor -y

# Copy Tor config
COPY ./config/torrc /etc/tor

WORKDIR /app

# Copy project files
COPY ./api ./api
COPY ./bin ./bin
COPY ./config ./config
COPY ./controllers ./controllers
COPY ./helpers ./helpers
COPY ./public ./public
COPY ./routes ./routes
COPY ./scheduled-tasks ./scheduled-tasks
COPY ./scripts ./scripts
COPY ./views ./views
COPY ./app.js ./app.js
COPY ./package.json ./package.json

# Installing node modules
RUN npm install

# Installing chromium for puppeteer
# Reference: https://stackoverflow.com/questions/66070860/puppeteer-error-error-while-loading-shared-libraries-libgobject-2-0-so-0
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# # Starting application
ENV PORT=3333
EXPOSE 3333

CMD ["npm", "start"]